<?php

namespace App\Models;

use App\Models\Concerns\BelongsToHouse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Purchase extends Model
{
    use BelongsToHouse;

    public const SOURCE_MANUAL = 'manual';
    public const SOURCE_LIST   = 'list';
    public const SOURCE_NFCE   = 'nfce';

    protected $fillable = [
        'date', 'store', 'store_cnpj', 'note', 'source',
        'nfce_access_key', 'nfce_url',
        'total', 'subtotal', 'discount', 'payment_method', 'per_member',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function memberPayments(): HasMany
    {
        return $this->hasMany(PurchaseMemberPayment::class);
    }
}
