<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::table('users')->where('role', 'staff_a')->update(['role' => 'seller']);
        DB::table('users')->where('role', 'staff_b')->update(['role' => 'vendor']);
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'seller')->update(['role' => 'staff_a']);
        DB::table('users')->where('role', 'vendor')->update(['role' => 'staff_b']);
    }
};
