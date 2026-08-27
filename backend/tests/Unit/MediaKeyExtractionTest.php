<?php

namespace Tests\Unit;

/**
 * `mediaKeyFromAnyUrl()` là chỗ suy ngược key media (vd 'products/abc.jpg') từ
 * BẤT KỲ dạng URL nào đang tồn tại trong DB — dữ liệu cũ (trước R2) và dữ liệu
 * mới (sau R2) trộn lẫn nhau trong giai đoạn chuyển tiếp, nên phải nhận đúng
 * cả 2 dạng cùng lúc.
 */
class MediaKeyExtractionTest extends \Tests\TestCase
{
    private HandlesMediaStorageHarness $harness;

    protected function setUp(): void
    {
        parent::setUp();
        $this->harness = new HandlesMediaStorageHarness();
    }

    public function test_duong_dan_storage_tuong_doi(): void
    {
        $this->assertSame(
            'products/abc.jpg',
            $this->harness->callMediaKeyFromAnyUrl('/storage/products/abc.jpg')
        );
    }

    public function test_url_tuyet_doi_domain_cu(): void
    {
        $this->assertSame(
            'vendors/xyz.png',
            $this->harness->callMediaKeyFromAnyUrl('https://vendorhub.viehana.com/storage/vendors/xyz.png')
        );
    }

    public function test_url_r2_cong_khai(): void
    {
        $this->assertSame(
            'vendor-library/abc123.png',
            $this->harness->callMediaKeyFromAnyUrl('https://pub-xxxxxxxxxxxxx.r2.dev/vendor-library/abc123.png')
        );
    }

    public function test_key_tran_khong_co_tien_to(): void
    {
        $this->assertSame(
            'products/def456.jpg',
            $this->harness->callMediaKeyFromAnyUrl('products/def456.jpg')
        );
    }

    public function test_url_khong_thuoc_thu_muc_media_nao_tra_ve_null(): void
    {
        $this->assertNull($this->harness->callMediaKeyFromAnyUrl('https://cdn.example.com/random/abc.jpg'));
    }

    public function test_null_tra_ve_null(): void
    {
        $this->assertNull($this->harness->callMediaKeyFromAnyUrl(null));
    }
}
