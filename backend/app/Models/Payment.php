<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Order;

class Payment extends Model {
    protected $fillable = [
        'payment_number','order_id','amount','method',
        'status','transaction_id','paid_at','refunded_at','note'
    ];
    protected $casts = ['paid_at' => 'datetime', 'refunded_at' => 'datetime'];

    public function order() { return $this->belongsTo(Order::class); }

    protected static function boot() {
        parent::boot();
        static::creating(function ($payment) {
            $payment->payment_number = 'PAY-' . str_pad(
                Payment::count() + 1, 4, '0', STR_PAD_LEFT
            );
        });
    }
}