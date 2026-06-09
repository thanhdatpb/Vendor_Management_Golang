<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vendor extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'vendors';

      protected $fillable = [
        'name',  // ← PHẢI CÓ DÒNG NÀY
        'vendor_type',
        'product_type',
        'size',
        'optional',
        'overview',
        'media_url',
        'media_urls',
        'pricing1',
        'pricing2',
        'eco_price',
        'eco_total',
        'fast_price',
        'fast_total',
        'express_price',
        'express_total',
        'overnight_price',
        'overnight_total',
        'phone',
        'email',
        'category',
        'product_price',
        'production_price',
        'shipping_price',
        'total_cost',
    ];
    protected $casts = [
        // Cột cũ
        'production_price' => 'float',
        'shipping_price'   => 'float',
        'product_price'    => 'float',
        'total_cost'       => 'float',

        // Cột mới
        'pricing1'         => 'float',
        'pricing2'         => 'float',
        'eco_price'        => 'float',
        'eco_total'        => 'float',
        'fast_price'       => 'float',
        'fast_total'       => 'float',
        'express_price'    => 'float',
        'express_total'    => 'float',
        'overnight_price'  => 'float',
        'overnight_total'  => 'float',
        'media_urls'       => 'array',
    ];
}