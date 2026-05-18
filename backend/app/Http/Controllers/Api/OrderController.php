<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Customer;
use App\Models\Order;
use App\Http\Controllers\Api\BaseApiController;

class OrderController extends BaseApiController {

    public function index(Request $request) {
        $query = Order::with(['customer','items.product','payment'])
            ->latest();

        if ($request->status)   $query->where('status', $request->status);
        if ($request->search)   $query->where(function($q) use ($request) {
            $q->where('order_number','like',"%{$request->search}%")
              ->orWhereHas('customer', fn($q2) => $q2->where('name','like',"%{$request->search}%"));
        });
        if ($request->date_from) $query->whereDate('created_at','>=',$request->date_from);
        if ($request->date_to)   $query->whereDate('created_at','<=',$request->date_to);

        return $this->success($query->paginate($request->per_page ?? 15));
    }

    public function show($id) {
        $order = Order::with(['customer','items.product','payment','createdBy'])->findOrFail($id);
        return $this->success($order);
    }

    public function store(Request $request) {
        $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'items'       => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity'   => 'required|integer|min:1',
        ]);

        DB::transaction(function () use ($request, &$order) {
            $subtotal = 0;
            $items    = [];

            foreach ($request->items as $item) {
                $product = Product::findOrFail($item['product_id']);
                if ($product->stock < $item['quantity']) {
                    throw new \Exception("Sản phẩm {$product->name} không đủ tồn kho");
                }
                $lineTotal = $product->price * $item['quantity'];
                $subtotal += $lineTotal;
                $items[]   = [
                    'product_id'   => $product->id,
                    'product_name' => $product->name,
                    'price'        => $product->price,
                    'quantity'     => $item['quantity'],
                    'subtotal'     => $lineTotal,
                ];
            }

            $order = Order::create([
                'customer_id'      => $request->customer_id,
                'created_by'       => auth()->id(),
                'subtotal'         => $subtotal,
                'discount'         => $request->discount ?? 0,
                'tax'              => $request->tax ?? 0,
                'total'            => $subtotal - ($request->discount ?? 0) + ($request->tax ?? 0),
                'status'           => 'pending',
                'shipping_address' => $request->shipping_address,
                'note'             => $request->note,
            ]);

            $order->items()->createMany($items);

            // Trừ tồn kho
            foreach ($request->items as $item) {
                Product::find($item['product_id'])->decreaseStock($item['quantity'], $order->id);
            }

            // Cập nhật stats khách hàng
            Customer::find($request->customer_id)->updateStats();
        });

        return $this->success($order->load('items'), 'Tạo đơn hàng thành công', 201);
    }

    public function updateStatus(Request $request, $id) {
        $request->validate(['status' => 'required|in:pending,processing,shipping,completed,cancelled']);
        $order = Order::findOrFail($id);
        $order->update([
            'status'       => $request->status,
            'completed_at' => $request->status === 'completed' ? now() : null,
        ]);
        return $this->success($order, 'Cập nhật trạng thái thành công');
    }

    public function update(Request $request, $id) {
        $order = Order::findOrFail($id);
        $order->update($request->only(['note','shipping_address','discount']));
        return $this->success($order, 'Cập nhật đơn hàng thành công');
    }

    public function destroy($id) {
        Order::findOrFail($id)->delete();
        return $this->success(null, 'Đã xóa đơn hàng');
    }
}