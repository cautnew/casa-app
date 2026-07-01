<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $tables = ['members', 'purchases', 'inventory_items', 'shopping_list_items', 'bills'];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->foreignId('user_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            });
        }

        // Dados pré-existentes não tinham dono: migram para uma casa padrão.
        if (DB::table('members')->exists() || DB::table('purchases')->exists()
            || DB::table('inventory_items')->exists() || DB::table('shopping_list_items')->exists()
            || DB::table('bills')->exists()) {
            $defaultUser = User::create([
                'name' => 'Casa Principal',
                'username' => 'casa-principal',
                'email' => 'taisermarques@gmail.com',
                'password' => '123456',
            ]);

            foreach ($this->tables as $table) {
                DB::table($table)->whereNull('user_id')->update(['user_id' => $defaultUser->id]);
            }
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->dropConstrainedForeignId('user_id');
            });
        }
    }
};
