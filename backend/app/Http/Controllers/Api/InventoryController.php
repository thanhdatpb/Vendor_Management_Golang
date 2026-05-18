<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Customer;
use App\Models\Order;
use App\Http\Controllers\Api\BaseApiController;

class InventoryController extends BaseApiController {

    public function index(Request $request) {
        $products = Product::with('vendor')
            ->select('id','name','sku','category','stock','stock_alert','vendor_id')
            ->paginate($request->per_page ?? 20);
        return $this->success($products);
    }

    public function lowStock() {
        $products = Product::whereColumn('stock','<=','stock_alert')->get();
        return $this->success($products);
    }

    public function importStock(Request $request) {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity'   => 'required|integer|min:1',
            'unit_cost'  => 'nullable|numeric|min:0',
            'vendor_id'  => 'nullable|exists:vendors,id',
            'note'       => 'nullable|string',
        ]);

        DB::transaction(function () use ($request) {
            $product = Product::findOrFail($request->product_id);
            $before  = $product->stock;
            $product->increment('stock', $request->quantity);

            InventoryLog::create([
                'product_id'   => $product->id,
                'user_id'      => auth()->id(),
                'vendor_id'    => $request->vendor_id,
                'type'         => 'import',
                'quantity'     => $request->quantity,
                'stock_before' => $before,
                'stock_after'  => $before + $request->quantity,
                'unit_cost'    => $request->unit_cost,
                'note'         => $request->note,
            ]);

            // Cập nhật vendor stats
            if ($request->vendor_id && $request->unit_cost) {
                Vendor::find($request->vendor_id)->increment(
                    'total_import_value', $request->quantity * $request->unit_cost
                );
                Vendor::find($request->vendor_id)->increment('total_import_orders');
            }
        });

        return $this->success(null, 'Nhập kho thành công');
    }

    public function exportStock(Request $request) {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity'   => 'required|integer|min:1',
            'note'       => 'nullable|string',
        ]);

        $product = Product::findOrFail($request->product_id);
        if ($product->stock < $request->quantity) {
            return $this->error('Không đủ tồn kho để xuất');
        }

        $before = $product->stock;
        $product->decrement('stock', $request->quantity);

        InventoryLog::create([
            'product_id'   => $product->id,
            'user_id'      => auth()->id(),
            'type'         => 'export',
            'quantity'     => -$request->quantity,
            'stock_before' => $before,
            'stock_after'  => $before - $request->quantity,
            'note'         => $request->note,
        ]);

        return $this->success(null, 'Xuất kho thành công');
    }

    public function logs(Request $request) {
        $logs = InventoryLog::with(['product','user','vendor'])
            ->latest()->paginate(20);
        return $this->success($logs);
    }
}