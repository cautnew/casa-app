<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\Member;
use App\Models\PriceHistory;
use App\Models\Purchase;
use App\Models\PurchaseMemberPayment;

/**
 * Regras comuns de registro de compra, usadas pelos três fluxos:
 * compra manual, finalização da lista de compras e importação de NFC-e.
 *
 * Deve ser chamado dentro de uma transação.
 */
class PurchaseRecorder
{
    /**
     * @param  array  $attributes  atributos da compra (date, store, note, source, ...); total e per_member são calculados
     * @param  array  $items  cada item: name, category, quantity, unit, unit_price, total_price,
     *                        e opcionalmente original_name, original_unit_price, original_total_price,
     *                        add_to_inventory (default true)
     * @param  array  $memberPayments  [['memberId' => int, 'amount' => float], ...]
     * @param  float|null  $total  total da compra; quando nulo, soma dos itens
     */
    public function record(array $attributes, array $items, array $memberPayments = [], ?float $total = null): Purchase
    {
        $total ??= round(collect($items)->sum('total_price'), 2);

        $purchase = Purchase::create([
            ...$attributes,
            'total'      => $total,
            'per_member' => $this->perMember($total),
        ]);

        foreach ($items as $item) {
            $purchase->items()->create([
                'name'                 => $item['name'],
                'original_name'        => $item['original_name'] ?? null,
                'category'             => $item['category'],
                'quantity'             => $item['quantity'],
                'unit'                 => $item['unit'],
                'unit_price'           => $item['unit_price'],
                'total_price'          => $item['total_price'],
                'original_unit_price'  => $item['original_unit_price'] ?? null,
                'original_total_price' => $item['original_total_price'] ?? null,
            ]);

            if ($item['add_to_inventory'] ?? true) {
                $this->upsertInventory($item, $purchase->date, $purchase->store);
            }
        }

        $this->saveMemberPayments($purchase->id, $memberPayments);

        return $purchase;
    }

    public function perMember(float $total): float
    {
        return round($total / max(1, Member::count()), 2);
    }

    public function saveMemberPayments(int $purchaseId, array $payments): void
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

    /** Soma a quantidade ao inventário (criando o item se preciso) e registra o preço pago. */
    public function upsertInventory(array $item, string $date, string $store): InventoryItem
    {
        $normName  = mb_strtolower(trim($item['name']));
        $unit      = $item['unit'];
        $unitPrice = (float) $item['unit_price'];

        $inv = InventoryItem::all()->first(
            fn ($i) => mb_strtolower(trim($i->name)) === $normName && $i->unit === $unit
        );

        if ($inv === null) {
            $inv = InventoryItem::create([
                'name'         => trim($item['name']),
                'category'     => $item['category'],
                'quantity'     => $item['quantity'],
                'unit'         => $unit,
                'min_stock'    => max(1, round($item['quantity'] * 0.3)),
                'in_next_list' => false,
                'last_price'   => $unitPrice,
                'avg_price'    => $unitPrice,
            ]);
        } else {
            $inv->quantity += $item['quantity'];
        }

        PriceHistory::create([
            'inventory_item_id' => $inv->id,
            'date'              => $date,
            'price'             => $unitPrice,
            'store'             => $store,
        ]);

        $inv->last_price = $unitPrice;
        $inv->avg_price  = round(PriceHistory::where('inventory_item_id', $inv->id)->avg('price'), 2);
        $inv->save();

        return $inv;
    }
}
