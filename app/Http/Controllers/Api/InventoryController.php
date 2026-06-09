<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\ShoppingListItem;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function update(Request $request, InventoryItem $inventory)
    {
        $data = $request->validate([
            'name'      => 'sometimes|string|max:150',
            'category'  => 'sometimes|string|max:100',
            'quantity'  => 'sometimes|numeric|min:0',
            'unit'      => 'sometimes|string|max:20',
            'minStock'  => 'sometimes|numeric|min:0',
        ]);

        $mapped = [];
        if (isset($data['name']))     $mapped['name']      = $data['name'];
        if (isset($data['category'])) $mapped['category']  = $data['category'];
        if (isset($data['quantity'])) $mapped['quantity']  = $data['quantity'];
        if (isset($data['unit']))     $mapped['unit']      = $data['unit'];
        if (isset($data['minStock'])) $mapped['min_stock'] = $data['minStock'];

        $inventory->update($mapped);

        return response()->json($inventory);
    }

    public function updateQty(Request $request, InventoryItem $inventory)
    {
        $data = $request->validate(['quantity' => 'required|numeric|min:0']);
        $inventory->update(['quantity' => $data['quantity']]);

        return response()->json($inventory);
    }

    public function toggleNextList(InventoryItem $inventory)
    {
        $willAdd = ! $inventory->in_next_list;
        $inventory->update(['in_next_list' => $willAdd]);

        if ($willAdd) {
            $alreadyInList = ShoppingListItem::where('source_inventory_id', $inventory->id)->exists();
            if (! $alreadyInList) {
                ShoppingListItem::create([
                    'name'                => $inventory->name,
                    'category'            => $inventory->category,
                    'desired_qty'         => max(1, $inventory->min_stock),
                    'unit'                => $inventory->unit,
                    'bought'              => false,
                    'source_inventory_id' => $inventory->id,
                ]);
            }
        } else {
            ShoppingListItem::where('source_inventory_id', $inventory->id)->delete();
        }

        return response()->json($inventory);
    }

    public function destroy(InventoryItem $inventory)
    {
        $inventory->delete();

        return response()->noContent();
    }
}
