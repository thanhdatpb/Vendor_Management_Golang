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

    public function test_excel_image_upload_returns_same_origin_storage_url(): void
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

        $this->assertStringStartsWith('/storage/vendor-library/', $url);
        $this->assertStringNotContainsString('localhost', $url);
        Storage::disk('public')->assertExists(str_replace('/storage/', '', $url));
    }
}
