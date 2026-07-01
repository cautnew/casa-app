<?php

namespace App\Models;

use App\Models\Concerns\BelongsToHouse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    use BelongsToHouse;

    protected $fillable = [
        'name', 'category', 'quantity', 'unit',
        'min_stock', 'in_next_list', 'last_price', 'avg_price',
    ];

    protected $casts = [
        'in_next_list' => 'boolean',
        'quantity'     => 'float',
        'min_stock'    => 'float',
        'last_price'   => 'float',
        'avg_price'    => 'float',
    ];

    public function priceHistory(): HasMany
    {
        return $this->hasMany(PriceHistory::class)->orderBy('date');
    }

    public function shoppingItems(): HasMany
    {
        return $this->hasMany(ShoppingListItem::class, 'source_inventory_id');
    }
}
