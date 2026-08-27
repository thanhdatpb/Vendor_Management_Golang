<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Gom logic lưu/xoá/sinh URL cho media (ảnh, video) của Product / Vendor /
 * Vendor Library vào một chỗ, để chuyển giữa ổ đĩa server và object storage
 * (Supabase Storage / Cloudflare R2 / S3) chỉ bằng biến môi trường MEDIA_DISK.
 *
 * MẶC ĐỊNH là 'public' — tức giữ NGUYÊN hành vi cũ (file nằm trên đĩa server,
 * DB lưu đường dẫn tương đối '/storage/...'). Chỉ khi đổi MEDIA_DISK=s3 thì
 * file mới đi lên object storage và DB lưu URL tuyệt đối.
 */
trait HandlesMediaStorage
{
    /** Các thư mục media do ứng dụng quản lý — dùng để tách key ra khỏi URL bất kỳ. */
    protected array $mediaFolders = ['products', 'vendors', 'vendor-library'];

    protected function mediaDisk(): string
    {
        return config('filesystems.media', 'public');
    }

    protected function usesExternalMediaDisk(): bool
    {
        return $this->mediaDisk() !== 'public';
    }

    /** Tên disk object storage (kể cả khi chưa bật MEDIA_DISK, để nhận diện URL đã migrate). */
    protected function externalMediaDisk(): string
    {
        $disk = $this->mediaDisk();

        return $disk === 'public' ? 's3' : $disk;
    }

    /**
     * Base URL công khai của object storage (AWS_URL). Dùng để nhận biết URL nào
     * thuộc object storage — KHÔNG dựa vào việc URL có chứa '/storage/' hay không,
     * vì Supabase có đường dẫn công khai dạng '/storage/v1/object/public/...'
     * sẽ bị nhầm là đường dẫn nội bộ của server.
     */
    protected function externalMediaBaseUrl(): string
    {
        return rtrim((string) config('filesystems.disks.' . $this->externalMediaDisk() . '.url', ''), '/');
    }

    protected function isExternalMediaUrl(string $url): bool
    {
        $base = $this->externalMediaBaseUrl();

        return $base !== '' && str_starts_with($url, $base);
    }

    /**
     * URL ghi vào DB cho một file đã lưu.
     *
     * Disk 'public' trả về đúng dạng tương đối '/storage/...' như code cũ vẫn ghi
     * — không được đổi sang URL tuyệt đối, nếu không dữ liệu mới sẽ lệch định dạng
     * so với toàn bộ dữ liệu cũ đang có trong DB.
     */
    protected function mediaUrlFor(string $path, ?string $disk = null): string
    {
        $disk = $disk ?: $this->mediaDisk();

        return $disk === 'public'
            ? '/storage/' . ltrim($path, '/')
            : Storage::disk($disk)->url($path);
    }

    /**
     * Lưu 1 file upload vào thư mục $folder trên disk đang cấu hình.
     *
     * @return array{path: string, url: string} path = key trên disk, url = giá trị ghi vào DB
     */
    protected function storeMedia(UploadedFile $file, string $folder): array
    {
        $disk = $this->mediaDisk();
        $path = $file->store($folder, $disk);

        return ['path' => $path, 'url' => $this->mediaUrlFor($path, $disk)];
    }

    /**
     * Lưu 1 file đã có sẵn trên đĩa (không phải UploadedFile từ request HTTP —
     * vd file do 1 tiến trình ngoài như script Node.js ghi ra) vào thư mục
     * $folder trên disk đang cấu hình, dùng đúng tên file gốc.
     *
     * @return array{path: string, url: string} path = key trên disk, url = giá trị ghi vào DB
     */
    protected function storeMediaFromPath(string $absolutePath, string $folder): array
    {
        $disk = $this->mediaDisk();
        $path = $folder . '/' . basename($absolutePath);
        Storage::disk($disk)->put($path, file_get_contents($absolutePath));

        return ['path' => $path, 'url' => $this->mediaUrlFor($path, $disk)];
    }

    /**
     * Tách key media (vd 'products/abc.jpg') ra khỏi URL bất kỳ, bằng cách tìm tên
     * thư mục media trong đường dẫn. Cách này không phụ thuộc nhà cung cấp nên vẫn
     * đúng với '/storage/products/x', URL Supabase, URL R2 hay key trần.
     */
    protected function mediaKeyFromAnyUrl(?string $url): ?string
    {
        if (!$url) {
            return null;
        }

        $path = str_starts_with($url, 'http')
            ? (string) (parse_url($url, PHP_URL_PATH) ?: '')
            : $url;
        $path = ltrim($path, '/');

        foreach ($this->mediaFolders as $folder) {
            if (str_starts_with($path, $folder . '/')) {
                return $path;
            }
            $pos = strpos($path, '/' . $folder . '/');
            if ($pos !== false) {
                return substr($path, $pos + 1);
            }
        }

        return null;
    }

    /**
     * Suy ngược key trên một disk cụ thể từ URL đã lưu.
     * Trả null nếu URL không thuộc disk đó.
     */
    protected function mediaKeyFromUrl(string $url, string $disk): ?string
    {
        if ($disk === 'public') {
            // URL của object storage thì không phải file trên đĩa server
            if ($this->isExternalMediaUrl($url)) {
                return null;
            }
            if (str_starts_with($url, 'http')) {
                $path = (string) (parse_url($url, PHP_URL_PATH) ?: '');
                if (!str_contains($path, '/storage/')) {
                    return null;
                }
                return ltrim(substr($path, strpos($path, '/storage/') + strlen('/storage/')), '/');
            }
            return ltrim(str_replace('/storage/', '', $url), '/');
        }

        if (!str_starts_with($url, 'http')) {
            return null; // file cũ trên đĩa server, không nằm trên disk ngoài
        }

        $base = $this->externalMediaBaseUrl();
        if ($base !== '' && str_starts_with($url, $base)) {
            return ltrim(substr($url, strlen($base)), '/');
        }

        return null;
    }

    /**
     * Xoá file vật lý theo URL đã lưu. Tự nhận biết file nằm ở đĩa server hay
     * object storage, nên vẫn xoá đúng trong giai đoạn chuyển tiếp (dữ liệu cũ ở
     * local, dữ liệu mới ở object storage).
     */
    protected function deleteMediaByUrl(?string $url): void
    {
        if (!$url) {
            return;
        }

        if ($this->isExternalMediaUrl($url)) {
            $disk = $this->externalMediaDisk();
            $key = ltrim(substr($url, strlen($this->externalMediaBaseUrl())), '/');
            if ($key !== '') {
                try {
                    Storage::disk($disk)->delete($key);
                } catch (\Throwable $e) {
                    // disk chưa cấu hình đủ — bỏ qua, không chặn luồng xoá bản ghi
                }
            }
            return;
        }

        if (!str_starts_with($url, 'http')) {
            $key = ltrim(str_replace('/storage/', '', $url), '/');
            if ($key !== '') {
                Storage::disk('public')->delete($key);
            }
            return;
        }

        if ($key = $this->mediaKeyFromUrl($url, 'public')) {
            Storage::disk('public')->delete($key);
        }
    }

    /**
     * Chuẩn hoá 1 URL media khi trả về cho client.
     *
     * Giữ nguyên hành vi cũ với dữ liệu local (URL tuyệt đối trỏ về /storage của
     * server được rút về tương đối, để không phụ thuộc tên miền cũ), đồng thời để
     * URL object storage đi qua NGUYÊN VẸN.
     */
    protected function normalizeMediaUrl(string $url): string
    {
        // Kiểm tra object storage TRƯỚC: URL công khai của Supabase cũng chứa
        // '/storage/' nên nếu xét sau sẽ bị cắt nhầm thành đường dẫn nội bộ.
        if ($this->isExternalMediaUrl($url)) {
            return $url;
        }

        if (str_starts_with($url, 'http')) {
            if (str_contains($url, '/storage/')) {
                return substr($url, strpos($url, '/storage/'));
            }
            return $url;
        }

        if (str_starts_with($url, '/storage/')) {
            return $url;
        }

        return '/storage/' . ltrim($url, '/');
    }
}
