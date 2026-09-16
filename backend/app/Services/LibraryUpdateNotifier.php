<?php

namespace App\Services;

use App\Models\User;
use App\Support\VendorLibraryIndexBuilder;
use Illuminate\Support\Collection;

/**
 * Phát notification `library_updated` sau khi VendorLibraryController::saveLibrary()
 * ghi thành công — theo đúng ma trận người nhận đã chốt:
 *
 *   Admin          : mọi file, mọi actor — trừ chính actor.
 *   Vendor         : chỉ khi actor là Admin (Vendor tự import không tự báo).
 *   CSF / Marvel   : mọi file, không lọc project — hai role phục vụ mọi project.
 *   Seller         : chỉ file thuộc project của họ (`users.project`).
 *   PD             : chỉ file thuộc MỘT TRONG các project họ được phân quyền
 *                     (`users.pd_projects`) — phân quyền nhiều project vẫn chỉ
 *                     một thông báo cho mỗi file (danh sách người nhận là SET
 *                     theo user_id, không lặp theo project).
 *
 * Một file thay đổi = một thông báo riêng cho mỗi người nhận (nút bấm trỏ
 * đúng file đó). Nếu một lần lưu đổi nhiều hơn 3 file, gộp thành một thông
 * báo chung "N file vừa cập nhật" để không dội N mail cùng lúc.
 */
class LibraryUpdateNotifier
{
    private const MULTI_FILE_THRESHOLD = 3;

    /**
     * @param  list<array{filename:string,newProductTypes:list<string>,updatedRows:int,file:array}>  $changedFiles
     */
    public static function notify(array $changedFiles, User $actor): void
    {
        if (empty($changedFiles)) {
            return;
        }

        if (count($changedFiles) > self::MULTI_FILE_THRESHOLD) {
            self::notifyMultiFile($changedFiles, $actor);
            return;
        }

        foreach ($changedFiles as $changed) {
            self::notifyOneFile($changed, $actor);
        }
    }

    private static function notifyOneFile(array $changed, User $actor): void
    {
        $recipients = self::recipientsFor($changed['file'], $actor);
        if ($recipients->isEmpty()) {
            return;
        }

        $actorNoun  = self::displayName($actor);
        $newCount   = count($changed['newProductTypes']);
        $preview    = self::productTypesPreview($changed['newProductTypes']);

        if ($newCount > 0 && $changed['updatedRows'] > 0) {
            $body = "{$actorNoun} vừa thêm {$newCount} phôi mới — {$preview} — và cập nhật {$changed['updatedRows']} dòng thông tin phôi trong file này.";
        } elseif ($newCount > 0) {
            $body = "{$actorNoun} vừa thêm {$newCount} phôi mới — {$preview} — trong file này.";
        } else {
            $body = "{$actorNoun} vừa cập nhật {$changed['updatedRows']} dòng thông tin phôi trong file này.";
        }

        $summaryParts = [];
        if ($newCount > 0) {
            $summaryParts[] = "{$newCount} phôi mới";
        }
        if ($changed['updatedRows'] > 0) {
            $summaryParts[] = "{$changed['updatedRows']} dòng cập nhật";
        }

        $data = [
            'filename'        => $changed['filename'],
            // Id của file trong blob thư viện — chuông và mail dựng nút "Mở file"
            // trỏ thẳng tới /library/{file_id}. Trước đây thông báo chỉ có tên
            // file nên người nhận phải tự mò trong danh sách.
            // Có thể rỗng với dữ liệu cũ tạo trước khi mỗi file có id: lúc đó
            // client lùi về tra theo tên (endpoint files/by-name).
            'file_id'         => (string) ($changed['file']['id'] ?? ''),
            'changes_summary' => implode(' · ', $summaryParts),
            'actor_label'     => self::actorLabel($actor),
        ];

        foreach ($recipients as $user) {
            NotificationService::send(
                $user->id,
                'library_updated',
                '📚 File "' . $changed['filename'] . '" vừa được cập nhật',
                $body,
                $data
            );
        }
    }

    private static function notifyMultiFile(array $changedFiles, User $actor): void
    {
        $recipients = collect();
        foreach ($changedFiles as $changed) {
            $recipients = $recipients->merge(self::recipientsFor($changed['file'], $actor));
        }
        $recipients = $recipients->unique('id')->values();

        if ($recipients->isEmpty()) {
            return;
        }

        $actorNoun = self::displayName($actor);
        $count     = count($changedFiles);

        $data = [
            // Cố ý KHÔNG có 'filename': nút trong mail trỏ về trang thư viện gốc
            // thay vì một file cụ thể vì có nhiều file cùng đổi.
            'actor_label' => self::actorLabel($actor),
        ];

        foreach ($recipients as $user) {
            NotificationService::send(
                $user->id,
                'library_updated',
                '📚 Thư viện Vendor vừa cập nhật',
                "{$actorNoun} vừa cập nhật {$count} file trong Thư viện Vendor.",
                $data
            );
        }
    }

    /** @return Collection<int,User> danh sách người nhận duy nhất theo user_id */
    private static function recipientsFor(array $file, User $actor): Collection
    {
        $actorRole  = NotificationEmailPolicy::canonicalRole($actor->role);
        $recipients = collect();

        $recipients = $recipients->merge(
            User::where('role', 'admin')->where('is_active', true)->where('id', '!=', $actor->id)->get()
        );

        if ($actorRole === 'admin') {
            $recipients = $recipients->merge(
                User::where('role', 'vendor')->where('is_active', true)->where('id', '!=', $actor->id)->get()
            );
        }

        $recipients = $recipients->merge(
            User::whereIn('role', ['csf', 'marvel'])->where('is_active', true)->where('id', '!=', $actor->id)->get()
        );

        $sellers = User::where('role', 'seller')->where('is_active', true)->where('id', '!=', $actor->id)->get();
        foreach ($sellers as $seller) {
            $projectKey = strtolower(trim((string) $seller->project));
            if ($projectKey !== '' && VendorLibraryIndexBuilder::fileVisibleToProject($file, $projectKey)) {
                $recipients->push($seller);
            }
        }

        $pds = User::where('role', 'pd')->where('is_active', true)->where('id', '!=', $actor->id)->get();
        foreach ($pds as $pd) {
            $projects = is_array($pd->pd_projects) ? $pd->pd_projects : [];
            foreach ($projects as $project) {
                $projectKey = strtolower(trim((string) $project));
                if ($projectKey !== '' && VendorLibraryIndexBuilder::fileVisibleToProject($file, $projectKey)) {
                    $recipients->push($pd);
                    break; // 1 project khớp là đủ — không lặp thêm cho project khác.
                }
            }
        }

        return $recipients->unique('id')->values();
    }

    private static function displayName(User $user): string
    {
        return $user->full_name ?: $user->name;
    }

    /**
     * Nhãn "Người cập nhật" hiển thị trong thư: TÊN NGƯỜI thật, kèm vai trò
     * trong ngoặc để người nhận biết ngay ai vừa động vào thư viện —
     * vd "Dat Tran (Vendor)", "Uyen Ho (Admin)".
     *
     * Trước đây chỉ ghi trống trơn "Vendor" nên mọi tài khoản Vendor đều hiện
     * như nhau, không truy được người thao tác.
     */
    private static function actorLabel(User $actor): string
    {
        $name = self::displayName($actor);
        $role = NotificationEmailPolicy::canonicalRole($actor->role);

        $roleLabel = match ($role) {
            'admin'  => 'Admin',
            'vendor' => 'Vendor',
            default  => null,
        };

        return $roleLabel ? "{$name} ({$roleLabel})" : $name;
    }

    private static function productTypesPreview(array $newProductTypes): string
    {
        if (empty($newProductTypes)) {
            return '';
        }
        $shown    = array_slice($newProductTypes, 0, 3);
        $preview  = implode(', ', $shown);
        $remaining = count($newProductTypes) - count($shown);
        if ($remaining > 0) {
            $preview .= " và {$remaining} phôi khác";
        }
        return $preview;
    }
}
