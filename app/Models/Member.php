<?php

namespace App\Models;

use App\Models\Concerns\BelongsToHouse;
use Illuminate\Database\Eloquent\Model;

class Member extends Model
{
    use BelongsToHouse;

    protected $fillable = ['name', 'color'];
}
