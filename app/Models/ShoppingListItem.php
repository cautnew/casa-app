<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShoppingListItem extends Model
{
    protected $fillable = [
        'name', 'category', 'desired_qty', 'unit', 'bought', 'source_inventory_id',
    ];

    protected $casts = [
        'bought'      => 'boolean',
        'desired_qty' => 'float',
    ];

    public function sourceInventory(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'source_inventory_id');
    }
}
