<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bill;
use App\Models\BillMemberPayment;
use Illuminate\Http\Request;

class BillController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'description' => 'required|string|max:200',
            'category' => 'required|string|max:100',
            'amount' => 'required|numeric|min:0',
            'dueDate' => 'required|string',
            'status' => 'sometimes|string|in:pendente,paga',
            'referenceMonth' => 'required|string',
            'note' => 'nullable|string',
            'paymentMethod' => 'nullable|string|max:50',
            'paymentInstitution' => 'nullable|string|max:100',
            'memberPayments' => 'nullable|array',
            'memberPayments.*.memberId' => 'required|integer',
            'memberPayments.*.amount' => 'required|numeric|min:0',
        ]);

        $bill = Bill::create([
            'description' => $data['description'],
            'category' => $data['category'],
            'amount' => $data['amount'],
            'due_date' => $data['dueDate'],
            'status' => $data['status'] ?? 'pendente',
            'reference_month' => $data['referenceMonth'],
            'note' => $data['note'] ?? '',
            'payment_method' => $data['paymentMethod'] ?? null,
            'payment_institution' => $data['paymentInstitution'] ?? null,
        ]);

        if (($data['status'] ?? 'pendente') === 'paga') {
            $this->saveMemberPayments($bill->id, $data['memberPayments'] ?? []);
        }

        return response()->json($bill, 201);
    }

    public function update(Request $request, Bill $bill)
    {
        $data = $request->validate([
            'description' => 'sometimes|string|max:200',
            'category' => 'sometimes|string|max:100',
            'amount' => 'sometimes|numeric|min:0',
            'dueDate' => 'sometimes|string',
            'status' => 'sometimes|string|in:pendente,paga',
            'referenceMonth' => 'sometimes|string',
            'note' => 'nullable|string',
            'paymentMethod' => 'nullable|string|max:50',
            'paymentInstitution' => 'nullable|string|max:100',
            'memberPayments' => 'nullable|array',
            'memberPayments.*.memberId' => 'required|integer',
            'memberPayments.*.amount' => 'required|numeric|min:0',
        ]);

        $mapped = [];
        foreach (['description', 'category', 'amount', 'status', 'note'] as $f) {
            if (isset($data[$f])) $mapped[$f] = $data[$f];
        }

        if (isset($data['dueDate']))
            $mapped['due_date'] = $data['dueDate'];
        if (isset($data['referenceMonth']))
            $mapped['reference_month'] = $data['referenceMonth'];
        if (\array_key_exists('paymentMethod', $data))
            $mapped['payment_method'] = $data['paymentMethod'];
        if (\array_key_exists('paymentInstitution', $data))
            $mapped['payment_institution'] = $data['paymentInstitution'];

        $bill->update($mapped);

        if (isset($data['memberPayments'])) {
            $this->saveMemberPayments($bill->id, $data['memberPayments']);
        }

        return response()->json($bill);
    }

    public function destroy(Bill $bill)
    {
        $bill->delete();

        return response()->noContent();
    }

    public function setStatus(Request $request, Bill $bill)
    {
        $data = $request->validate([
            'status' => 'required|string|in:pendente,paga',
            'memberPayments' => 'nullable|array',
            'memberPayments.*.memberId' => 'required|integer',
            'memberPayments.*.amount' => 'required|numeric|min:0',
        ]);

        $bill->update(['status' => $data['status']]);

        if ($data['status'] === 'paga') {
            $this->saveMemberPayments($bill->id, $data['memberPayments'] ?? []);
        } elseif ($data['status'] === 'pendente') {
            BillMemberPayment::where('bill_id', $bill->id)->delete();
        }

        return response()->json($bill);
    }

    private function saveMemberPayments(int $billId, array $payments): void
    {
        BillMemberPayment::where('bill_id', $billId)->delete();
        foreach ($payments as $p) {
            BillMemberPayment::create([
                'bill_id'   => $billId,
                'member_id' => $p['memberId'],
                'amount'    => round($p['amount'], 2),
            ]);
        }
    }
}
