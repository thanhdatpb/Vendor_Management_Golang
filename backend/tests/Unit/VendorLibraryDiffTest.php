<?php

namespace Tests\Unit;

use App\Support\VendorLibraryDiff;
use Tests\TestCase;

/**
 * `saveLibrary()` ghi đè nguyên blob JSON, server không tự biết file nào vừa
 * đổi. VendorLibraryDiff::changedFiles() là nơi DUY NHẤT tính ra "file nào,
 * đổi gì" — nội dung notification `library_updated` phụ thuộc trực tiếp vào
 * kết quả này, nên phải đúng ở từng trường hợp biên.
 */
class VendorLibraryDiffTest extends TestCase
{
    private function row(array $overrides = []): array
    {
        return array_merge([
            'productType' => 'Ceramic Mug 11oz',
            'kyHieu'      => 'A',
            'size'        => 'One Size',
            'eco_total'   => 13.20,
        ], $overrides);
    }

    private function file(string $filename, array $pricing, array $extra = []): array
    {
        return array_merge([
            'filename' => $filename,
            'pricing'  => $pricing,
        ], $extra);
    }

    public function test_file_hoan_toan_moi_toan_bo_record_la_phoi_moi(): void
    {
        $newFile = $this->file('P.HAPPY.xlsx', [
            $this->row(['productType' => 'Ceramic Mug 11oz']),
            $this->row(['productType' => 'Ceramic Vase 8 inch', 'kyHieu' => 'B']),
        ]);

        $changed = VendorLibraryDiff::changedFiles([], [$newFile]);

        $this->assertCount(1, $changed);
        $this->assertSame('P.HAPPY.xlsx', $changed[0]['filename']);
        $this->assertEqualsCanonicalizing(
            ['Ceramic Mug 11oz', 'Ceramic Vase 8 inch'],
            $changed[0]['newProductTypes']
        );
        $this->assertSame(0, $changed[0]['updatedRows'], 'Phôi mới không được tính vào dòng cập nhật');
    }

    public function test_them_1_phoi_moi_vao_file_da_co(): void
    {
        $oldFile = $this->file('P.HAPPY.xlsx', [$this->row()]);
        $newFile = $this->file('P.HAPPY.xlsx', [
            $this->row(),
            $this->row(['productType' => 'Ceramic Vase 8 inch', 'kyHieu' => 'B']),
        ]);

        $changed = VendorLibraryDiff::changedFiles([$oldFile], [$newFile]);

        $this->assertCount(1, $changed);
        $this->assertSame(['Ceramic Vase 8 inch'], $changed[0]['newProductTypes']);
        $this->assertSame(0, $changed[0]['updatedRows']);
    }

    public function test_doi_gia_1_dong_da_co_tinh_la_1_dong_cap_nhat(): void
    {
        $oldFile = $this->file('P.HAPPY.xlsx', [$this->row(['eco_total' => 13.20])]);
        $newFile = $this->file('P.HAPPY.xlsx', [$this->row(['eco_total' => 14.00])]);

        $changed = VendorLibraryDiff::changedFiles([$oldFile], [$newFile]);

        $this->assertCount(1, $changed);
        $this->assertSame([], $changed[0]['newProductTypes']);
        $this->assertSame(1, $changed[0]['updatedRows']);
    }

    public function test_them_size_moi_cho_record_da_co_tinh_la_dong_cap_nhat_khong_phai_phoi_moi(): void
    {
        $oldFile = $this->file('P.HAPPY.xlsx', [$this->row(['size' => 'One Size'])]);
        $newFile = $this->file('P.HAPPY.xlsx', [
            $this->row(['size' => 'One Size']),
            $this->row(['size' => 'S/M/L']),
        ]);

        $changed = VendorLibraryDiff::changedFiles([$oldFile], [$newFile]);

        $this->assertCount(1, $changed);
        $this->assertSame([], $changed[0]['newProductTypes'], 'Cùng record cũ, chỉ thêm size — không phải phôi mới');
        $this->assertSame(1, $changed[0]['updatedRows']);
    }

    public function test_doi_id_nhung_noi_dung_giong_het_khong_tinh_la_thay_doi(): void
    {
        $oldFile = $this->file('P.HAPPY.xlsx', [$this->row(['id' => 'row-1'])]);
        $newFile = $this->file('P.HAPPY.xlsx', [$this->row(['id' => 'row-2'])]);

        $changed = VendorLibraryDiff::changedFiles([$oldFile], [$newFile]);

        $this->assertCount(0, $changed, 'Chỉ đổi id do client sinh lại — không phải thay đổi nội dung thật');
    }

    public function test_khong_dong_nao_doi_thi_khong_co_file_nao_trong_danh_sach(): void
    {
        $file = $this->file('P.HAPPY.xlsx', [$this->row()]);

        $changed = VendorLibraryDiff::changedFiles([$file], [$file]);

        $this->assertSame([], $changed);
    }

    public function test_file_khong_doi_bi_bo_qua_file_khac_doi_van_duoc_bao_cao(): void
    {
        $unchangedFile = $this->file('P.GLOBAL.xlsx', [$this->row(['productType' => 'Tote Bag'])]);
        $oldChangedFile = $this->file('P.HAPPY.xlsx', [$this->row(['eco_total' => 10.00])]);
        $newChangedFile = $this->file('P.HAPPY.xlsx', [$this->row(['eco_total' => 11.00])]);

        $changed = VendorLibraryDiff::changedFiles(
            [$unchangedFile, $oldChangedFile],
            [$unchangedFile, $newChangedFile]
        );

        $this->assertCount(1, $changed);
        $this->assertSame('P.HAPPY.xlsx', $changed[0]['filename']);
    }

    public function test_hai_ky_hieu_khac_nhau_cung_ten_phoi_la_2_record_rieng(): void
    {
        $oldFile = $this->file('P.HAPPY.xlsx', [$this->row(['kyHieu' => 'A'])]);
        $newFile = $this->file('P.HAPPY.xlsx', [
            $this->row(['kyHieu' => 'A']),
            $this->row(['kyHieu' => 'B']),
        ]);

        $changed = VendorLibraryDiff::changedFiles([$oldFile], [$newFile]);

        $this->assertCount(1, $changed);
        $this->assertSame(['Ceramic Mug 11oz'], $changed[0]['newProductTypes'], 'kyHieu B là record mới dù trùng tên phôi');
    }

    public function test_file_thieu_ten_bi_bo_qua_hoan_toan(): void
    {
        $newFile = $this->file('', [$this->row()]);

        $changed = VendorLibraryDiff::changedFiles([], [$newFile]);

        $this->assertSame([], $changed);
    }
}
