<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Member;
use App\Models\Purchase;
use App\Models\PurchaseMemberPayment;
use App\Models\PriceHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'date'                       => 'required|string',
            'store'                      => 'required|string|max:150',
            'note'                       => 'nullable|string',
            'items'                      => 'required|array|min:1',
            'items.*.name'               => 'required|string',
            'items.*.category'           => 'required|string',
            'items.*.quantity'           => 'required|numeric|min:0',
            'items.*.unit'               => 'required|string',
            'items.*.unitPrice'          => 'required|numeric|min:0',
            'memberPayments'             => 'nullable|array',
            'memberPayments.*.memberId'  => 'required|integer',
            'memberPayments.*.amount'    => 'required|numeric|min:0',
        ]);

        $memberCount = max(1, Member::count());

        return DB::transaction(function () use ($data, $memberCount) {
            $items = collect($data['items'])->map(fn ($i) => [
                ...$i,
                'totalPrice' => round($i['quantity'] * $i['unitPrice'], 4),
            ]);

            $total     = round($items->sum('totalPrice'), 2);
            $perMember = round($total / $memberCount, 2);

            $purchase = Purchase::create([
                'date'       => $data['date'],
                'store'      => $data['store'],
                'note'       => $data['note'] ?? '',
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
            }

            $this->saveMemberPayments($purchase->id, $data['memberPayments'] ?? []);

            return response()->json($purchase->load('items', 'memberPayments'), 201);
        });
    }

    public function update(Request $request, Purchase $purchase)
    {
        $data = $request->validate([
            'date'                       => 'required|string',
            'store'                      => 'required|string|max:150',
            'note'                       => 'nullable|string',
            'items'                      => 'required|array|min:1',
            'items.*.name'               => 'required|string',
            'items.*.category'           => 'required|string',
            'items.*.quantity'           => 'required|numeric|min:0',
            'items.*.unit'               => 'required|string',
            'items.*.unitPrice'          => 'required|numeric|min:0',
            'memberPayments'             => 'nullable|array',
            'memberPayments.*.memberId'  => 'required|integer',
            'memberPayments.*.amount'    => 'required|numeric|min:0',
        ]);

        $memberCount = max(1, Member::count());

        return DB::transaction(function () use ($data, $purchase, $memberCount) {
            $items = collect($data['items'])->map(fn ($i) => [
                ...$i,
                'totalPrice' => round($i['quantity'] * $i['unitPrice'], 4),
            ]);

            $total     = round($items->sum('totalPrice'), 2);
            $perMember = round($total / $memberCount, 2);

            $purchase->update([
                'date'       => $data['date'],
                'store'      => $data['store'],
                'note'       => $data['note'] ?? '',
                'total'      => $total,
                'per_member' => $perMember,
            ]);

            $purchase->items()->delete();
            foreach ($items as $i) {
                $purchase->items()->create([
                    'name'        => $i['name'],
                    'category'    => $i['category'],
                    'quantity'    => $i['quantity'],
                    'unit'        => $i['unit'],
                    'unit_price'  => $i['unitPrice'],
                    'total_price' => $i['totalPrice'],
                ]);
            }

            $this->saveMemberPayments($purchase->id, $data['memberPayments'] ?? []);

            return response()->json($purchase->load('items', 'memberPayments'));
        });
    }

    public function destroy(Purchase $purchase)
    {
        $purchase->delete();

        return response()->noContent();
    }

    private function saveMemberPayments(int $purchaseId, array $payments): void
    {
        PurchaseMemberPayment::where('purchase_id', $purchaseId)->delete();
        foreach ($payments as $p) {
            PurchaseMemberPayment::create([
                'purchase_id' => $purchaseId,
                'member_id'   => $p['memberId'],
                'amount'      => round($p['amount'], 2),
            ]);
        }
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
                'name'        => $item['name'],
                'category'    => $item['category'],
                'quantity'    => $item['quantity'],
                'unit'        => $unit,
                'min_stock'   => max(1, round($item['quantity'] * 0.3)),
                'in_next_list'=> false,
                'last_price'  => $item['unitPrice'],
                'avg_price'   => $item['unitPrice'],
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
