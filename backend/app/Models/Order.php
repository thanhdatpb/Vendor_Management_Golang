<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

use App\Models\Customer;
use App\Models\User;
use App\Models\OrderItem;
use App\Models\Payment;

class Order extends Model {
    use SoftDeletes;
    protected $fillable = [
        'order_number','customer_id','created_by','subtotal',
        'discount','tax','total','status','shipping_address','note','completed_at'
    ];
    protected $casts = [
        'total'        => 'decimal:2',
        'completed_at' => 'datetime',
    ];

    public function customer()  { return $this->belongsTo(Customer::class); }
    public function createdBy() { return $this->belongsTo(User::class, 'created_by'); }
    public function items()     { return $this->hasMany(OrderItem::class); }
    public function payment()   { return $this->hasOne(Payment::class); }

    // Auto generate order number
    protected static function boot() {
        parent::boot();
        static::creating(function ($order) {
            $order->order_number = 'ORD-' . str_pad(
                Order::withTrashed()->count() + 1, 4, '0', STR_PAD_LEFT
            );
        });
    }

    public function scopeByStatus($query, $status) {
        return $query->where('status', $status);
    }

    public function scopeToday($query) {
        return $query->whereDate('created_at', today());
    }
}