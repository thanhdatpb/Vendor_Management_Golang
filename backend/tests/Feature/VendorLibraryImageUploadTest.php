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
}
