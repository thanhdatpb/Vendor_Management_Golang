<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class News extends Model
{
    protected $table = 'news';

    protected $fillable = [
        'title',
        'message',
        'target',
        'sent_at',
        'created_by',
    ];

    protected $casts = [
        'target'  => 'array',
        'sent_at' => 'datetime',
    ];

    /**
     * Đã phát tới Admin & Seller chưa. Đã gửi thì khoá sửa/xoá/gửi lại — bên nhận
     * đã cầm bản notification rồi, sửa nội dung gốc sẽ lệch với cái họ đã đọc.
     */
    public function isSent(): bool
    {
        return $this->sent_at !== null;
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
