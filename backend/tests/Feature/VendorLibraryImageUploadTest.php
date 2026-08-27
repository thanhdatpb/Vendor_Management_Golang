<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class VendorLibraryImageUploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_excel_image_upload_returns_authenticated_image_endpoint(): void
    {
        Storage::fake('public');
        config(['app.url' => 'http://localhost']);

        $vendor = User::factory()->create(['role' => 'vendor', 'is_active' => true]);
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
        $response = $this->actingAs($vendor)->post('/api/vendor-library/upload-images', [
            'images' => [UploadedFile::fake()->createWithContent('croptop.png', $png)],
        ]);

        $response->assertOk();
        $url = $response->json('urls.0');

        $this->assertStringStartsWith('/api/vendor-library/images/', $url);
        $this->assertStringNotContainsString('localhost', $url);
        $filename = basename($url);
        Storage::disk('public')->assertExists('vendor-library/' . $filename);


        $this->actingAs($vendor)->get($url)->assertOk();
    }

    public function test_excel_image_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/vendor-library/images/missing.png')->assertUnauthorized();
    }

    /**
     * Sau khi bật MEDIA_DISK=s3 (R2), ảnh Thư Viện Vendor vẫn phải đi qua
     * ĐÚNG route xác thực này — không được lộ URL R2 công khai. Đây là điều
     * kiện sống còn của "Hướng A" (xem docs/CLOUDFLARE_R2_SETUP.md và kế
     * hoạch port): PR #264/266/268 đã siết ảnh Excel phải đăng nhập mới xem
     * được, R2 không được phép làm mất lại việc đó.
     */
    public function test_voi_media_disk_s3_van_qua_route_xac_thuc(): void
    {
        Storage::fake('s3');
        config(['filesystems.media' => 's3', 'filesystems.disks.s3.url' => 'https://pub-xxxxxxxxxxxxx.r2.dev']);

        $vendor = User::factory()->create(['role' => 'vendor', 'is_active' => true]);
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');

        $response = $this->actingAs($vendor)->post('/api/vendor-library/upload-images', [
            'images' => [UploadedFile::fake()->createWithContent('croptop.png', $png)],
        ]);

        $response->assertOk();
        $url = $response->json('urls.0');

        // URL trả về vẫn phải là route Laravel, KHÔNG PHẢI URL R2 trực tiếp.
        $this->assertStringStartsWith('/api/vendor-library/images/', $url);
        $this->assertStringNotContainsString('r2.dev', $url);

        $filename = basename($url);
        Storage::disk('s3')->assertExists('vendor-library/' . $filename);

        // Có đăng nhập mới tải được, dù file thật sự nằm trên R2. Yêu cầu
        // đăng nhập của route này (bất kể disk) đã được khoá riêng ở test
        // `test_excel_image_endpoint_requires_authentication` phía trên.
        $this->actingAs($vendor)->get($url)->assertOk();
    }
}
