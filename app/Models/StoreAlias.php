<?php

namespace App\Models;

use App\Models\Concerns\BelongsToHouse;
use Illuminate\Database\Eloquent\Model;

/** Nome que a casa deu a uma loja (identificada pelo CNPJ). */
class StoreAlias extends Model
{
    use BelongsToHouse;

    protected $fillable = ['cnpj', 'name'];
}
