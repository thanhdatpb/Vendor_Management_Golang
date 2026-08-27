<?php

namespace Tests\Unit;

use Illuminate\Support\Facades\Storage;

/**
 * Xoá đúng file dù URL là local hay R2, trong giai đoạn chuyển tiếp (một số
 * bản ghi cũ trỏ về đĩa server, bản ghi mới trỏ về R2). Đây là chỗ dễ mất dữ
 * liệu nhất trong toàn bộ tính năng R2: xoá NHẦM file khác, hoặc KHÔNG xoá gì
 * cả khi không nhận diện đúng dạng URL.
 */
class MediaDeleteTransitionTest extends \Tests\TestCase
{
    private HandlesMediaStorageHarness $harness;

    protected function setUp(): void
    {
        parent::setUp();
        $this->harness = new HandlesMediaStorageHarness();
        config(['filesystems.disks.s3.url' => 'https://pub-xxxxxxxxxxxxx.r2.dev']);
    }

    public function test_xoa_file_local_dang_duong_dan_tuong_doi(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('products/old.jpg', 'noidung');

        $this->harness->callDeleteMediaByUrl('/storage/products/old.jpg');

        Storage::disk('public')->assertMissing('products/old.jpg');
    }

    public function test_xoa_file_local_dang_url_tuyet_doi(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('vendors/old.jpg', 'noidung');

        $this->harness->callDeleteMediaByUrl('https://vendorhub.viehana.com/storage/vendors/old.jpg');

        Storage::disk('public')->assertMissing('vendors/old.jpg');
    }

    public function test_xoa_file_tren_r2_dang_url_cong_khai(): void
    {
        Storage::fake('s3');
        Storage::disk('s3')->put('vendor-library/new.jpg', 'noidung');

        $this->harness->callDeleteMediaByUrl('https://pub-xxxxxxxxxxxxx.r2.dev/vendor-library/new.jpg');

        Storage::disk('s3')->assertMissing('vendor-library/new.jpg');
    }

    public function test_khong_lam_gi_neu_url_rong(): void
    {
        // Không được ném lỗi khi record cũ không có media_path/url nào.
        $this->harness->callDeleteMediaByUrl(null);
        $this->harness->callDeleteMediaByUrl('');
        $this->addToAssertionCount(1); // chạy tới đây không exception là đạt
    }

    public function test_xoa_file_r2_khong_ton_tai_khong_nem_loi(): void
    {
        Storage::fake('s3');

        // File chưa từng tồn tại (vd đã xoá trước đó) — không được làm sập
        // luồng xoá bản ghi trong DB.
        $this->harness->callDeleteMediaByUrl('https://pub-xxxxxxxxxxxxx.r2.dev/vendor-library/khong-ton-tai.jpg');
        $this->addToAssertionCount(1);
    }
}
