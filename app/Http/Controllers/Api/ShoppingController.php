<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Purchase;
use App\Models\ShoppingListItem;
use App\Services\PurchaseRecorder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShoppingController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name'              => 'required|string|max:150',
            'category'          => 'required|string|max:100',
            'desiredQty'        => 'required|numeric|min:0',
            'unit'              => 'required|string|max:20',
            'sourceInventoryId' => 'nullable|integer',
        ]);

        $item = ShoppingListItem::create([
            'name'                => $data['name'],
            'category'            => $data['category'],
            'desired_qty'         => $data['desiredQty'],
            'unit'                => $data['unit'],
            'bought'              => false,
            'source_inventory_id' => $data['sourceInventoryId'] ?? null,
        ]);

        return response()->json($item, 201);
    }

    public function update(Request $request, ShoppingListItem $shopping)
    {
        $data = $request->validate([
            'name'       => 'sometimes|string|max:150',
            'category'   => 'sometimes|string|max:100',
            'desiredQty' => 'sometimes|numeric|min:0',
            'unit'       => 'sometimes|string|max:20',
        ]);

        $mapped = [];
        if (isset($data['name']))       $mapped['name']        = $data['name'];
        if (isset($data['category']))   $mapped['category']    = $data['category'];
        if (isset($data['desiredQty'])) $mapped['desired_qty'] = $data['desiredQty'];
        if (isset($data['unit']))       $mapped['unit']        = $data['unit'];

        $shopping->update($mapped);

        return response()->json($shopping);
    }

    public function destroy(ShoppingListItem $shopping)
    {
        if ($shopping->source_inventory_id) {
            InventoryItem::where('id', $shopping->source_inventory_id)
                ->update(['in_next_list' => false]);
        }
        $shopping->delete();

        return response()->noContent();
    }

    public function toggleBought(ShoppingListItem $shopping)
    {
        $shopping->update(['bought' => ! $shopping->bought]);

        return response()->json($shopping);
    }

    public function finalize(Request $request, PurchaseRecorder $recorder)
    {
        $data = $request->validate([
            'store'                      => 'required|string|max:150',
            'date'                       => 'required|string',
            'items'                      => 'required|array|min:1',
            'items.*.id'                 => 'required|integer',
            'items.*.name'               => 'required|string',
            'items.*.category'           => 'required|string',
            'items.*.quantity'           => 'required|numeric|min:0',
            'items.*.unit'               => 'required|string',
            'items.*.unitPrice'          => 'required|numeric|min:0',
            'items.*.sourceInventoryId'  => 'nullable|integer',
            'memberPayments'             => 'nullable|array',
            'memberPayments.*.memberId'  => 'required|integer',
            'memberPayments.*.amount'    => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($data, $recorder) {
            $items = array_map(fn ($i) => [
                'name'        => $i['name'],
                'category'    => $i['category'],
                'quantity'    => $i['quantity'],
                'unit'        => $i['unit'],
                'unit_price'  => $i['unitPrice'],
                'total_price' => round($i['quantity'] * $i['unitPrice'], 2),
            ], $data['items']);

            $purchase = $recorder->record(
                [
                    'date'   => $data['date'],
                    'store'  => $data['store'],
                    'note'   => 'Gerada a partir da lista de compras',
                    'source' => Purchase::SOURCE_LIST,
                ],
                $items,
                $data['memberPayments'] ?? [],
            );

            $inventoryIds = collect($data['items'])->pluck('sourceInventoryId')->filter();
            if ($inventoryIds->isNotEmpty()) {
                InventoryItem::whereIn('id', $inventoryIds)->update(['in_next_list' => false]);
            }

            ShoppingListItem::whereIn('id', collect($data['items'])->pluck('id'))->delete();

            return response()->json($purchase->load('items', 'memberPayments'), 201);
        });
    }
}
