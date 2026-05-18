<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Customer;
use App\Models\Order;
use App\Http\Controllers\Api\BaseApiController;

class CustomerController extends BaseApiController {

    public function index(Request $request) {
        $query = Customer::latest();
        if ($request->search) $query->where('name','like',"%{$request->search}%")
            ->orWhere('email','like',"%{$request->search}%");
        return $this->success($query->paginate($request->per_page ?? 15));
    }

    public function show($id) {
        return $this->success(Customer::findOrFail($id));
    }

    public function orders($id) {
        $orders = Order::where('customer_id', $id)
            ->with('items.product')->latest()->get();
        return $this->success($orders);
    }
}