<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * `library_updated` — loại mới của kế hoạch thông báo email (2026-09). Người
 * nhận theo đúng ma trận đã duyệt:
 *   Admin/CSF/Marvel : mọi file, mọi actor — trừ chính actor. Vendor chỉ khi
 *                       actor là Admin. Seller/PD lọc theo project họ phụ trách,
 *                       nhưng PD phụ trách nhiều project vẫn chỉ 1 thông báo.
 */
class LibraryUpdatedNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role'      => $role,
            'is_active' => true,
        ], $overrides));
    }

    private function seedLibrary(array $files): void
    {
        DB::table('vendor_library')->insert([
            'data'       => json_encode($files, JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function row(array $overrides = []): array
    {
        return array_merge([
            'productType' => 'Ceramic Mug 11oz',
            'kyHieu'      => 'A',
            'size'        => 'One Size',
            'eco_total'   => 13.20,
        ], $overrides);
    }

    public function test_vendor_import_bao_cho_admin_csf_marvel_va_seller_dung_project(): void
    {
        $vendor        = $this->makeUser('vendor', ['full_name' => 'Dat Tran']);
        $otherVendor   = $this->makeUser('vendor');
        $admin         = $this->makeUser('admin');
        $csf           = $this->makeUser('csf');
        $marvel        = $this->makeUser('marvel');
        $sellerHappy   = $this->makeUser('seller', ['project' => 'Happy Project']);
        $sellerGlobal  = $this->makeUser('seller', ['project' => 'Global Project']);

        $newFile = [
            'filename' => 'P.HAPPY.xlsx',
            'projects' => ['happy'],
            'pricing'  => [$this->row()],
        ];

        $this->actingAs($vendor)->postJson('/api/vendor-library', [$newFile])->assertOk();

        // Admin, CSF, Marvel, Seller đúng project đều nhận — Vendor (kể cả người
        // khác) và Seller sai project thì không.
        foreach ([$admin, $csf, $marvel, $sellerHappy] as $expected) {
            $this->assertDatabaseHas('notifications', [
                'user_id' => $expected->id,
                'type'    => 'library_updated',
            ]);
        }
        $this->assertDatabaseMissing('notifications', ['user_id' => $vendor->id, 'type' => 'library_updated']);
        $this->assertDatabaseMissing('notifications', ['user_id' => $otherVendor->id, 'type' => 'library_updated']);
        $this->assertDatabaseMissing('notifications', ['user_id' => $sellerGlobal->id, 'type' => 'library_updated']);

        $n = Notification::where('user_id', $admin->id)->where('type', 'library_updated')->first();
        $data = json_decode($n->data, true);
        $this->assertSame('P.HAPPY.xlsx', $data['filename']);
        // Nhãn người cập nhật phải là TÊN NGƯỜI thật kèm vai trò — không phải
        // mỗi chữ "Vendor" chung chung (mọi tài khoản Vendor sẽ hiện như nhau).
        $this->assertSame('Dat Tran (Vendor)', $data['actor_label']);
        $this->assertStringContainsString('Dat Tran vừa thêm 1 phôi mới', $n->body);
        $this->assertStringContainsString('Ceramic Mug 11oz', $n->body);
    }

    public function test_admin_import_thi_vendor_duoc_bao_va_actor_label_ghi_ten_admin(): void
    {
        $admin  = $this->makeUser('admin', ['full_name' => 'Minh Trí']);
        $vendor = $this->makeUser('vendor');

        $newFile = [
            'filename' => 'P.GLOBAL.xlsx',
            'projects' => ['global'],
            'pricing'  => [$this->row(['productType' => 'Tote Bag'])],
        ];

        $this->actingAs($admin)->postJson('/api/vendor-library', [$newFile])->assertOk();

        $this->assertDatabaseHas('notifications', ['user_id' => $vendor->id, 'type' => 'library_updated']);

        $n = Notification::where('user_id', $vendor->id)->where('type', 'library_updated')->first();
        $data = json_decode($n->data, true);
        $this->assertSame('Minh Trí (Admin)', $data['actor_label']);
        $this->assertStringContainsString('Minh Trí vừa thêm', $n->body);

        // Actor Admin không tự báo cho chính mình.
        $this->assertDatabaseMissing('notifications', ['user_id' => $admin->id, 'type' => 'library_updated']);
    }

    public function test_pd_phu_trach_nhieu_project_van_chi_nhan_dung_1_thong_bao(): void
    {
        $admin = $this->makeUser('admin');
        $pd = $this->makeUser('pd', ['pd_projects' => ['Happy Project', 'Global Project']]);

        // File chia sẻ cho CẢ Happy lẫn Global — PD phụ trách cả hai vẫn chỉ 1 thông báo.
        $newFile = [
            'filename' => 'P.SHARED.xlsx',
            'projects' => ['happy', 'global'],
            'pricing'  => [$this->row()],
        ];

        $this->actingAs($admin)->postJson('/api/vendor-library', [$newFile])->assertOk();

        $this->assertSame(
            1,
            Notification::where('user_id', $pd->id)->where('type', 'library_updated')->count(),
            'PD phụ trách nhiều project khớp cùng 1 file vẫn chỉ 1 thông báo'
        );
    }

    public function test_pd_khong_phu_trach_project_cua_file_thi_khong_nhan(): void
    {
        $admin = $this->makeUser('admin');
        $pd = $this->makeUser('pd', ['pd_projects' => ['Creative Project']]);

        $newFile = [
            'filename' => 'P.HAPPY.xlsx',
            'projects' => ['happy'],
            'pricing'  => [$this->row()],
        ];

        $this->actingAs($admin)->postJson('/api/vendor-library', [$newFile])->assertOk();

        $this->assertDatabaseMissing('notifications', ['user_id' => $pd->id, 'type' => 'library_updated']);
    }

    public function test_csf_va_marvel_nhan_ca_file_chi_chia_se_cho_1_project(): void
    {
        $admin  = $this->makeUser('admin');
        $csf    = $this->makeUser('csf');
        $marvel = $this->makeUser('marvel');

        $newFile = [
            'filename' => 'P.CREATIVE.xlsx',
            'projects' => ['creative'],
            'pricing'  => [$this->row()],
        ];

        $this->actingAs($admin)->postJson('/api/vendor-library', [$newFile])->assertOk();

        $this->assertDatabaseHas('notifications', ['user_id' => $csf->id, 'type' => 'library_updated']);
        $this->assertDatabaseHas('notifications', ['user_id' => $marvel->id, 'type' => 'library_updated']);
    }

    public function test_luu_lai_du_lieu_giong_het_khong_tao_thong_bao_nao(): void
    {
        $admin = $this->makeUser('admin');
        $this->makeUser('csf');

        $file = ['filename' => 'P.HAPPY.xlsx', 'projects' => ['happy'], 'pricing' => [$this->row()]];
        $this->seedLibrary([$file]);

        $this->actingAs($admin)->postJson('/api/vendor-library', [$file])->assertOk();

        $this->assertSame(0, Notification::where('type', 'library_updated')->count());
    }

    public function test_hon_3_file_doi_gop_thanh_1_thong_bao_khong_gan_filename(): void
    {
        $admin = $this->makeUser('admin');
        $csf   = $this->makeUser('csf');

        $files = [];
        for ($i = 1; $i <= 4; $i++) {
            $files[] = [
                'filename' => "P.FILE{$i}.xlsx",
                'projects' => [],
                'pricing'  => [$this->row(['productType' => "Product {$i}"])],
            ];
        }

        $this->actingAs($admin)->postJson('/api/vendor-library', $files)->assertOk();

        $this->assertSame(
            1,
            Notification::where('user_id', $csf->id)->where('type', 'library_updated')->count(),
            'Hơn 3 file đổi cùng lúc phải gộp thành 1 thông báo, không phải 4'
        );

        $n = Notification::where('user_id', $csf->id)->where('type', 'library_updated')->first();
        $data = json_decode($n->data, true);
        $this->assertArrayNotHasKey('filename', $data, 'Thông báo gộp không gắn 1 file cụ thể');
        $this->assertStringContainsString('4 file', $n->body);
    }

    public function test_them_size_moi_cho_phoi_da_co_khong_bi_tinh_la_phoi_moi_trong_thong_bao(): void
    {
        $admin = $this->makeUser('admin');
        $csf   = $this->makeUser('csf');

        $oldFile = ['filename' => 'P.HAPPY.xlsx', 'projects' => ['happy'], 'pricing' => [$this->row(['size' => 'One Size'])]];
        $this->seedLibrary([$oldFile]);

        $newFile = [
            'filename' => 'P.HAPPY.xlsx',
            'projects' => ['happy'],
            'pricing'  => [
                $this->row(['size' => 'One Size']),
                $this->row(['size' => 'S/M/L']),
            ],
        ];

        $this->actingAs($admin)->postJson('/api/vendor-library', [$newFile])->assertOk();

        $n = Notification::where('user_id', $csf->id)->where('type', 'library_updated')->first();
        $this->assertStringNotContainsString('phôi mới', $n->body);
        $this->assertStringContainsString('cập nhật 1 dòng thông tin phôi', $n->body);
    }
}
