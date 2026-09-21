<?php

namespace App\Http\Controllers\Api;

use App\Events\VendorLibraryChanged;
use App\Http\Controllers\Controller;
use App\Services\LibraryUpdateNotifier;
use App\Support\HandlesMediaStorage;
use App\Support\VendorFieldVisibility;
use App\Support\VendorLibraryDiff;
use App\Support\VendorLibraryIndexBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class VendorLibraryController extends Controller
{
    use HandlesMediaStorage;

    private function getRow()
    {
        return DB::table('vendor_library')->orderBy('id')->first();
    }

    /**
     * Chỉ `id` + `updated_at`, KHÔNG kéo cột `data`.
     *
     * Cột `data` là một longText vài MB cho toàn hệ thống. Mọi ETag ở đây chỉ
     * cần `updated_at`, nên dùng `getRow()` cho việc đó là mỗi request lại bốc
     * vài MB từ MySQL sang PHP rồi vứt đi — kể cả request kết thúc bằng 304.
     * Đọc `data` chỉ xảy ra khi thực sự phải dựng body trả về.
     */
    private function getMetaRow()
    {
        return DB::table('vendor_library')
            ->orderBy('id')
            ->select('id', 'updated_at')
            ->first();
    }

    /**
     * ETag chung cho mọi endpoint đọc thư viện: mốc sửa + phần định danh riêng.
     *
     * `$stamp` cho nơi gọi đã cầm sẵn dòng meta truyền lại, khỏi hỏi DB lần hai.
     */
    private function libraryEtag(string $scope, array $parts = [], ?string $stamp = null): string
    {
        if ($stamp === null) {
            $meta  = $this->getMetaRow();
            $stamp = $meta ? (string) $meta->updated_at : '0';
        }

        return '"' . sha1(implode('|', array_merge(
            [$scope, $stamp],
            array_map('strval', $parts)
        ))) . '"';
    }

    /** Header chung cho response đọc thư viện — luôn revalidate, không cache chung. */
    private function libraryCacheHeaders($response, string $etag)
    {
        return $response
            ->header('ETag', $etag)
            ->header('Cache-Control', 'private, must-revalidate');
    }

    /**
     * Báo cho mọi máy đang mở thư viện biết dữ liệu vừa đổi (mục 16).
     *
     * Trước đây `fetchLibrary` ở client chỉ chạy lúc mount, nên sau khi import
     * file mới thì người đang mở tab vẫn thấy bản cũ — và bảng tính giá của họ
     * tính trên giá vốn cũ mà không hay biết.
     *
     * Lỗi broadcast KHÔNG được làm hỏng thao tác ghi: dữ liệu đã lưu xong rồi,
     * cùng lắm người khác phải chờ tới lần mở lại tab kế tiếp.
     */
    private function announce(string $reason): void
    {
        try {
            broadcast(new VendorLibraryChanged($reason));
        } catch (\Throwable $e) {
            Log::warning('Không broadcast được thay đổi thư viện Vendor.', [
                'reason' => $reason,
                'error'  => $e->getMessage(),
            ]);
        }
    }

    /**
     * TOÀN BỘ THƯ VIỆN — nguồn của 2 màn hình danh sách (Vendor/Admin và CSF/PD/Marvel).
     *
     * Đây là request NẶNG NHẤT của hệ thống: một blob vài MB mỗi lần mở trang.
     * Hai thứ giữ nó không nặng hơn mức cần thiết:
     *
     *  • ETag theo (updated_at, role) — client làm mới NỀN (quay lại tab, Pusher
     *    báo đổi) nhận 304 rỗng thay vì tải lại cả blob. Role phải nằm trong
     *    ETag vì body khác nhau theo role: bản của CSF không cùng cột với bản
     *    của Seller, dùng chung một ETag là phát nhầm bản đã lọc cho người được
     *    xem đủ (và ngược lại).
     *  • Lọc theo role NGAY Ở SERVER — cả giá lẫn 2 cột AVG TG. Trước đây chỉ
     *    lọc AVG TG; toàn bộ cột giá vẫn đi qua mạng rồi frontend mới giấu ở
     *    tầng render, vừa phí băng thông vừa trái CLAUDE.md §6.5 (xem
     *    tests/Feature/VendorLibraryPriceLeakTest.php).
     *
     * `?mode=` KHÔNG ảnh hưởng body (client tự lọc tab) nên cũng không vào ETag.
     */
    public function getLibrary(Request $request)
    {
        $role = $request->user()->role ?? '';
        $etag = $this->libraryEtag('vendor-library', [VendorFieldVisibility::normalizeRole($role)]);

        $ifNoneMatch = trim((string) $request->header('If-None-Match'));
        if ($ifNoneMatch !== '' && $this->etagMatches($ifNoneMatch, $etag)) {
            return response('', 304)->header('ETag', $etag);
        }

        $row = $this->getRow();
        if (!$row) {
            return $this->libraryCacheHeaders(response()->json([]), $etag);
        }

        // Role thấy đủ mọi trường đi thẳng đường cũ: trả nguyên chuỗi đã lưu,
        // không decode rồi encode lại vài MB cho không.
        if (VendorFieldVisibility::seesPrices($role) && VendorFieldVisibility::seesLeadTime($role)) {
            return $this->libraryCacheHeaders(
                response($row->data)->header('Content-Type', 'application/json'),
                $etag
            );
        }

        $files = json_decode($row->data, true);
        if (!is_array($files)) {
            // Cùng cách xử lý với respondWithFile(): KHÔNG trả mảng rỗng, vì
            // "thư viện trống" và "dữ liệu hỏng" là hai chuyện khác nhau.
            return response()->json(['message' => 'Dữ liệu thư viện không hợp lệ.'], 422);
        }

        $files = VendorFieldVisibility::filterLeadTime($files, $role);
        $files = VendorFieldVisibility::filterPrices($files, $role);

        return $this->libraryCacheHeaders(response()->json($files), $etag);
    }

    /**
     * INDEX GỌN cho bảng tính giá (mục 17).
     *
     * `vendor_library` là MỘT dòng longText cho toàn hệ thống, và `getLibrary`
     * trả nguyên blob. Mỗi lần Seller mở một bảng giá là một lần tải cả thư viện
     * — ảnh, notes, link folder, generalInfo — chỉ để lấy danh sách size và giá
     * vốn. Endpoint này trả đúng phần cần dùng.
     *
     * Đây cũng là chỗ THỰC THI phân quyền giá: role không được xem giá thì các
     * khoá giá bị loại ở server, không phải ẩn cột trên UI.
     *
     * ETag theo `vendor_library.updated_at`: mở bảng thứ hai trở đi nhận 304,
     * không tải lại gì.
     */
    public function index(Request $request)
    {
        $user       = $request->user();
        $role       = $user->role ?? '';
        $seesPrices = VendorFieldVisibility::seesPrices($role);

        // Project: role xem-tất-cả có thể truyền rỗng để lấy toàn bộ; các role
        // còn lại luôn bị ép về project của chính họ.
        $projectKey = $this->indexProjectKey($request, $user);

        $etag = $this->libraryEtag('vendor-library-index', [
            $projectKey,
            $seesPrices ? 'priced' : 'nopriced',
        ]);

        $ifNoneMatch = trim((string) $request->header('If-None-Match'));
        if ($ifNoneMatch !== '' && $this->etagMatches($ifNoneMatch, $etag)) {
            return response('', 304)->header('ETag', $etag);
        }

        // Cột `data` CHỈ được đọc khi cache trượt. Trước đây nó bị kéo về ngay
        // từ đầu chỉ để lấy `updated_at`, nên cả request 304 lẫn request cache
        // hit đều phải bốc vài MB từ MySQL rồi vứt đi.
        $records = Cache::remember(
            'vendor_library_index_' . sha1($etag),
            3600,
            function () use ($projectKey, $seesPrices) {
                $row = $this->getRow();
                if (!$row) {
                    return [];
                }

                $files = json_decode($row->data, true);

                return VendorLibraryIndexBuilder::build(
                    is_array($files) ? $files : [],
                    $projectKey,
                    $seesPrices
                );
            }
        );

        return $this->libraryCacheHeaders(response()->json($records), $etag);
    }

    /** Phạm vi project của index — không cho role hẹp tự nới bằng query param. */
    private function indexProjectKey(Request $request, $user): string
    {
        $role = VendorFieldVisibility::normalizeRole($user->role ?? '');
        // PD nằm trong danh sách này: PD được xem thư viện của MỌI project, không
        // bị ghim theo cột `project` của tài khoản (cột đó vẫn còn trong DB,
        // chỉ là không dùng để phân quyền nữa).
        if (in_array($role, ['admin', 'marvel', 'staffb', 'vendor', 'csf', 'pd'], true)) {
            return strtolower(trim((string) $request->query('project', '')));
        }

        return strtolower(trim((string) ($user->project ?? '')));
    }

    /** If-None-Match có thể là danh sách, và có thể mang tiền tố W/. */
    private function etagMatches(string $header, string $etag): bool
    {
        foreach (explode(',', $header) as $candidate) {
            $candidate = trim($candidate);
            if ($candidate === '*') {
                return true;
            }
            if (preg_replace('/^W\//', '', $candidate) === $etag) {
                return true;
            }
        }

        return false;
    }

    /**
     * DANH SÁCH FILE GỌN — nguồn của ô "Tìm file trong thư viện" khi Vendor cung
     * cấp vendor cho một request.
     *
     * Chỉ trả phần cần để TÌM và CHỌN file (id, tên, ngày nhập, Product Type,
     * tên vendor, số đếm) — KHÔNG có một khoá giá nào, không ảnh, không notes —
     * nên an toàn cho mọi role. Nội dung đầy đủ của file chọn xong mới tải qua
     * `showFile` (nơi lọc giá theo role).
     *
     * Phạm vi project giống hệt `showFile`: file ngoài phạm vi không xuất hiện.
     * ETag theo (updated_at của blob, phạm vi project): mở lại ngăn kéo là 304.
     */
    public function listFiles(Request $request)
    {
        $user       = $request->user();
        $projectKey = $this->fileProjectKey($user);

        $etag = $this->libraryEtag('vendor-library-file-list', [$projectKey]);

        $ifNoneMatch = trim((string) $request->header('If-None-Match'));
        if ($ifNoneMatch !== '' && $this->etagMatches($ifNoneMatch, $etag)) {
            return response('', 304)->header('ETag', $etag);
        }

        // Đọc blob SAU khi đã loại 304: mở lại ngăn kéo không còn chạm cột `data`.
        $row   = $this->getRow();
        $files = $row ? json_decode((string) $row->data, true) : [];
        $list  = [];

        foreach (is_array($files) ? $files : [] as $file) {
            if (!is_array($file) || empty($file['id'])) {
                continue;
            }
            if ($projectKey !== '' && !VendorLibraryIndexBuilder::fileVisibleToProject($file, $projectKey)) {
                continue;
            }

            $general = is_array($file['generalInfo'] ?? null) ? $file['generalInfo'] : [];
            $pricing = is_array($file['pricing'] ?? null) ? $file['pricing'] : [];

            $vendors      = [];
            $productTypes = [];
            foreach ($general as $g) {
                if (!is_array($g)) {
                    continue;
                }
                $name = trim((string) ($g['vendorName'] ?? '')) ?: trim((string) ($g['kyHieu'] ?? ''));
                if ($name !== '') {
                    $vendors[$name] = true;
                }
                $type = trim((string) ($g['productType'] ?? ''));
                if ($type !== '') {
                    $productTypes[$type] = true;
                }
            }

            $list[] = [
                'id'           => (string) $file['id'],
                'filename'     => (string) ($file['filename'] ?? ''),
                'title'        => (string) ($file['title'] ?? ''),
                'importedAt'   => $file['importedAt'] ?? null,
                'sourceTab'    => $file['sourceTab'] ?? null,
                'project'      => VendorLibraryIndexBuilder::fileProjectTag($file),
                'vendors'      => array_map('strval', array_keys($vendors)),
                'productTypes' => array_map('strval', array_keys($productTypes)),
                'counts'       => [
                    'generalInfo' => count($general),
                    'pricing'     => count($pricing),
                ],
            ];
        }

        // File nhập gần nhất lên đầu — cùng thứ tự với danh sách thư viện.
        usort($list, static fn (array $a, array $b) => strcmp((string) $b['importedAt'], (string) $a['importedAt']));

        return $this->libraryCacheHeaders(response()->json($list), $etag);
    }

    /**
     * MỘT FILE THEO ID — nguồn dữ liệu cho link riêng `/library/:fileId`.
     *
     * Trước đây muốn xem một file phải gọi `getLibrary` và tải NGUYÊN blob của
     * cả hệ thống (kèm ảnh/notes/link folder của mọi file) rồi tự tìm trong đó.
     * Endpoint này trả đúng một phần tử, và cũng là nơi THỰC THI phân quyền:
     *
     *   • ngoài phạm vi project  → 403 (KHÔNG phải 404: người nhận link cần
     *     biết file có thật, chỉ là không thuộc phạm vi của họ);
     *   • role không xem được giá → các khoá giá bị loại khỏi `pricing`;
     *   • role không xem được AVG TG → 2 cột thời gian bị loại khỏi `generalInfo`.
     *
     * ETag theo (updated_at của blob, file, role, phạm vi project): mở lại cùng
     * một link thì nhận 304, không tải lại gì.
     */
    public function showFile(Request $request, string $id)
    {
        return $this->respondWithFile(
            $request,
            static fn (array $file): bool => (string) ($file['id'] ?? '') === $id,
            'id:' . $id
        );
    }

    /**
     * MỘT FILE THEO TÊN — cứu các link cũ chỉ mang `filename`.
     *
     * Thông báo `library_updated` phát trước phiên bản này không kèm `file_id`,
     * nên nút "Mở file" trong mail cũ chỉ có tên file để bám vào. Trả về file
     * kèm `id` để client chuyển hướng sang dạng chuẩn.
     *
     * Tên file trong thư viện KHÔNG đảm bảo duy nhất; lấy bản import gần nhất
     * để khỏi phụ thuộc thứ tự phần tử trong blob.
     */
    public function showFileByName(Request $request, string $filename)
    {
        $needle = $this->normalizeFilename($filename);

        return $this->respondWithFile(
            $request,
            fn (array $file): bool => $this->normalizeFilename((string) ($file['filename'] ?? '')) === $needle,
            'name:' . $needle,
            true
        );
    }

    /**
     * Thân chung của 2 endpoint trên: tìm → kiểm quyền → lọc trường → ETag.
     *
     * @param  callable(array):bool  $matches     điều kiện nhận diện file
     * @param  string                $etagSubject phần định danh đưa vào ETag
     * @param  bool                  $newestWins  nhiều file khớp thì lấy bản import gần nhất
     */
    private function respondWithFile(Request $request, callable $matches, string $etagSubject, bool $newestWins = false)
    {
        $user = $request->user();
        $role = $user->role ?? '';

        // Dòng meta (id + updated_at, KHÔNG có cột `data`) đủ cho cả việc biết
        // thư viện có tồn tại lẫn việc dựng ETag.
        $meta = $this->getMetaRow();
        if (!$meta) {
            return response()->json(['message' => 'Thư viện đang trống.'], 404);
        }

        $etag = $this->libraryEtag(
            'vendor-library-file',
            [$etagSubject, VendorFieldVisibility::normalizeRole($role), $this->fileProjectKey($user)],
            (string) $meta->updated_at
        );

        $ifNoneMatch = trim((string) $request->header('If-None-Match'));
        if ($ifNoneMatch !== '' && $this->etagMatches($ifNoneMatch, $etag)) {
            return response('', 304)->header('ETag', $etag);
        }

        $row = $this->getRow();
        if (!$row) {
            return response()->json(['message' => 'Thư viện đang trống.'], 404);
        }

        $files = json_decode((string) $row->data, true);
        if (!is_array($files)) {
            return response()->json(['message' => 'Dữ liệu thư viện không hợp lệ.'], 422);
        }

        $found = null;
        foreach ($files as $file) {
            if (!is_array($file) || !$matches($file)) {
                continue;
            }
            if (!$newestWins) {
                $found = $file;
                break;
            }
            if ($found === null || (string) ($file['importedAt'] ?? '') > (string) ($found['importedAt'] ?? '')) {
                $found = $file;
            }
        }

        if ($found === null) {
            return response()->json(['message' => 'Không tìm thấy file này trong thư viện.'], 404);
        }

        $projectKey = $this->fileProjectKey($user);
        if ($projectKey !== '' && !VendorLibraryIndexBuilder::fileVisibleToProject($found, $projectKey)) {
            return response()->json([
                'message' => 'File này thuộc một project khác với tài khoản của bạn.',
            ], 403);
        }

        return $this->libraryCacheHeaders(response()->json($this->visibleFile($found, $role)), $etag);
    }

    /**
     * Phạm vi project áp cho một file. Chuỗi rỗng = xem được mọi project.
     *
     * Giữ ĐÚNG danh sách role của `indexProjectKey` (admin, marvel, staffb,
     * vendor, csf, pd) để hai đường vào cùng dữ liệu không nói hai chuyện khác
     * nhau; khác biệt duy nhất là ở đây không nhận `?project=` từ client, vì
     * link trỏ tới một file cụ thể chứ không phải một danh sách cần lọc.
     */
    private function fileProjectKey($user): string
    {
        $role = VendorFieldVisibility::normalizeRole($user->role ?? '');
        if (in_array($role, ['admin', 'marvel', 'staffb', 'vendor', 'csf', 'pd'], true)) {
            return '';
        }

        return strtolower(trim((string) ($user->project ?? '')));
    }

    /**
     * Bản của file mà role này được phép nhận, kèm `counts` để client khỏi tự
     * đếm mỗi nơi một kiểu — hàng ở bảng tổng và đầu cửa sổ file hiện cùng một
     * con số, đếm ở 2 chỗ là 2 cơ hội lệch.
     */
    private function visibleFile(array $file, $role): array
    {
        $file = VendorFieldVisibility::filterLeadTime([$file], $role)[0];
        $file = VendorFieldVisibility::filterFilePrices($file, $role);

        $file['counts'] = [
            'generalInfo' => is_array($file['generalInfo'] ?? null) ? count($file['generalInfo']) : 0,
            'pricing'     => is_array($file['pricing'] ?? null) ? count($file['pricing']) : 0,
        ];

        return $file;
    }

    /** So tên file bỏ qua hoa/thường, khoảng trắng thừa và đuôi .xlsx/.xls. */
    private function normalizeFilename(string $name): string
    {
        return mb_strtolower(trim((string) preg_replace('/\.xlsx?$/i', '', $name)));
    }

    public function saveLibrary(Request $request)
    {
        $data = $request->getContent();

        // Validate JSON
        if (json_decode($data) === null) {
            return response()->json(['error' => 'Invalid JSON'], 422);
        }

        $row = $this->getRow();

        // Chụp lại bản CŨ trước khi ghi đè — đây là cách DUY NHẤT biết file nào
        // vừa đổi, vì cột `data` là một blob JSON duy nhất cho toàn hệ thống.
        // Chỉ dùng để tính diff trong bộ nhớ, KHÔNG đổi cách lưu (vẫn ghi
        // nguyên chuỗi `$data` như trước — không đổi định dạng lưu trữ).
        $oldFiles = [];
        if ($row) {
            $decodedOld = json_decode((string) $row->data, true);
            $oldFiles = is_array($decodedOld) ? $decodedOld : [];
        }

        if ($row) {
            DB::table('vendor_library')->where('id', $row->id)->update([
                'data'       => $data,
                'updated_at' => now(),
            ]);
        } else {
            DB::table('vendor_library')->insert([
                'data'       => $data,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->announce('import');
        $this->notifyLibraryUpdated($request, $oldFiles, $data);

        return response()->json(['message' => 'Library saved successfully']);
    }

    /**
     * Phát notification `library_updated` cho từng file thực sự đổi nội dung.
     * Lỗi ở đây (vd actor null trong 1 kịch bản lạ nào đó) KHÔNG được phép làm
     * hỏng thao tác lưu đã thành công — cùng triết lý với announce() ở trên.
     */
    private function notifyLibraryUpdated(Request $request, array $oldFiles, string $newDataRaw): void
    {
        $actor = $request->user();
        if (!$actor) {
            return;
        }

        try {
            $decodedNew = json_decode($newDataRaw, true);
            $newFiles = is_array($decodedNew) ? $decodedNew : [];

            $changedFiles = VendorLibraryDiff::changedFiles($oldFiles, $newFiles);
            LibraryUpdateNotifier::notify($changedFiles, $actor);
        } catch (\Throwable $e) {
            Log::warning('Không phát được notification cập nhật Thư viện Vendor.', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Cập nhật riêng trạng thái đặt Sample của MỘT dòng generalInfo theo id.
     * Chỉ đọc–sửa–ghi đúng 1 field trên server, không nhận cả blob từ client
     * → payload nhỏ, tránh việc client gửi bản cũ ghi đè thay đổi đồng thời.
     */
    public function updateSampleStatus(Request $request)
    {
        $validated = $request->validate([
            'rowId'        => ['required'],
            'sampleStatus' => ['required', 'in:has_sample,no_sample'],
        ]);

        $rowId  = (string) $validated['rowId'];
        $status = $validated['sampleStatus'];

        $row = $this->getRow();
        if (!$row) {
            return response()->json(['message' => 'Thư viện trống, không thể cập nhật.'], 404);
        }

        $data = json_decode($row->data, true);
        if (!is_array($data)) {
            return response()->json(['message' => 'Dữ liệu thư viện không hợp lệ.'], 422);
        }

        $found = false;
        foreach ($data as &$file) {
            if (empty($file['generalInfo']) || !is_array($file['generalInfo'])) {
                continue;
            }
            foreach ($file['generalInfo'] as &$gr) {
                if (isset($gr['id']) && (string) $gr['id'] === $rowId) {
                    $gr['sampleStatus'] = $status;
                    $found = true;
                }
            }
            unset($gr);
        }
        unset($file);

        if (!$found) {
            return response()->json(['message' => 'Không tìm thấy dòng cần cập nhật.'], 404);
        }

        DB::table('vendor_library')->where('id', $row->id)->update([
            'data'       => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'updated_at' => now(),
        ]);

        $this->announce('sample-status');

        return response()->json([
            'message'      => 'Đã cập nhật trạng thái sample.',
            'rowId'        => $rowId,
            'sampleStatus' => $status,
        ]);
    }

    /**
     * Cập nhật riêng cờ Best Seller của MỘT dòng generalInfo theo id.
     * Cùng cơ chế với updateSampleStatus: đọc–sửa–ghi đúng 1 field trên server
     * → Best Seller lưu vào DB (dùng chung cho Seller/CSF/PD), không còn phụ thuộc
     * localStorage của từng máy.
     */
    public function updateBestSeller(Request $request)
    {
        $validated = $request->validate([
            'rowId'        => ['required'],
            'isBestSeller' => ['required', 'boolean'],
        ]);

        $rowId = (string) $validated['rowId'];
        $flag  = (bool) $validated['isBestSeller'];

        $row = $this->getRow();
        if (!$row) {
            return response()->json(['message' => 'Thư viện trống, không thể cập nhật.'], 404);
        }

        $data = json_decode($row->data, true);
        if (!is_array($data)) {
            return response()->json(['message' => 'Dữ liệu thư viện không hợp lệ.'], 422);
        }

        $found = false;
        foreach ($data as &$file) {
            if (empty($file['generalInfo']) || !is_array($file['generalInfo'])) {
                continue;
            }
            foreach ($file['generalInfo'] as &$gr) {
                if (isset($gr['id']) && (string) $gr['id'] === $rowId) {
                    $gr['bestSeller'] = $flag;
                    $found = true;
                }
            }
            unset($gr);
        }
        unset($file);

        if (!$found) {
            return response()->json(['message' => 'Không tìm thấy dòng cần cập nhật.'], 404);
        }

        DB::table('vendor_library')->where('id', $row->id)->update([
            'data'       => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'updated_at' => now(),
        ]);

        $this->announce('best-seller');

        return response()->json([
            'message'      => 'Đã cập nhật Best Seller.',
            'rowId'        => $rowId,
            'isBestSeller' => $flag,
        ]);
    }

    /**
     * Nhận hàng loạt ảnh trích xuất từ file Excel (ảnh nhúng trực tiếp vào ô,
     * không phải URL/formula =IMAGE()) và lưu vào disk public, trả về URL thật
     * cho từng ảnh — client dùng key gửi lên để map ngược ảnh vào đúng dòng.
     */
    public function uploadImages(Request $request)
    {
        $request->validate([
            'images'   => 'required|array|min:1|max:200',
            'images.*' => 'required|file|max:10240|mimetypes:image/jpeg,image/png,image/webp,image/gif',
        ]);

        $urls = [];
        foreach ($request->file('images') as $key => $file) {
            // Lưu theo disk đang cấu hình (MEDIA_DISK — đĩa server hoặc R2), nhưng
            // URL trả về LUÔN là route xác thực dưới đây — bất kể ảnh nằm ở đâu,
            // người xem vẫn phải đăng nhập mới tải được (không đổi ngược PR #264/266/268).
            $stored = $this->storeMedia($file, 'vendor-library');
            $urls[$key] = '/api/vendor-library/images/' . rawurlencode(basename($stored['path']));
        }

        return response()->json(['urls' => $urls]);
    }

    public function image(string $filename)
    {
        if (basename($filename) !== $filename || !preg_match('/^[A-Za-z0-9._-]+$/', $filename)) {
            abort(404);
        }

        $path = 'vendor-library/' . $filename;
        $disk = Storage::disk($this->mediaDisk());
        abort_unless($disk->exists($path), 404);

        return $disk->response($path, null, [
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    public function restoreBackup()
    {
        // Backup không còn dùng file — trả về dữ liệu hiện tại từ DB
        $row = $this->getRow();

        if (!$row) {
            return response()->json(['error' => 'Không có dữ liệu nào trong thư viện.'], 404);
        }

        return response($row->data)->header('Content-Type', 'application/json');
    }
}
