<?php

namespace App\Models;

use App\Models\Concerns\BelongsToHouse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Purchase extends Model
{
    use BelongsToHouse;

    protected $fillable = ['date', 'store', 'note', 'total', 'per_member'];

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function memberPayments(): HasMany
    {
        return $this->hasMany(PurchaseMemberPayment::class);
    }
}
