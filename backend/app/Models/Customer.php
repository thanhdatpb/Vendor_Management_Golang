<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model {
    use SoftDeletes;
    protected $fillable = ['name','email','phone','address','total_spent','total_orders'];

    public function orders() { return $this->hasMany(Order::class); }

    public function updateStats() {
        $this->update([
            'total_orders' => $this->orders()->count(),
            'total_spent'  => $this->orders()->where('status','completed')->sum('total'),
        ]);
    }
}
