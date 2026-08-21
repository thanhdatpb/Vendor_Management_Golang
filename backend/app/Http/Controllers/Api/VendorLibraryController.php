<?php

namespace App\Http\Controllers\Api;

use App\Events\VendorLibraryChanged;
use App\Http\Controllers\Controller;
use App\Support\VendorFieldVisibility;
use App\Support\VendorLibraryIndexBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class VendorLibraryController extends Controller
{
    private function getRow()
    {
        return DB::table('vendor_library')->orderBy('id')->first();
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

    public function getLibrary(Request $request)
    {
        $row = $this->getRow();

        if (!$row) {
            return response()->json([]);
        }

        // PD và Marvel không được xem 2 cột thời gian (AVG TG Vendor / Thực tế);
        // CSF thì có. Lọc ở SERVER chứ không chỉ ẩn cột trên UI — ẩn ở UI thì
        // mở DevTools là thấy. Quy tắc role nào xem được nằm ở
        // App\Support\VendorFieldVisibility — một chỗ duy nhất.
        //
        // Role được xem đầy đủ đi thẳng đường cũ, không tốn công decode blob.
        $role = $request->user()->role ?? '';
        if (!VendorFieldVisibility::seesLeadTime($role)) {
            $files = json_decode($row->data, true);
            if (is_array($files)) {
                return response()->json(VendorFieldVisibility::filterLeadTime($files, $role));
            }
        }

        return response($row->data)->header('Content-Type', 'application/json');
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

        $row   = $this->getRow();
        $stamp = $row ? (string) $row->updated_at : '0';
        $etag  = '"' . sha1(implode('|', [
            'vendor-library-index',
            (string) $stamp,
            (string) $projectKey,
            $seesPrices ? 'priced' : 'nopriced',
        ])) . '"';

        $ifNoneMatch = trim((string) $request->header('If-None-Match'));
        if ($ifNoneMatch !== '' && $this->etagMatches($ifNoneMatch, $etag)) {
            return response('', 304)->header('ETag', $etag);
        }

        if (!$row) {
            return response()->json([])->header('ETag', $etag);
        }

        $records = Cache::remember(
            'vendor_library_index_' . sha1($etag),
            3600,
            function () use ($row, $projectKey, $seesPrices) {
                $files = json_decode($row->data, true);

                return VendorLibraryIndexBuilder::build(
                    is_array($files) ? $files : [],
                    $projectKey,
                    $seesPrices
                );
            }
        );

        return response()->json($records)
            ->header('ETag', $etag)
            ->header('Cache-Control', 'private, must-revalidate');
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

    public function saveLibrary(Request $request)
    {
        $data = $request->getContent();

        // Validate JSON
        if (json_decode($data) === null) {
            return response()->json(['error' => 'Invalid JSON'], 422);
        }

        $row = $this->getRow();

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

        return response()->json(['message' => 'Library saved successfully']);
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
            $path = $file->store('vendor-library', 'public');
            // Không dùng Storage::url(): local disk ghép APP_URL vào URL. Nếu
            // production còn APP_URL=http://localhost, browser người dùng sẽ
            // gọi localhost và toàn bộ ảnh Excel bị vỡ. Đường dẫn tương đối
            // luôn đi qua /storage của đúng domain Vendor Hub hiện tại.
            $urls[$key] = '/storage/' . ltrim($path, '/');
        }

        return response()->json(['urls' => $urls]);
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
