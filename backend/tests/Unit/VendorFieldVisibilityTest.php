<?php

namespace Tests\Unit;

use App\Support\VendorFieldVisibility;
use App\Support\VendorLibraryIndexBuilder;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;

/**
 * Mục 17 — "Một chỗ duy nhất quyết định cột nào được hiện cho role nào".
 *
 * Trước đây quy tắc nằm trong 2 component viewer ở frontend; mỗi lần đổi phân
 * quyền phải sửa 2 nơi và dễ sót. Test này chốt hành vi của chỗ duy nhất đó.
 */
#[Group('milestone-d')]
class VendorFieldVisibilityTest extends TestCase
{
    public function test_role_chi_doc_khong_duoc_thay_gia(): void
    {
        foreach (['csf', 'pd', 'marvel', 'CSF', 'Marvel'] as $role) {
            $this->assertFalse(VendorFieldVisibility::seesPrices($role), "role {$role}");
        }
    }

    public function test_role_lam_gia_van_thay_gia(): void
    {
        foreach (['admin', 'seller', 'vendor', 'staff_a', 'staff_b', 'Staff B'] as $role) {
            $this->assertTrue(VendorFieldVisibility::seesPrices($role), "role {$role}");
        }
    }

    /**
     * Danh sách CHO PHÉP, không phải danh sách cấm: role mới thêm vào hệ thống
     * mà quên khai báo thì mặc định KHÔNG thấy giá, chứ không lộ sạch.
     */
    public function test_role_la_hoac_rong_mac_dinh_khong_thay_gia(): void
    {
        foreach ([null, '', 'guest', 'intern', 'staff_z'] as $role) {
            $this->assertFalse(VendorFieldVisibility::seesPrices($role), 'role ' . var_export($role, true));
        }
    }

    public function test_filter_row_bo_sach_khoa_gia_cho_role_chi_doc(): void
    {
        $row = [
            'size'      => 'M',
            'optional'  => 'Basic',
            'pricing1'  => 6.5,
            'eco_price' => 4.2,
            'eco_total' => 10.7,
            'itemCost'  => 6.5,
        ];

        $filtered = VendorFieldVisibility::filterRow($row, 'pd');

        $this->assertSame(['size' => 'M', 'optional' => 'Basic'], $filtered);
    }

    public function test_filter_row_giu_nguyen_cho_role_co_quyen(): void
    {
        $row = ['size' => 'M', 'pricing1' => 6.5];

        $this->assertSame($row, VendorFieldVisibility::filterRow($row, 'seller'));
    }

    /**
     * Mọi trường ship của thư viện phải nằm trong danh sách khoá giá — thêm
     * phương thức ship mới mà quên khai báo là đúng cách rò rỉ giá phát sinh.
     */
    public function test_moi_phuong_thuc_ship_deu_co_du_ba_khoa_gia(): void
    {
        foreach (['eco', 'ground', 'express', 'twoday', 'overnight'] as $method) {
            foreach (["{$method}_price", "{$method}_total", "{$method}_price_item2"] as $field) {
                $this->assertContains(
                    $field,
                    VendorFieldVisibility::PRICE_FIELDS,
                    "thiếu {$field} trong PRICE_FIELDS"
                );
            }
        }
    }

    public function test_visible_size_fields_khop_voi_ket_qua_thuc_te_cua_index(): void
    {
        $files = [[
            'filename' => 'Thu vien P.happy.xlsx',
            'pricing'  => [[
                'kyHieu' => 'HW1', 'productType' => 'T-Shirt', 'size' => 'M',
                'optional' => 'Basic', 'pricing1' => 6.5, 'eco_price' => 4.2,
            ]],
        ]];

        $forPd = VendorLibraryIndexBuilder::build($files, 'happy', VendorFieldVisibility::seesPrices('pd'));
        $this->assertSame(
            ['size', 'optional'],
            array_keys($forPd[0]['sizes'][0]),
            'PD chỉ được nhận các trường phi giá'
        );

        $forSeller = VendorLibraryIndexBuilder::build($files, 'happy', VendorFieldVisibility::seesPrices('seller'));
        $this->assertContains('pricing1', array_keys($forSeller[0]['sizes'][0]));
    }
}
