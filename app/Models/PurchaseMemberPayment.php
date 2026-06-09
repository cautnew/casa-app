<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseMemberPayment extends Model
{
    protected $fillable = ['purchase_id', 'member_id', 'amount'];

    protected $casts = ['amount' => 'float'];
}
