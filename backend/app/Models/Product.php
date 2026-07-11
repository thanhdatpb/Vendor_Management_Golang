<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

use App\Models\Vendor;

class Product extends Model
{
    use HasFactory, SoftDeletes;

protected $fillable = [
    'vendor_id',
    'assigned_vendors',
    'media_path',
    'media_url',
    'media_kind',
    'media_urls',
    'image_url',
    'status',
    'created_by',
    'seller_name',
    'deadline_date',
    'submitted_by',
    'submitted_at',
    'reviewed_by',
    'reviewed_at',
    'rejection_reason',
    'product_type',
    'product_type_link',
    'product_type_links',
    'product_video_links',
    'production_time',
    'shipping_time',
    'total_cost',
    'material',
    'print_area',
    'other_specs',
    'good_review',
    'bad_review',
    'packaging_links',
    'other_packaging',
];

protected $casts = [
    'media_urls' => 'array',
    'product_type_links' => 'array',
    'product_video_links' => 'array',
    'assigned_vendors' => 'array',
    'created_at' => 'datetime',
    'updated_at' => 'datetime',
];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    // Vendor của sản phẩm
    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    // Quan hệ với User - người tạo sản phẩm
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Người duyệt sản phẩm
    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    // Người gửi duyệt
    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

}