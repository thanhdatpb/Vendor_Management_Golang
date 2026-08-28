<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AuditMediaStorageCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('s3');
        config(['filesystems.disks.s3.url' => 'https://pub-example.r2.dev']);
    }

    public function test_gate_fail_khi_db_con_url_local(): void
    {
        Storage::disk('s3')->put('products/a.jpg', 'ok');
        Product::create([
            'product_type' => 'AOP',
            'total_cost' => 12,
            'status' => 'draft',
            'media_urls' => ['/storage/products/a.jpg'],
        ]);

        $this->artisan('app:audit-media-storage', ['--require-r2-ready' => true])
            ->assertExitCode(1);
    }

    public function test_gate_fail_khi_r2_thieu_object(): void
    {
        Product::create([
            'product_type' => 'AOP',
            'total_cost' => 12,
            'status' => 'draft',
            'media_urls' => ['https://pub-example.r2.dev/products/missing.jpg'],
        ]);

        $this->artisan('app:audit-media-storage', ['--require-r2-ready' => true])
            ->assertExitCode(1);
    }

    public function test_gate_pass_khi_db_sach_va_object_da_co_tren_r2(): void
    {
        Storage::disk('s3')->put('products/a.jpg', 'ok');
        Product::create([
            'product_type' => 'AOP',
            'total_cost' => 12,
            'status' => 'draft',
            'media_path' => 'products/a.jpg',
            'media_urls' => ['https://pub-example.r2.dev/products/a.jpg'],
        ]);

        $this->artisan('app:audit-media-storage', ['--require-r2-ready' => true])
            ->assertExitCode(0);
    }
}
