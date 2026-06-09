<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BillMemberPayment extends Model
{
    protected $fillable = ['bill_id', 'member_id', 'amount'];

    protected $casts = ['amount' => 'float'];
}
