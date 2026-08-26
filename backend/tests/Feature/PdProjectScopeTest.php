<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * PD được tách khỏi project: tra cứu thư viện của MỌI project.
 *
 * Cột `project` của tài khoản PD vẫn còn trong DB (không migration, không ai bị
 * đăng xuất) — chỉ là không dùng để phân quyền nữa.
 */
#[Group('role-visibility')]
class PdProjectScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        DB::table('vendor_library')->insert([
            'data' => json_encode([
                [
                    'filename' => 'Thu vien P.happy.xlsx',
                    'pricing'  => [['kyHieu' => 'VN3', 'productType' => 'Football Jersey', 'size' => 'S', 'pricing1' => 8.2]],
                ],
                [
                    'filename' => 'Thu vien P.creative.xlsx',
                    'pricing'  => [['kyHieu' => 'CR7', 'productType' => 'Night Light', 'size' => 'One Size', 'pricing1' => 3.3]],
                ],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** PD gán project Happy nhưng vẫn xem được thư viện của Creative. */
    public function test_pd_xem_duoc_thu_vien_cua_project_khac(): void
    {
        $pd = User::factory()->create(['role' => 'pd', 'project' => 'Happy Project', 'is_active' => true]);

        $records = $this->actingAs($pd)
            ->getJson('/api/vendor-library/index?project=creative')
            ->assertOk()
            ->json();

        $this->assertSame(['Night Light'], collect($records)->pluck('productType')->all());
    }

    /** Không truyền project → thấy hết. */
    public function test_pd_khong_truyen_project_thi_thay_tat_ca(): void
    {
        $pd = User::factory()->create(['role' => 'pd', 'project' => 'Happy Project', 'is_active' => true]);

        $records = $this->actingAs($pd)->getJson('/api/vendor-library/index')->assertOk()->json();

        $this->assertSame(
            ['Football Jersey', 'Night Light'],
            collect($records)->pluck('productType')->sort()->values()->all()
        );
    }

    /** Tài khoản PD không có project cũng dùng được bình thường. */
    public function test_pd_khong_co_project_van_xem_duoc(): void
    {
        $pd = User::factory()->create(['role' => 'pd', 'project' => null, 'is_active' => true]);

        $this->actingAs($pd)->getJson('/api/vendor-library/index')->assertOk()->assertJsonCount(2);
    }

    /** Seller thì KHÔNG được nới phạm vi — quy tắc cũ giữ nguyên. */
    public function test_seller_van_bi_ghim_theo_project(): void
    {
        $seller = User::factory()->create(['role' => 'seller', 'project' => 'happy', 'is_active' => true]);

        $records = $this->actingAs($seller)
            ->getJson('/api/vendor-library/index?project=creative')
            ->assertOk()
            ->json();

        $this->assertSame(['Football Jersey'], collect($records)->pluck('productType')->all());
    }

    // ── Admin tạo / sửa tài khoản PD ────────────────────────────────────────

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'project' => null, 'is_active' => true]);
    }

    /** Tab PD trong màn hình Nhân sự gửi `project: null` — không được 422. */
    public function test_tao_tai_khoan_pd_khong_can_project(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'pd.moi@happyc.test', 'full_name' => 'PD Moi', 'role' => 'pd', 'project' => null,
            ])
            ->assertSuccessful();

        $this->assertDatabaseHas('users', ['email' => 'pd.moi@happyc.test', 'role' => 'pd', 'project' => null]);
    }

    /** Seller thì vẫn bắt buộc có project. */
    public function test_tao_seller_van_bat_buoc_project(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'seller.moi@happyc.test', 'full_name' => 'Seller Moi', 'role' => 'seller', 'project' => null,
            ])
            ->assertStatus(422);
    }

    /**
     * Sửa tên một PD đang có project KHÔNG được âm thầm xoá project đó.
     * Dữ liệu cũ giữ nguyên — đây là điều kiện để không phải chạy migration.
     */
    public function test_sua_pd_khong_xoa_project_dang_co(): void
    {
        $pd = User::factory()->create([
            'role' => 'pd', 'project' => 'Happy Project', 'full_name' => 'Ten Cu', 'is_active' => true,
        ]);

        $this->actingAs($this->admin())
            ->patchJson("/api/admin/users/{$pd->id}", ['full_name' => 'Ten Moi', 'role' => 'pd', 'project' => null])
            ->assertSuccessful();

        $this->assertDatabaseHas('users', [
            'id' => $pd->id, 'full_name' => 'Ten Moi', 'project' => 'Happy Project',
        ]);
    }

    /**
     * Dữ liệu cũ (2 dòng PD cùng email, khác project, tạo từ trước khi PD tách
     * khỏi project) không bị migration nào đụng vào — vẫn nằm nguyên trong DB.
     */
    public function test_du_lieu_pd_cu_nhieu_project_khong_bi_pha(): void
    {
        User::factory()->create(['email' => 'pd@happyc.test', 'role' => 'pd', 'project' => 'Happy Project', 'is_active' => true]);
        User::factory()->create(['email' => 'pd@happyc.test', 'role' => 'pd', 'project' => 'Creative Project', 'is_active' => true]);

        $this->assertSame(2, User::where('email', 'pd@happyc.test')->where('role', 'pd')->count());
    }

    /**
     * TẠO MỚI thì không được cho phép trùng nữa — PD không dùng project để phân
     * biệt tài khoản, nên "PD khác project" giờ chỉ còn là 2 dòng thừa cho cùng
     * một người.
     *
     * Sự cố thật (2026-08-18): 2 dòng PD cùng email hiển thị trùng ở Quản Lý
     * Nhân Sự — và nguy hiểm hơn, nút Khoá chỉ khoá đúng 1 `id`; dòng còn lại
     * vẫn đăng nhập được vì AuthController::login lấy $matched->first() khi
     * trùng role.
     */
    public function test_tao_pd_trung_email_bi_chan_du_khac_project(): void
    {
        User::factory()->create(['email' => 'pd@happyc.test', 'role' => 'pd', 'project' => 'Happy Project', 'is_active' => true]);

        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'pd@happyc.test', 'full_name' => 'PD', 'role' => 'pd', 'project' => 'Creative Project',
            ])
            ->assertStatus(422);

        $this->assertSame(1, User::where('email', 'pd@happyc.test')->where('role', 'pd')->count());
    }

    /** Trùng email + không project (case thường gặp nhất kể từ khi PD bỏ project) cũng bị chặn. */
    public function test_tao_pd_trung_email_bi_chan_khong_project(): void
    {
        User::factory()->create(['email' => 'pd@happyc.test', 'role' => 'pd', 'project' => null, 'is_active' => true]);

        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'pd@happyc.test', 'full_name' => 'PD', 'role' => 'pd', 'project' => null,
            ])
            ->assertStatus(422);
    }

    /** Cùng email nhưng KHÁC role (vd Seller) thì vẫn tạo được — không phải PD nên không đụng quy tắc này. */
    public function test_cung_email_khac_role_van_tao_duoc(): void
    {
        User::factory()->create(['email' => 'dung.chung@happyc.test', 'role' => 'pd', 'project' => null, 'is_active' => true]);

        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'dung.chung@happyc.test', 'full_name' => 'X', 'role' => 'seller', 'project' => 'Happy Project',
            ])
            ->assertSuccessful();
    }

    /** Seller vẫn được trùng email khác project như cũ — quy tắc siết chỉ áp cho PD. */
    public function test_seller_van_duoc_trung_email_khac_project(): void
    {
        User::factory()->create(['email' => 'seller@happyc.test', 'role' => 'seller', 'project' => 'Happy Project', 'is_active' => true]);

        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'seller@happyc.test', 'full_name' => 'Seller', 'role' => 'seller', 'project' => 'Creative Project',
            ])
            ->assertSuccessful();

        $this->assertSame(2, User::where('email', 'seller@happyc.test')->where('role', 'seller')->count());
    }

    // ── `pd_projects` — checkbox chọn project truy cập ở Quản Lý Nhân Sự ────
    // PD một số người làm 2+ project cùng lúc: Admin tick chọn project nào
    // PD đó được xem, lưu vào cột `pd_projects` (khác `project` ở trên, vốn
    // không dùng để phân quyền PD nữa). Sidebar PdDashboard chỉ hiện đúng các
    // project được tick.

    /** Tạo PD kèm pd_projects — lưu đúng, trả về đúng trong response tạo mới. */
    public function test_tao_pd_kem_pd_projects_luu_dung(): void
    {
        $response = $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'pd.multi@happyc.test', 'full_name' => 'PD Multi', 'role' => 'pd',
                'pd_projects' => ['Happy Project', 'Global Project'],
            ])
            ->assertSuccessful();

        $response->assertJsonPath('user.pd_projects', ['Happy Project', 'Global Project']);
        $this->assertDatabaseHas('users', ['email' => 'pd.multi@happyc.test', 'role' => 'pd']);
        $saved = User::where('email', 'pd.multi@happyc.test')->first();
        $this->assertSame(['Happy Project', 'Global Project'], $saved->pd_projects);
    }

    /** Không gửi pd_projects → mặc định rỗng, không lỗi 422. */
    public function test_tao_pd_khong_gui_pd_projects_mac_dinh_rong(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'pd.rong@happyc.test', 'full_name' => 'PD Rong', 'role' => 'pd',
            ])
            ->assertSuccessful();

        $saved = User::where('email', 'pd.rong@happyc.test')->first();
        $this->assertSame([], $saved->pd_projects);
    }

    /** Tên project không hợp lệ trong pd_projects → 422, không tạo tài khoản. */
    public function test_tao_pd_pd_projects_sai_ten_bi_tu_choi(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'pd.sai@happyc.test', 'full_name' => 'PD Sai', 'role' => 'pd',
                'pd_projects' => ['Happy Project', 'Project Khong Ton Tai'],
            ])
            ->assertStatus(422);

        $this->assertDatabaseMissing('users', ['email' => 'pd.sai@happyc.test']);
    }

    /** Sửa PD: cập nhật đúng danh sách pd_projects mới. */
    public function test_sua_pd_cap_nhat_pd_projects(): void
    {
        $pd = User::factory()->create([
            'role' => 'pd', 'full_name' => 'PD Cu', 'pd_projects' => ['Happy Project'], 'is_active' => true,
        ]);

        $this->actingAs($this->admin())
            ->patchJson("/api/admin/users/{$pd->id}", [
                'full_name' => 'PD Cu', 'role' => 'pd', 'pd_projects' => ['Creative Project', 'Hapify84 Project'],
            ])
            ->assertSuccessful();

        $this->assertSame(['Creative Project', 'Hapify84 Project'], $pd->fresh()->pd_projects);
    }

    /**
     * "Share thêm" — giống thêm quyền truy cập file Drive: PD đã có Happy,
     * Admin tick thêm Global → cả 2 cùng còn, không mất Happy.
     */
    public function test_sua_pd_share_them_1_project_giu_nguyen_project_cu(): void
    {
        $pd = User::factory()->create(['role' => 'pd', 'pd_projects' => ['Happy Project'], 'is_active' => true]);

        $this->actingAs($this->admin())
            ->patchJson("/api/admin/users/{$pd->id}", [
                'role' => 'pd', 'pd_projects' => ['Happy Project', 'Global Project'],
            ])
            ->assertSuccessful();

        $this->assertSame(['Happy Project', 'Global Project'], $pd->fresh()->pd_projects);
    }

    /**
     * "Thu hồi 1 quyền" — giống bỏ share 1 file Drive nhưng vẫn giữ share file
     * khác: PD có Happy+Creative+Global, Admin bỏ tick Creative → chỉ mất
     * đúng Creative, Happy và Global còn nguyên (không phải xoá sạch rồi tạo lại).
     */
    public function test_sua_pd_thu_hoi_1_project_giu_nguyen_cac_project_con_lai(): void
    {
        $pd = User::factory()->create([
            'role' => 'pd', 'pd_projects' => ['Happy Project', 'Creative Project', 'Global Project'], 'is_active' => true,
        ]);

        $this->actingAs($this->admin())
            ->patchJson("/api/admin/users/{$pd->id}", [
                'role' => 'pd', 'pd_projects' => ['Happy Project', 'Global Project'],
            ])
            ->assertSuccessful();

        $this->assertSame(['Happy Project', 'Global Project'], $pd->fresh()->pd_projects);
    }

    /**
     * Thu hồi HẾT → còn mảng rỗng (không phải null lơ lửng gây lỗi cast ở FE),
     * và PD đó (giả lập đăng nhập lại) không còn thấy project nào — giống thu
     * hồi hết quyền truy cập Drive, không xoá tài khoản.
     */
    public function test_sua_pd_thu_hoi_het_project_con_lai_mang_rong(): void
    {
        $pd = User::factory()->create([
            'role' => 'pd', 'email' => 'pd.thuhoihet@happyc.test',
            'pd_projects' => ['Happy Project', 'Creative Project'],
            'password' => bcrypt('matkhau123'), 'is_active' => true,
        ]);

        $this->actingAs($this->admin())
            ->patchJson("/api/admin/users/{$pd->id}", ['role' => 'pd', 'pd_projects' => []])
            ->assertSuccessful();

        $this->assertSame([], $pd->fresh()->pd_projects);

        // Đăng nhập lại → payload phản ánh đúng: đã bị thu hồi hết, không phải lỗi ẩn.
        $login = $this->postJson('/api/login', ['email' => $pd->email, 'password' => 'matkhau123'])->assertOk();
        $login->assertJsonPath('user.pd_projects', []);
    }

    /** Sửa PD chỉ đổi tên (không gửi pd_projects) → giữ nguyên danh sách cũ. */
    public function test_sua_pd_khong_gui_pd_projects_giu_nguyen(): void
    {
        $pd = User::factory()->create([
            'role' => 'pd', 'full_name' => 'Ten Cu', 'pd_projects' => ['Happy Project', 'Global Project'], 'is_active' => true,
        ]);

        $this->actingAs($this->admin())
            ->patchJson("/api/admin/users/{$pd->id}", ['full_name' => 'Ten Moi', 'role' => 'pd'])
            ->assertSuccessful();

        $fresh = $pd->fresh();
        $this->assertSame('Ten Moi', $fresh->full_name);
        $this->assertSame(['Happy Project', 'Global Project'], $fresh->pd_projects);
    }

    /** GET /api/admin/users trả pd_projects cho từng dòng PD. */
    public function test_index_tra_ve_pd_projects(): void
    {
        User::factory()->create(['role' => 'pd', 'full_name' => 'PD A', 'pd_projects' => ['Creative Project'], 'is_active' => true]);

        $rows = $this->actingAs($this->admin())->getJson('/api/admin/users')->assertOk()->json('users');
        $row = collect($rows)->firstWhere('full_name', 'PD A');

        $this->assertSame(['Creative Project'], $row['pd_projects']);
    }

    /** Login trả về pd_projects trong user payload — PdDashboard cần field này để lọc sidebar. */
    public function test_login_tra_ve_pd_projects_trong_payload(): void
    {
        $pd = User::factory()->create([
            'role' => 'pd', 'email' => 'pd.login@happyc.test', 'pd_projects' => ['Global Project'],
            'password' => bcrypt('matkhau123'), 'is_active' => true,
        ]);

        $response = $this->postJson('/api/login', ['email' => $pd->email, 'password' => 'matkhau123'])->assertOk();

        $response->assertJsonPath('user.pd_projects', ['Global Project']);
    }
}
