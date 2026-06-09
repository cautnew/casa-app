<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\InventoryItem;
use App\Models\Member;
use App\Models\Purchase;
use App\Models\ShoppingListItem;

class StateController extends Controller
{
    public function index()
    {
        $members = Member::orderBy('id')->get()->map(fn ($m) => [
            'id'    => $m->id,
            'name'  => $m->name,
            'color' => $m->color,
        ])->values();

        $purchases = Purchase::with('items', 'memberPayments')
            ->orderByDesc('date')->orderByDesc('id')->get()->map(fn ($p) => [
                'id'             => $p->id,
                'date'           => $p->date,
                'store'          => $p->store,
                'note'           => $p->note ?? '',
                'total'          => (float) $p->total,
                'perMember'      => (float) $p->per_member,
                'items'          => $p->items->map(fn ($i) => [
                    'id'         => $i->id,
                    'name'       => $i->name,
                    'category'   => $i->category,
                    'quantity'   => (float) $i->quantity,
                    'unit'       => $i->unit,
                    'unitPrice'  => (float) $i->unit_price,
                    'totalPrice' => (float) $i->total_price,
                ])->values(),
                'memberPayments' => $p->memberPayments->map(fn ($mp) => [
                    'memberId' => $mp->member_id,
                    'amount'   => (float) $mp->amount,
                ])->values(),
            ])->values();

        $inventory = InventoryItem::with('priceHistory')->orderBy('name')->get()->map(fn ($i) => [
            'id'           => $i->id,
            'name'         => $i->name,
            'category'     => $i->category,
            'quantity'     => (float) $i->quantity,
            'unit'         => $i->unit,
            'minStock'     => (float) $i->min_stock,
            'inNextList'   => (bool) $i->in_next_list,
            'lastPrice'    => (float) $i->last_price,
            'avgPrice'     => (float) $i->avg_price,
            'priceHistory' => $i->priceHistory->map(fn ($h) => [
                'date'  => $h->date,
                'price' => (float) $h->price,
                'store' => $h->store ?? '',
            ])->values(),
        ])->values();

        $shoppingList = ShoppingListItem::orderBy('id')->get()->map(fn ($s) => [
            'id'                => $s->id,
            'name'              => $s->name,
            'category'          => $s->category,
            'desiredQty'        => (float) $s->desired_qty,
            'unit'              => $s->unit,
            'bought'            => (bool) $s->bought,
            'sourceInventoryId' => $s->source_inventory_id,
        ])->values();

        $bills = Bill::with('memberPayments')->orderBy('due_date')->get()->map(fn ($b) => [
            'id'             => $b->id,
            'description'    => $b->description,
            'category'       => $b->category,
            'amount'         => (float) $b->amount,
            'dueDate'        => $b->due_date,
            'status'         => $b->status,
            'referenceMonth' => $b->reference_month,
            'note'               => $b->note ?? '',
            'paymentMethod'      => $b->payment_method ?? '',
            'paymentInstitution' => $b->payment_institution ?? '',
            'memberPayments' => $b->memberPayments->map(fn ($mp) => [
                'memberId' => $mp->member_id,
                'amount'   => (float) $mp->amount,
            ])->values(),
        ])->values();

        return response()->json(compact('members', 'purchases', 'inventory', 'shoppingList', 'bills'));
    }
}
