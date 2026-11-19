<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Services\PurchaseRecorder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseController extends Controller
{
    public function __construct(private PurchaseRecorder $recorder) {}

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());

        return DB::transaction(function () use ($data) {
            $purchase = $this->recorder->record(
                [
                    'date'   => $data['date'],
                    'store'  => $data['store'],
                    'note'   => $data['note'] ?? '',
                    'source' => Purchase::SOURCE_MANUAL,
                ],
                $this->mapItems($data['items']),
                $data['memberPayments'] ?? [],
            );

            return response()->json($purchase->load('items', 'memberPayments'), 201);
        });
    }

    public function update(Request $request, Purchase $purchase)
    {
        $data = $request->validate($this->rules());

        return DB::transaction(function () use ($data, $purchase) {
            $items = $this->mapItems($data['items']);
            $total = round(collect($items)->sum('total_price'), 2);

            $purchase->update([
                'date'       => $data['date'],
                'store'      => $data['store'],
                'note'       => $data['note'] ?? '',
                'total'      => $total,
                'per_member' => $this->recorder->perMember($total),
            ]);

            // Preserva a descrição/valores originais da nota quando o item continua com o mesmo nome.
            $originals = $purchase->items()->get()->keyBy(fn ($i) => mb_strtolower(trim($i->name)));

            $purchase->items()->delete();
            foreach ($items as $i) {
                $orig = $originals->get(mb_strtolower(trim($i['name'])));
                $purchase->items()->create([
                    'name'                 => $i['name'],
                    'category'             => $i['category'],
                    'quantity'             => $i['quantity'],
                    'unit'                 => $i['unit'],
                    'unit_price'           => $i['unit_price'],
                    'total_price'          => $i['total_price'],
                    'original_name'        => $orig?->original_name,
                    'original_unit_price'  => $orig?->original_unit_price,
                    'original_total_price' => $orig?->original_total_price,
                ]);
            }

            $this->recorder->saveMemberPayments($purchase->id, $data['memberPayments'] ?? []);

            return response()->json($purchase->load('items', 'memberPayments'));
        });
    }

    public function destroy(Purchase $purchase)
    {
        $purchase->delete();

        return response()->noContent();
    }

    private function rules(): array
    {
        return [
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
        ];
    }

    private function mapItems(array $items): array
    {
        return array_map(fn ($i) => [
            'name'        => $i['name'],
            'category'    => $i['category'],
            'quantity'    => $i['quantity'],
            'unit'        => $i['unit'],
            'unit_price'  => $i['unitPrice'],
            'total_price' => round($i['quantity'] * $i['unitPrice'], 4),
        ], $items);
    }
}
