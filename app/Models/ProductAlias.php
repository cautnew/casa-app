<?php

namespace App\Models;

use App\Models\Concerns\BelongsToHouse;
use Illuminate\Database\Eloquent\Model;

/**
 * Memória de vínculos: como a casa quer ver um item que vem com uma descrição
 * abreviada na nota fiscal (ex.: "LTE PO NOLAC 300G" → "Leite em pó" / Alimentos).
 */
class ProductAlias extends Model
{
    use BelongsToHouse;

    protected $fillable = ['store_cnpj', 'nf_description', 'name', 'category', 'unit'];
}
