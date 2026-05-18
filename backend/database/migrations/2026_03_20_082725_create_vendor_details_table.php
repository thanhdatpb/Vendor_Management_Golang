<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
   public function up()
{
    Schema::create('vendor_details', function (Blueprint $table) {
        $table->id();
        $table->foreignId('vendor_id')->constrained()->onDelete('cascade');
        $table->string('size')->nullable();                 // SIZE
        $table->string('optional')->nullable();             // OPTIONAL
        $table->decimal('price_1', 12, 2)->nullable();      // PRICING 1
        $table->decimal('price_2', 12, 2)->nullable();      // PRICING 2
        $table->decimal('shipping_economy', 12, 2)->nullable();   // ECONOMY PRICE SHIP
        $table->decimal('shipping_fast', 12, 2)->nullable();       // FAST PRICE SHIP
        $table->decimal('shipping_express', 12, 2)->nullable();     // EXPRESS PRICE SHIP
        $table->decimal('shipping_overnight', 12, 2)->nullable();   // OVERNIGHT PRICE SHIP
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vendor_details');
    }
};
