<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Integration test: toàn bộ vòng đời "Product Request" qua 3 role.
 *
 * Roles:
 *  - seller  (role = seller) : tạo request, xem vendor đã gán
 *  - admin   (role = admin)  : duyệt / từ chối
 *  - vendor  (role = vendor) : gán vendor (phôi) từ thư viện
 *
 * ────────────────────────────────────────────
 * LƯU Ý RESPONSE FORMAT (quan trọng):
 *  - store()  → response()->json($product, 201)          // product ở root
 *  - show()   → response()->json(['success'=>true,'data'=>$product])  // có 'data' wrapper
 *  - approvedProducts() → response()->json(['data'=>$collection])     // có 'data' wrapper
 *  - assignVendors() → response()->json(['success'=>true,'assigned_vendors'=>...])
 * ────────────────────────────────────────────
 */
class ProductRequestLifecycleTest extends TestCase
{
    use RefreshDatabase;

    // ──────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────

    private function makeUser(string $role, string $suffix = ''): User
    {
        return User::factory()->create([
            'role'      => $role,
            'name'      => "{$role}{$suffix}",
            'email'     => "{$role}{$suffix}@test.com",
            'password'  => bcrypt('secret'),
            'is_active' => true,
        ]);
    }

    /**
     * Tạo product qua HTTP API (store endpoint).
     * Trả về array từ response JSON (product ở root, không có wrapper).
     */
    private function createDraftProduct(User $seller, array $overrides = []): array
    {
        $payload = array_merge([
            'product_type'    => 'AOP',
            'total_cost'      => 12.00,
            'material'        => 'Cotton',
            'print_area'      => 'Front',
            'production_time' => '1-3',
            'shipping_time'   => '3-5',
            'good_review'     => 'Nice quality',
            'bad_review'      => 'None',
        ], $overrides);

        $response = $this->actingAs($seller)->postJson('/api/products', $payload);
        $response->assertStatus(201);
        return $response->json();
    }

    /**
     * Xây dựng 1 vendor object như khi Staff B copy từ thư viện Excel.
     * Đây là "dòng giá" thật sự được lưu vào assigned_vendors JSON.
     */
    private function makeLibraryVendorRow(array $overrides = []): array
    {
        return array_merge([
            'id'              => 'lib_vn3_A_OneSize',
            'name'            => 'VN3',
            'vendor_type'     => 'AOP CAP',
            'kyHieu'          => 'A',
            'size'            => 'One Size',
            'overview'        => 'Poly Fabric with Nylon Mesh',
            'link_folder'     => 'https://drive.google.com/vn3-folder',
            'source_file_id'  => 'file_hc_cap_001',
            // Pricing tiers — copy đúng từ thư viện, không nhập tay lại
            'eco_price'       => 11.00,
            'eco_total'       => 13.20,
            'ground_total'    => 14.50,
            'fast_total'      => 16.00,
            'express_total'   => 18.00,
            'overnight_total' => 22.00,
        ], $overrides);
    }

    /**
     * Đọc product qua GET /api/products/{id}.
     * show() trả về ['success'=>true, 'data'=>$product] → lấy từ 'data'.
     */
    private function getProduct(User $user, int $productId): array
    {
        return $this->actingAs($user)
            ->getJson("/api/products/{$productId}")
            ->assertStatus(200)
            ->json('data');
    }

    // ══════════════════════════════════════════
    // CASE 1 — HAPPY PATH
    // Seller tạo → Admin duyệt → Vendor gán 1 dòng giá → Seller đọc đúng giá
    // (không nhập tay, giá lấy trực tiếp từ thư viện)
    // ══════════════════════════════════════════

    public function test_happy_path_full_lifecycle(): void
    {
        $seller = $this->makeUser('seller');
        $admin  = $this->makeUser('admin');
        $vendor = $this->makeUser('vendor');

        // Step 1: Seller tạo request → draft
        $created   = $this->createDraftProduct($seller, ['total_cost' => 12.00]);
        $productId = $created['id'];

        $this->assertEquals('draft', $created['status'],      'Mới tạo phải là draft');
        $this->assertEquals(12.00,   (float) $created['total_cost'], 'total_cost phải được lưu');

        // Đọc lại qua show() để kiểm tra trạng thái ban đầu (store không trả assigned_vendors nếu null)
        $initial = $this->getProduct($seller, $productId);
        $this->assertEmpty($initial['assigned_vendors'] ?? [], 'Mới tạo chưa có vendor');

        // Step 2: Seller submit lên Admin → pending
        $this->actingAs($seller)
            ->postJson("/api/products/{$productId}/submit")
            ->assertStatus(200);

        $this->assertDatabaseHas('products', [
            'id'           => $productId,
            'status'       => 'pending',
            'submitted_by' => $seller->id,
        ]);

        // Step 3: Admin duyệt → approved
        $this->actingAs($admin)
            ->postJson("/api/admin/products/{$productId}/approve", ['approved' => true])
            ->assertStatus(200);

        $this->assertDatabaseHas('products', [
            'id'          => $productId,
            'status'      => 'approved',
            'reviewed_by' => $admin->id,
        ]);

        // Step 4: Vendor gán 1 dòng giá từ thư viện (không nhập tay)
        $libraryRow = $this->makeLibraryVendorRow();
        $this->actingAs($vendor)
            ->postJson("/api/products/{$productId}/assign-vendors", [
                'vendors' => [$libraryRow],
            ])
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        // Step 5: Seller đọc lại → phải thấy đúng giá từ thư viện
        // show() wraps → ['success'=>true, 'data'=>$product]
        $product = $this->getProduct($seller, $productId);

        $assignedVendors = $product['assigned_vendors'];
        $this->assertIsArray($assignedVendors,    'assigned_vendors phải là array');
        $this->assertCount(1, $assignedVendors,   'Phải có đúng 1 vendor');

        $v = $assignedVendors[0];
        $this->assertEquals('VN3',             $v['name'],      'Tên vendor phải đúng');
        $this->assertEquals(13.20, (float)$v['eco_total'],      'eco_total phải lấy đúng từ thư viện, không nhập tay');
        $this->assertEquals('A',               $v['kyHieu'],    'kyHieu phải lưu đúng');
        $this->assertEquals('One Size',        $v['size'],      'Size phải lưu đúng');
        $this->assertEquals('lib_vn3_A_OneSize', $v['id'],      'ID vendor row phải giữ nguyên');
        $this->assertEquals(14.50, (float)$v['ground_total'],   'ground_total phải lưu đúng');
        $this->assertEquals(18.00, (float)$v['express_total'],  'express_total phải lưu đúng');
    }

    // ══════════════════════════════════════════
    // CASE 2 — PHÂN QUYỀN
    // ══════════════════════════════════════════

    /** Vendor gọi approve → 403 (Admin middleware hoạt động đúng) */
    public function test_vendor_cannot_approve_product(): void
    {
        $seller = $this->makeUser('seller', '1');
        $admin  = $this->makeUser('admin',   '1');
        $vendor = $this->makeUser('vendor', '1');

        $created   = $this->createDraftProduct($seller);
        $productId = $created['id'];
        $this->actingAs($seller)->postJson("/api/products/{$productId}/submit");

        $this->actingAs($vendor)
            ->postJson("/api/admin/products/{$productId}/approve", ['approved' => true])
            ->assertStatus(403);

        $this->assertDatabaseHas('products', ['id' => $productId, 'status' => 'pending']);
    }

    /**
     * Seller gọi assign-vendors → phải 403.
     *
     * ❌ BUG CODE: endpoint /assign-vendors không có role guard.
     * Test này FAIL (nhận 200) → xác nhận lỗ hổng phân quyền từ audit.
     * Không sửa code nghiệp vụ cho đến khi được duyệt.
     */
    public function test_seller_cannot_call_assign_vendors(): void
    {
        $seller      = $this->makeUser('seller', '2');
        $admin       = $this->makeUser('admin',   '2');
        $otherSeller = $this->makeUser('seller', '2b');

        $created   = $this->createDraftProduct($seller);
        $productId = $created['id'];
        $this->actingAs($seller)->postJson("/api/products/{$productId}/submit");
        $this->actingAs($admin)->postJson("/api/admin/products/{$productId}/approve", ['approved' => true]);

        // Seller khác gọi assign-vendors → phải 403 (thực tế BUG: trả 200)
        $this->actingAs($otherSeller)
            ->postJson("/api/products/{$productId}/assign-vendors", [
                'vendors' => [$this->makeLibraryVendorRow()],
            ])
            ->assertStatus(403);
    }

    /**
     * Admin gọi assign-vendors → phải 403.
     * ❌ BUG CODE: cùng lỗ hổng, Admin không phải Staff B nhưng được phép.
     */
    public function test_admin_cannot_call_assign_vendors(): void
    {
        $seller = $this->makeUser('seller', '3');
        $admin  = $this->makeUser('admin',   '3');

        $created   = $this->createDraftProduct($seller);
        $productId = $created['id'];
        $this->actingAs($seller)->postJson("/api/products/{$productId}/submit");
        $this->actingAs($admin)->postJson("/api/admin/products/{$productId}/approve", ['approved' => true]);

        $this->actingAs($admin)
            ->postJson("/api/products/{$productId}/assign-vendors", [
                'vendors' => [$this->makeLibraryVendorRow()],
            ])
            ->assertStatus(403);
    }

    /** Seller gọi approve → 403 (Admin middleware hoạt động đúng) */
    public function test_seller_cannot_approve(): void
    {
        $seller = $this->makeUser('seller', '4');

        $created   = $this->createDraftProduct($seller);
        $productId = $created['id'];
        $this->actingAs($seller)->postJson("/api/products/{$productId}/submit");

        $this->actingAs($seller)
            ->postJson("/api/admin/products/{$productId}/approve")
            ->assertStatus(403);

        $this->assertDatabaseHas('products', ['id' => $productId, 'status' => 'pending']);
    }

    // ══════════════════════════════════════════
    // CASE 3 — THỨ TỰ SAI
    // ══════════════════════════════════════════

    /**
     * Gán vendor cho request đang pending (chưa approve) → phải bị chặn.
     * ❌ BUG CODE: assignVendors() không kiểm tra status.
     */
    public function test_cannot_assign_vendor_to_pending_product(): void
    {
        $seller = $this->makeUser('seller', '5');
        $vendor = $this->makeUser('vendor', '5');

        $created   = $this->createDraftProduct($seller);
        $productId = $created['id'];

        // Submit → pending (chưa approve)
        $this->actingAs($seller)->postJson("/api/products/{$productId}/submit");
        $this->assertDatabaseHas('products', ['id' => $productId, 'status' => 'pending']);

        // Gán vendor khi pending → phải 422 (BUG: trả 200)
        $this->actingAs($vendor)
            ->postJson("/api/products/{$productId}/assign-vendors", [
                'vendors' => [$this->makeLibraryVendorRow()],
            ])
            ->assertStatus(422);

        // Sau khi bị chặn, assigned_vendors phải còn trống
        $this->assertNull(
            Product::find($productId)->assigned_vendors,
            'Pending product không được có assigned_vendors'
        );
    }

    /**
     * Gán vendor cho request ở draft → phải bị chặn.
     * ❌ BUG CODE: assignVendors() không kiểm tra status.
     */
    public function test_cannot_assign_vendor_to_draft_product(): void
    {
        $seller = $this->makeUser('seller', '6');
        $vendor = $this->makeUser('vendor', '6');

        $created   = $this->createDraftProduct($seller);
        $productId = $created['id'];
        // KHÔNG submit → vẫn là draft

        $this->actingAs($vendor)
            ->postJson("/api/products/{$productId}/assign-vendors", [
                'vendors' => [$this->makeLibraryVendorRow()],
            ])
            ->assertStatus(422);
    }

    /**
     * Seller chỉ thấy request của mình trong GET /products.
     * GET /products-approved chỉ trả status=approved.
     */
    public function test_seller_sees_only_approved_products_in_approved_list(): void
    {
        $seller = $this->makeUser('seller', '7');
        $admin  = $this->makeUser('admin',   '7');

        $draftProduct = $this->createDraftProduct($seller, ['product_type' => 'DRAFT_PRODUCT']);

        // approvedProducts() wraps: {'data': [...]}
        $response = $this->getJson('/api/products-approved')->assertStatus(200);
        $types    = collect($response->json('data'))->pluck('product_type');
        $this->assertNotContains('DRAFT_PRODUCT', $types, 'Draft không xuất hiện trong approved list');

        // Submit + approve
        $this->actingAs($seller)->postJson("/api/products/{$draftProduct['id']}/submit");
        $this->actingAs($admin)->postJson("/api/admin/products/{$draftProduct['id']}/approve", ['approved' => true]);

        $response2 = $this->getJson('/api/products-approved')->assertStatus(200);
        $types2    = collect($response2->json('data'))->pluck('product_type');
        $this->assertContains('DRAFT_PRODUCT', $types2, 'Sau approve phải xuất hiện trong danh sách');
    }

    // ══════════════════════════════════════════
    // CASE 4 — NHIỀU VENDOR
    // Gán 2 vendor → seller đọc đủ 2 dòng, mỗi dòng đúng giá
    // ══════════════════════════════════════════

    public function test_multiple_vendors_assigned_and_read_correctly(): void
    {
        $seller = $this->makeUser('seller', '8');
        $admin  = $this->makeUser('admin',   '8');
        $vendor = $this->makeUser('vendor', '8');

        $created   = $this->createDraftProduct($seller, ['total_cost' => 15.00]);
        $productId = $created['id'];

        $this->actingAs($seller)->postJson("/api/products/{$productId}/submit");
        $this->actingAs($admin)->postJson("/api/admin/products/{$productId}/approve", ['approved' => true]);

        // 2 vendor rows từ thư viện với giá khác nhau
        $vendorRow1 = $this->makeLibraryVendorRow([
            'id'        => 'lib_vn3_A',
            'name'      => 'VN3',
            'eco_total' => 13.20,
            'kyHieu'    => 'A',
            'size'      => 'One Size',
        ]);
        $vendorRow2 = $this->makeLibraryVendorRow([
            'id'        => 'lib_us1_B',
            'name'      => 'US1',
            'eco_total' => 16.50,
            'kyHieu'    => 'B',
            'size'      => 'S/M/L',
        ]);

        $this->actingAs($vendor)
            ->postJson("/api/products/{$productId}/assign-vendors", [
                'vendors' => [$vendorRow1, $vendorRow2],
            ])
            ->assertStatus(200);

        // show() → data wrapper
        $product         = $this->getProduct($seller, $productId);
        $assignedVendors = $product['assigned_vendors'];

        $this->assertCount(2, $assignedVendors, 'Phải có đúng 2 vendor');

        // Map theo name để assert độc lập thứ tự
        $byName = collect($assignedVendors)->keyBy('name');

        $this->assertEquals(13.20,    (float) $byName['VN3']['eco_total'],  'VN3 eco_total đúng');
        $this->assertEquals('A',      $byName['VN3']['kyHieu'],              'VN3 kyHieu đúng');
        $this->assertEquals('lib_vn3_A', $byName['VN3']['id'],              'VN3 id đúng');

        $this->assertEquals(16.50,    (float) $byName['US1']['eco_total'],  'US1 eco_total đúng');
        $this->assertEquals('S/M/L',  $byName['US1']['size'],               'US1 size đúng');
        $this->assertEquals('lib_us1_B', $byName['US1']['id'],              'US1 id đúng');
    }

    // ══════════════════════════════════════════
    // CASE 5 — SO TARGET COST
    // target_cost biết trước, giá vendor biết trước → hệ thống cung cấp đủ dữ liệu để tính delta
    // ══════════════════════════════════════════

    public function test_price_delta_vs_target_cost(): void
    {
        $seller = $this->makeUser('seller', '9');
        $admin  = $this->makeUser('admin',   '9');
        $vendor = $this->makeUser('vendor', '9');

        $targetCost = 12.00;
        $created    = $this->createDraftProduct($seller, ['total_cost' => $targetCost]);
        $productId  = $created['id'];

        $this->actingAs($seller)->postJson("/api/products/{$productId}/submit");
        $this->actingAs($admin)->postJson("/api/admin/products/{$productId}/approve", ['approved' => true]);

        // Vendor có eco_total = 13.20 → delta = +1.20 (vượt target)
        $this->actingAs($vendor)->postJson("/api/products/{$productId}/assign-vendors", [
            'vendors' => [$this->makeLibraryVendorRow(['eco_total' => 13.20])],
        ]);

        // show() wraps → đọc từ 'data'
        $product             = $this->getProduct($seller, $productId);
        $returnedTargetCost  = (float) $product['total_cost'];
        $returnedVendorPrice = (float) $product['assigned_vendors'][0]['eco_total'];

        $this->assertEquals(12.00, $returnedTargetCost,  'total_cost trả về phải đúng');
        $this->assertEquals(13.20, $returnedVendorPrice, 'eco_total vendor trả về phải đúng');

        // Hệ thống cung cấp đủ dữ liệu để client tính delta
        $delta = $returnedVendorPrice - $returnedTargetCost;
        $this->assertEqualsWithDelta(1.20, $delta, 0.001, 'Chênh lệch giá phải là +$1.20');
        $this->assertGreaterThan(0, $delta, 'Vendor này vượt target cost');

        // Case ngược: vendor rẻ hơn target
        $this->actingAs($vendor)->postJson("/api/products/{$productId}/assign-vendors", [
            'vendors' => [$this->makeLibraryVendorRow(['id' => 'cheap', 'name' => 'CheapVendor', 'eco_total' => 10.50])],
        ]);

        $product2    = $this->getProduct($seller, $productId);
        $cheapPrice  = (float) $product2['assigned_vendors'][0]['eco_total'];
        $deltaCheap  = $cheapPrice - $targetCost;

        $this->assertEqualsWithDelta(-1.50, $deltaCheap, 0.001, 'Delta âm = trong target');
        $this->assertLessThan(0, $deltaCheap, 'Vendor rẻ hơn target phải có delta < 0');
    }

    // ══════════════════════════════════════════
    // CASE 6 — REJECT PATH
    // Request bị reject → gán vendor phải bị chặn
    // ══════════════════════════════════════════

    /**
     * Reject product → gán vendor → phải bị chặn.
     * ❌ BUG CODE: assignVendors() không kiểm tra status.
     */
    public function test_cannot_assign_vendor_to_rejected_product(): void
    {
        $seller = $this->makeUser('seller', '10');
        $admin  = $this->makeUser('admin',   '10');
        $vendor = $this->makeUser('vendor', '10');

        $created   = $this->createDraftProduct($seller);
        $productId = $created['id'];

        $this->actingAs($seller)->postJson("/api/products/{$productId}/submit");

        // Admin từ chối
        $this->actingAs($admin)
            ->postJson("/api/admin/products/{$productId}/reject", ['reason' => 'Không đạt yêu cầu'])
            ->assertStatus(200);

        $this->assertDatabaseHas('products', ['id' => $productId, 'status' => 'rejected']);

        // Gán vendor → phải bị chặn (BUG: hiện tại không bị chặn)
        $this->actingAs($vendor)
            ->postJson("/api/products/{$productId}/assign-vendors", [
                'vendors' => [$this->makeLibraryVendorRow()],
            ])
            ->assertStatus(422);

        // Sau khi bị chặn, assigned_vendors phải trống
        $this->assertNull(
            Product::find($productId)->assigned_vendors,
            'Rejected product không được có assigned_vendors'
        );
    }

    /** Reject lưu đúng rejection_reason và reviewer */
    public function test_rejected_product_preserves_rejection_reason(): void
    {
        $seller = $this->makeUser('seller', '11');
        $admin  = $this->makeUser('admin',   '11');

        $created   = $this->createDraftProduct($seller);
        $productId = $created['id'];

        $this->actingAs($seller)->postJson("/api/products/{$productId}/submit");
        $this->actingAs($admin)
            ->postJson("/api/admin/products/{$productId}/reject", ['reason' => 'Giá quá cao'])
            ->assertStatus(200);

        $this->assertDatabaseHas('products', [
            'id'               => $productId,
            'status'           => 'rejected',
            'rejection_reason' => 'Giá quá cao',
            'reviewed_by'      => $admin->id,
        ]);
    }

    // ══════════════════════════════════════════
    // CASE BONUS — Assign ghi đè (replace, không append)
    // ══════════════════════════════════════════

    public function test_assign_vendors_replaces_not_appends(): void
    {
        $seller = $this->makeUser('seller', '12');
        $admin  = $this->makeUser('admin',   '12');
        $vendor = $this->makeUser('vendor', '12');

        $created   = $this->createDraftProduct($seller);
        $productId = $created['id'];
        $this->actingAs($seller)->postJson("/api/products/{$productId}/submit");
        $this->actingAs($admin)->postJson("/api/admin/products/{$productId}/approve", ['approved' => true]);

        // Lần 1: gán 2 vendor
        $this->actingAs($vendor)->postJson("/api/products/{$productId}/assign-vendors", [
            'vendors' => [
                $this->makeLibraryVendorRow(['id' => 'v1', 'name' => 'VendorA']),
                $this->makeLibraryVendorRow(['id' => 'v2', 'name' => 'VendorB']),
            ],
        ]);

        // Lần 2: chỉ 1 vendor mới
        $this->actingAs($vendor)->postJson("/api/products/{$productId}/assign-vendors", [
            'vendors' => [
                $this->makeLibraryVendorRow(['id' => 'v3', 'name' => 'VendorC']),
            ],
        ]);

        $product         = $this->getProduct($seller, $productId);
        $assignedVendors = $product['assigned_vendors'];

        $this->assertCount(1, $assignedVendors, 'Gán lần 2 phải ghi đè lần 1 — không cộng dồn');
        $this->assertEquals('VendorC', $assignedVendors[0]['name'], 'Chỉ VendorC còn lại');
    }

    // ══════════════════════════════════════════
    // UNAUTHENTICATED
    // ══════════════════════════════════════════

    public function test_unauthenticated_cannot_create_product(): void
    {
        // Không dùng actingAs → không có session
        $this->postJson('/api/products', ['product_type' => 'AOP'])
            ->assertStatus(401);
    }

    /**
     * Submit không có auth → phải 401.
     *
     * Lưu ý: tạo product trực tiếp qua DB (không qua HTTP) để tránh
     * session của actingAs() ô nhiễm sang request tiếp theo.
     */
    public function test_unauthenticated_cannot_submit(): void
    {
        $seller  = $this->makeUser('seller', '13');
        // Tạo product thẳng vào DB, không qua HTTP (tránh actingAs leaking)
        $product = Product::create([
            'product_type' => 'AOP',
            'total_cost'   => 12.00,
            'status'       => 'draft',
            'created_by'   => $seller->id,
        ]);

        // Không actingAs → phải 401
        $this->postJson("/api/products/{$product->id}/submit")
            ->assertStatus(401);

        // Status phải vẫn là draft
        $this->assertDatabaseHas('products', ['id' => $product->id, 'status' => 'draft']);
    }
}
