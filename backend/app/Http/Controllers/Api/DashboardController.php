<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Customer;
use App\Models\Order;
use App\Http\Controllers\Api\BaseApiController;

class DashboardController extends BaseApiController {

    public function overview(Request $request) {
        $user    = $request->user();
        $isAdmin = $user->isAdmin();

        $data = [
            'total_orders'    => Order::count(),
            'total_customers' => Customer::count(),
            'total_products'  => Product::count(),
            'orders_today'    => Order::today()->count(),
            'order_statuses'  => Order::selectRaw('status, COUNT(*) as count')
                                       ->groupBy('status')->pluck('count','status'),
        ];

        // Chỉ Admin thấy doanh thu & lợi nhuận
        if ($isAdmin) {
            $data['total_revenue']     = Order::where('status','completed')->sum('total');
            $data['revenue_today']     = Order::today()->where('status','completed')->sum('total');
            $data['revenue_this_month']= Order::whereMonth('created_at', now()->month)
                                               ->where('status','completed')->sum('total');
            $data['profit_today']      = Order::today()
                ->join('order_items','orders.id','=','order_items.order_id')
                ->join('products','order_items.product_id','=','products.id')
                ->selectRaw('SUM((order_items.price - products.cost_price) * order_items.quantity) as profit')
                ->value('profit') ?? 0;

            // Revenue chart 12 tháng
            $data['revenue_chart'] = Order::where('status','completed')
                ->whereYear('created_at', now()->year)
                ->selectRaw('MONTH(created_at) as month, SUM(total) as revenue')
                ->groupBy('month')
                ->orderBy('month')
                ->get();
        }

        return $this->success($data);
    }
}