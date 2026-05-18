<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Payment;
use App\Http\Controllers\Api\BaseApiController;

class PaymentController extends BaseApiController {

    public function index(Request $request) {
        $payments = Payment::with('order.customer')
            ->latest()->paginate($request->per_page ?? 15);
        return $this->success($payments);
    }

    public function refund(Request $request, $id) {
        $payment = Payment::findOrFail($id);

        if ($payment->status !== 'success') {
            return $this->error('Chỉ có thể hoàn tiền cho thanh toán đã thành công');
        }

        $payment->update([
            'status'      => 'refunded',
            'refunded_at' => now(),
        ]);

        // Cập nhật trạng thái đơn hàng
        $payment->order->update(['status' => 'cancelled']);

        return $this->success($payment, 'Hoàn tiền thành công');
    }
}
