<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Nfce\NfceImporter;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Importação de compras a partir de NFC-e. Erros esperados viram JSON via NfceException (bootstrap/app.php). */
class NfceController extends Controller
{
    private const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'pacote', 'caixa'];

    public function __construct(private NfceImporter $importer) {}

    /** QR Code lido, link colado ou chave digitada. */
    public function read(Request $request)
    {
        $data = $request->validate(['input' => 'required|string|max:2000']);

        return response()->json($this->importer->read($data['input']));
    }

    public function refreshCaptcha(Request $request)
    {
        $data = $request->validate(['sessionId' => 'required|string|size:32']);

        return response()->json($this->importer->refreshCaptcha($data['sessionId']));
    }

    public function submitCaptcha(Request $request)
    {
        $data = $request->validate([
            'sessionId' => 'required|string|size:32',
            'code'      => 'required|string|max:10',
        ]);

        return response()->json($this->importer->submitCaptcha($data['sessionId'], trim($data['code'])));
    }

    public function import(Request $request)
    {
        $data = $request->validate([
            'accessKey'                  => 'required|digits:44',
            'store'                      => 'required|string|max:150',
            'date'                       => 'required|date_format:Y-m-d',
            'items'                      => 'required|array|min:1',
            'items.*.index'              => 'required|integer|min:0',
            'items.*.include'            => 'required|boolean',
            'items.*.name'               => 'required|string|max:150',
            'items.*.category'           => 'required|string|max:100',
            'items.*.unit'               => ['required', Rule::in(self::UNITS)],
            'items.*.quantity'           => 'nullable|numeric|gt:0',
            'items.*.shoppingListItemId' => 'nullable|integer',
            'memberPayments'             => 'nullable|array',
            'memberPayments.*.memberId'  => 'required|integer',
            'memberPayments.*.amount'    => 'required|numeric|min:0',
        ]);

        $purchase = $this->importer->import($data);

        return response()->json($purchase->load('items', 'memberPayments'), 201);
    }
}
