<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Order;
use App\Models\Product;
use App\Http\Controllers\Api\BaseApiController;

class AnalyticsController extends BaseApiController {

    public function revenue(Request $request) {
        $period = $request->period ?? 'month'; // day | month | year

        $data = Order::where('status','completed')
            ->when($period === 'day', fn($q) => $q->whereMonth('created_at', now()->month)
                ->selectRaw('DATE(created_at) as label, SUM(total) as revenue, COUNT(*) as orders')
                ->groupBy('label'))
            ->when($period === 'month', fn($q) => $q->whereYear('created_at', now()->year)
                ->selectRaw('MONTH(created_at) as label, SUM(total) as revenue, COUNT(*) as orders')
                ->groupBy('label'))
            ->orderBy('label')->get();

        return $this->success($data);
    }

    public function topProducts(Request $request) {
        $products = Product::orderByDesc('total_sold')
            ->with('vendor')
            ->take($request->limit ?? 10)
            ->get(['id','name','category','total_sold','price']);
        return $this->success($products);
    }

    public function conversion() {
        // Tỉ lệ chuyển đổi đơn hàng
        $total     = Order::count();
        $completed = Order::where('status','completed')->count();
        $cancelled = Order::where('status','cancelled')->count();
        $rate      = $total > 0 ? round(($completed / $total) * 100, 1) : 0;

        return $this->success([
            'total_orders'     => $total,
            'completed_orders' => $completed,
            'cancelled_orders' => $cancelled,
            'conversion_rate'  => $rate,
        ]);
    }

    public function profit(Request $request) {
        $profit = Order::where('status','completed')
            ->join('order_items','orders.id','=','order_items.order_id')
            ->join('products','order_items.product_id','=','products.id')
            ->selectRaw('
                SUM(order_items.subtotal) as revenue,
                SUM(products.cost_price * order_items.quantity) as cost,
                SUM((order_items.price - products.cost_price) * order_items.quantity) as profit
            ')
            ->first();

        return $this->success($profit);
    }
}
