<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Member;
use App\Models\Purchase;
use App\Models\PurchaseMemberPayment;
use App\Models\PriceHistory;
use App\Models\ShoppingListItem;
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

    public function finalize(Request $request)
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

        $memberCount = max(1, Member::count());

        return DB::transaction(function () use ($data, $memberCount) {
            $items = collect($data['items'])->map(fn ($i) => [
                ...$i,
                'totalPrice' => round($i['quantity'] * $i['unitPrice'], 2),
            ]);

            $total     = round($items->sum('totalPrice'), 2);
            $perMember = round($total / $memberCount, 2);

            $purchase = Purchase::create([
                'date'       => $data['date'],
                'store'      => $data['store'],
                'note'       => 'Gerada a partir da lista de compras',
                'total'      => $total,
                'per_member' => $perMember,
            ]);

            foreach ($items as $i) {
                $purchase->items()->create([
                    'name'        => $i['name'],
                    'category'    => $i['category'],
                    'quantity'    => $i['quantity'],
                    'unit'        => $i['unit'],
                    'unit_price'  => $i['unitPrice'],
                    'total_price' => $i['totalPrice'],
                ]);

                $this->upsertInventory($i, $data['date'], $data['store']);

                if (! empty($i['sourceInventoryId'])) {
                    InventoryItem::where('id', $i['sourceInventoryId'])
                        ->update(['in_next_list' => false]);
                }
            }

            foreach ($data['memberPayments'] ?? [] as $p) {
                PurchaseMemberPayment::create([
                    'purchase_id' => $purchase->id,
                    'member_id'   => $p['memberId'],
                    'amount'      => round($p['amount'], 2),
                ]);
            }

            $ids = collect($data['items'])->pluck('id');
            ShoppingListItem::whereIn('id', $ids)->delete();

            return response()->json($purchase->load('items', 'memberPayments'), 201);
        });
    }

    private function upsertInventory(array $item, string $date, string $store): void
    {
        $normName = mb_strtolower(trim($item['name']));
        $unit     = $item['unit'];

        $inv = InventoryItem::all()->first(
            fn ($i) => mb_strtolower(trim($i->name)) === $normName && $i->unit === $unit
        );

        if ($inv === null) {
            $inv = InventoryItem::create([
                'name'         => $item['name'],
                'category'     => $item['category'],
                'quantity'     => $item['quantity'],
                'unit'         => $unit,
                'min_stock'    => max(1, round($item['quantity'] * 0.3)),
                'in_next_list' => false,
                'last_price'   => $item['unitPrice'],
                'avg_price'    => $item['unitPrice'],
            ]);
        } else {
            $inv->quantity += $item['quantity'];
        }

        PriceHistory::create([
            'inventory_item_id' => $inv->id,
            'date'              => $date,
            'price'             => $item['unitPrice'],
            'store'             => $store,
        ]);

        $avg = PriceHistory::where('inventory_item_id', $inv->id)->avg('price');
        $inv->last_price = $item['unitPrice'];
        $inv->avg_price  = round($avg, 2);
        $inv->save();
    }
}
