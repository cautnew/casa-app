<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bill extends Model
{
    protected $fillable = [
        'description', 'category', 'amount', 'due_date',
        'status', 'reference_month', 'note',
        'payment_method', 'payment_institution',
    ];

    protected $casts = ['amount' => 'float'];

    public function memberPayments(): HasMany
    {
        return $this->hasMany(BillMemberPayment::class);
    }
}
