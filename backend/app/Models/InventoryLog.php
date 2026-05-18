<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;

class InventoryLog extends Model {
    protected $fillable = [
        'product_id','user_id','vendor_id','type',
        'quantity','stock_before','stock_after','unit_cost','reference','note'
    ];

    public function product() { return $this->belongsTo(Product::class); }
    public function user()    { return $this->belongsTo(User::class); }
    public function vendor()  { return $this->belongsTo(Vendor::class); }
}
