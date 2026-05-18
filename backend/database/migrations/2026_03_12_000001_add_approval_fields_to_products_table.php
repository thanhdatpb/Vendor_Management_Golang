<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // approval workflow
            $table->string('status')->default('draft')->after('vendor_id');

            $table->unsignedBigInteger('created_by')->nullable()->after('status');
            $table->unsignedBigInteger('submitted_by')->nullable()->after('created_by');
            $table->timestamp('submitted_at')->nullable()->after('submitted_by');

            $table->unsignedBigInteger('reviewed_by')->nullable()->after('submitted_at');
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');

            $table->text('rejection_reason')->nullable()->after('reviewed_at');

            $table->index(['status', 'submitted_at']);
            $table->index(['created_by', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['status', 'submitted_at']);
            $table->dropIndex(['created_by', 'status']);

            $table->dropColumn([
                'status',
                'created_by',
                'submitted_by',
                'submitted_at',
                'reviewed_by',
                'reviewed_at',
                'rejection_reason',
            ]);
        });
    }
};

