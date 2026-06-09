<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category');
            $table->decimal('quantity', 10, 3)->default(0);
            $table->string('unit')->default('un');
            $table->decimal('min_stock', 10, 3)->default(1);
            $table->boolean('in_next_list')->default(false);
            $table->decimal('last_price', 10, 2)->default(0);
            $table->decimal('avg_price', 10, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('price_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained()->cascadeOnDelete();
            $table->string('date');
            $table->decimal('price', 10, 2);
            $table->string('store')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_history');
        Schema::dropIfExists('inventory_items');
    }
};
