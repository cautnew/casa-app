<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Suporte à importação de compras a partir de NFC-e (nota fiscal do consumidor eletrônica).
 * Ver docs/plano-importacao-nfce.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->string('source', 10)->default('manual')->after('note'); // manual | list | nfce
            $table->string('nfce_access_key', 44)->nullable()->after('source');
            $table->text('nfce_url')->nullable()->after('nfce_access_key');
            $table->string('store_cnpj', 14)->nullable()->index()->after('store');
            $table->decimal('subtotal', 10, 2)->nullable()->after('total');
            $table->decimal('discount', 10, 2)->default(0)->after('subtotal');
            $table->string('payment_method')->nullable()->after('discount');

            // Barreira final contra nota duplicada (por casa). NULLs não colidem.
            $table->unique(['user_id', 'nfce_access_key']);
        });

        Schema::table('purchase_items', function (Blueprint $table) {
            $table->string('original_name')->nullable()->after('name');
            $table->decimal('original_unit_price', 10, 4)->nullable()->after('total_price');
            $table->decimal('original_total_price', 10, 2)->nullable()->after('original_unit_price');
        });

        // Preço por kg rateado precisa de mais casas decimais.
        Schema::table('purchase_items', function (Blueprint $table) {
            $table->decimal('unit_price', 10, 4)->change();
        });

        // Compras já geradas pela lista de compras ganham a origem correta.
        DB::table('purchases')
            ->where('note', 'Gerada a partir da lista de compras')
            ->update(['source' => 'list']);

        Schema::create('product_aliases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('store_cnpj', 14)->default(''); // '' = vale para qualquer loja
            $table->string('nf_description');              // descrição normalizada da nota
            $table->string('name');
            $table->string('category');
            $table->string('unit', 20);
            $table->timestamps();

            $table->unique(['user_id', 'store_cnpj', 'nf_description']);
        });

        Schema::create('store_aliases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('cnpj', 14);
            $table->string('name');
            $table->timestamps();

            $table->unique(['user_id', 'cnpj']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_aliases');
        Schema::dropIfExists('product_aliases');

        Schema::table('purchase_items', function (Blueprint $table) {
            $table->decimal('unit_price', 10, 2)->change();
        });

        Schema::table('purchase_items', function (Blueprint $table) {
            $table->dropColumn(['original_name', 'original_unit_price', 'original_total_price']);
        });

        Schema::table('purchases', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'nfce_access_key']);
            $table->dropIndex(['store_cnpj']);
            $table->dropColumn([
                'source', 'nfce_access_key', 'nfce_url', 'store_cnpj',
                'subtotal', 'discount', 'payment_method',
            ]);
        });
    }
};
