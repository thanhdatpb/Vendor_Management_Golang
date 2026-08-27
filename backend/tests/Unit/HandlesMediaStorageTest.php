<?php

namespace Tests\Unit;

use App\Support\HandlesMediaStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Class test dùng trait để gọi trực tiếp — trait không tự đứng được, cần một
 * lớp cụ thể (giống hệt cách ProductController/VendorController/
 * VendorLibraryController đang dùng).
 */
class HandlesMediaStorageHarness
{
    use HandlesMediaStorage;

    public function callMediaUrlFor(string $path, ?string $disk = null): string
    {
        return $this->mediaUrlFor($path, $disk);
    }

    public function callStoreMedia(UploadedFile $file, string $folder): array
    {
        return $this->storeMedia($file, $folder);
    }

    public function callMediaKeyFromAnyUrl(?string $url): ?string
    {
        return $this->mediaKeyFromAnyUrl($url);
    }

    public function callDeleteMediaByUrl(?string $url): void
    {
        $this->deleteMediaByUrl($url);
    }

    public function callNormalizeMediaUrl(string $url): string
    {
        return $this->normalizeMediaUrl($url);
    }
}

/**
 * `MEDIA_DISK=public` phải sinh URL Y HỆT code cũ trước khi có trait này —
 * đổi định dạng sẽ làm lệch toàn bộ dữ liệu media_url/media_urls đang có
 * trong DB (chúng đều là chuỗi '/storage/...' tương đối).
 */
class HandlesMediaStorageTest extends \Tests\TestCase
{
    private HandlesMediaStorageHarness $harness;

    protected function setUp(): void
    {
        parent::setUp();
        $this->harness = new HandlesMediaStorageHarness();
    }

    public function test_disk_public_sinh_url_tuong_doi_nhu_cu(): void
    {
        config(['filesystems.media' => 'public']);

        $this->assertSame('/storage/products/abc.jpg', $this->harness->callMediaUrlFor('products/abc.jpg'));
    }

    public function test_disk_s3_sinh_url_theo_cau_hinh_aws_url(): void
    {
        config([
            'filesystems.media' => 's3',
            'filesystems.disks.s3.url' => 'https://pub-xxxx.r2.dev',
        ]);
        Storage::fake('s3');

        $url = $this->harness->callMediaUrlFor('products/abc.jpg', 's3');

        $this->assertStringContainsString('products/abc.jpg', $url);
    }

    public function test_store_media_tra_ve_ca_path_lan_url(): void
    {
        config(['filesystems.media' => 'public']);
        Storage::fake('public');

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
        $file = UploadedFile::fake()->createWithContent('photo.jpg', $png);
        $result = $this->harness->callStoreMedia($file, 'products');

        $this->assertArrayHasKey('path', $result);
        $this->assertArrayHasKey('url', $result);
        $this->assertStringStartsWith('products/', $result['path']);
        $this->assertStringStartsWith('/storage/products/', $result['url']);
        Storage::disk('public')->assertExists($result['path']);
    }
}
