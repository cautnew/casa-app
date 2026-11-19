<?php

namespace App\Services\Nfce;

use App\Models\InventoryItem;
use App\Models\ProductAlias;
use App\Models\Purchase;
use App\Models\ShoppingListItem;
use App\Models\StoreAlias;
use App\Services\PurchaseRecorder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Orquestra a importação de uma NFC-e: leitura (link direto ou QR + código de segurança),
 * prévia para revisão e gravação da compra. Ver docs/plano-importacao-nfce.md.
 */
class NfceImporter
{
    private const NOTE_TTL    = 7200; // nota lida fica disponível 2h para a revisão
    private const CAPTCHA_TTL = 600;  // sessão do código de segurança: 10 min

    public function __construct(
        private RnSefazClient $sefaz,
        private ItemMatcher $matcher,
        private PurchaseRecorder $recorder,
    ) {}

    /**
     * Ponto de entrada único para QR Code, link colado ou chave digitada.
     *
     * @return array ['status' => 'duplicate'|'captcha'|'ready', ...]
     */
    public function read(string $input): array
    {
        $link = NfceLink::parse($input);

        // Barreira 1: a chave já é conhecida — avisa antes de consultar a SEFAZ (e sem pedir código).
        if ($existing = $this->existingPurchase($link->key->value)) {
            return ['status' => 'duplicate', 'alreadyImported' => $existing];
        }

        if ($link->isDirect()) {
            $note = $this->sefaz->fetchDanfe($link);

            return ['status' => 'ready', 'preview' => $this->preview($note, RnSefazClient::danfeUrl($link))];
        }

        $started   = $this->sefaz->startCaptcha($link->key);
        $sessionId = Str::random(32);
        Cache::put($this->captchaCacheKey($sessionId), $started['state'], self::CAPTCHA_TTL);

        return [
            'status'    => 'captcha',
            'sessionId' => $sessionId,
            'captcha'   => $started['captcha'],
            'note'      => $this->keySummary($link->key),
        ];
    }

    public function refreshCaptcha(string $sessionId): array
    {
        $state = $this->captchaState($sessionId);

        return ['captcha' => $this->sefaz->captchaImage($state)];
    }

    public function submitCaptcha(string $sessionId, string $code): array
    {
        $state = $this->captchaState($sessionId);

        try {
            $note = $this->sefaz->submitCaptcha($state, $code);
        } catch (NfceException $e) {
            if ($e->errorCode === NfceException::WRONG_CODE) {
                Cache::put($this->captchaCacheKey($sessionId), $e->extra['state'], self::CAPTCHA_TTL);
                throw new NfceException($e->errorCode, $e->getMessage(), ['captcha' => $e->extra['captcha']]);
            }
            throw $e;
        }

        Cache::forget($this->captchaCacheKey($sessionId));
        $key = AccessKey::tryFrom($state['key']);

        return ['status' => 'ready', 'preview' => $this->preview($note, RnSefazClient::qrUrl($key))];
    }

    /** Monta a prévia para a tela de revisão e guarda a nota lida em cache para o import. */
    public function preview(array $note, string $url): array
    {
        if (! $note['authorized']) {
            throw new NfceException(NfceException::NOT_AUTHORIZED, "Esta nota não pode ser importada: situação \"{$note['status']}\".");
        }

        Cache::put($this->noteCacheKey($note['accessKey']), ['note' => $note, 'url' => $url], self::NOTE_TTL);

        $cnpj        = $note['store']['cnpj'];
        $allocated   = DiscountAllocator::allocate(array_column($note['items'], 'totalPrice'), $note['paid']);
        $suggestions = $this->matcher->suggest($note['items'], $cnpj);
        $storeAlias  = StoreAlias::where('cnpj', $cnpj)->first();
        $date        = substr((string) $note['issuedAt'], 0, 10) ?: now()->toDateString();

        $items = array_map(function ($item) use ($allocated, $suggestions) {
            $total = $allocated[$item['index']];
            $s     = $suggestions[$item['index']];

            return [
                'index'              => $item['index'],
                'description'        => $item['description'],
                'quantity'           => $item['quantity'],
                'unitRaw'            => $item['unitRaw'],
                'unit'               => $s['unit'] ?? $item['unit'],
                'originalUnitPrice'  => $item['unitPrice'],
                'originalTotalPrice' => $item['totalPrice'],
                'totalPrice'         => $total,
                'unitPrice'          => $item['quantity'] > 0 ? round($total / $item['quantity'], 4) : $total,
                'name'               => $s['name'],
                'category'           => $s['category'],
                'shoppingListItemId' => $s['shoppingListItemId'],
                'matchSource'        => $s['matchSource'],
            ];
        }, $note['items']);

        return [
            'accessKey'               => $note['accessKey'],
            'number'                  => $note['number'],
            'series'                  => $note['series'],
            'issuedAt'                => $note['issuedAt'],
            'date'                    => $date,
            'url'                     => $url,
            'store'                   => [
                'name'          => $storeAlias?->name ?? ($note['store']['tradeName'] ?: $note['store']['legalName']),
                'remembered'    => $storeAlias !== null,
                'legalName'     => $note['store']['legalName'],
                'tradeName'     => $note['store']['tradeName'],
                'cnpj'          => $cnpj,
                'cnpjFormatted' => self::formatCnpj($cnpj),
                'address'       => $note['store']['address'],
            ],
            'subtotal'                => $note['subtotal'],
            'itemsTotal'              => round(array_sum(array_column($note['items'], 'totalPrice')), 2),
            'discount'                => self::discount($note),
            'otherCharges'            => self::otherCharges($note),
            'paid'                    => $note['paid'],
            'payments'                => $note['payments'],
            'items'                   => $items,
            // Barreira 2: confere de novo (cobre leitura em paralelo por outra pessoa da casa).
            'alreadyImported'         => $this->existingPurchase($note['accessKey']),
            'possibleManualDuplicate' => $this->possibleManualDuplicate($date, $note['paid']),
        ];
    }

    /**
     * Grava a compra revisada.
     *
     * @param  array  $data  validado pelo controller
     */
    public function import(array $data): Purchase
    {
        $cached = Cache::get($this->noteCacheKey($data['accessKey']));
        if (! $cached) {
            throw new NfceException(NfceException::READ_EXPIRED, 'A leitura desta nota expirou. Leia a nota novamente para registrar.');
        }
        ['note' => $note, 'url' => $url] = $cached;

        $reviewed  = collect($data['items'])->keyBy('index');
        $allocated = DiscountAllocator::allocate(array_column($note['items'], 'totalPrice'), $note['paid']);
        $cnpj      = $note['store']['cnpj'];

        $items = [];
        $links = [];
        foreach ($note['items'] as $item) {
            $r        = $reviewed->get($item['index'], []);
            $quantity = isset($r['quantity']) && $r['quantity'] > 0 ? (float) $r['quantity'] : $item['quantity'];
            $total    = $allocated[$item['index']];
            $include  = $r['include'] ?? true;

            $items[] = [
                'name'                 => trim($r['name'] ?? ItemMatcher::friendlyName($item['description'])),
                'original_name'        => $item['description'],
                'category'             => $r['category'] ?? ItemMatcher::guessCategory($item['description']),
                'quantity'             => $quantity,
                'unit'                 => $r['unit'] ?? $item['unit'],
                'unit_price'           => $quantity > 0 ? round($total / $quantity, 4) : $total,
                'total_price'          => $total,
                'original_unit_price'  => $item['unitPrice'],
                'original_total_price' => $item['totalPrice'],
                'add_to_inventory'     => $include,
            ];
            if ($include && ! empty($r['shoppingListItemId'])) {
                $links[] = (int) $r['shoppingListItemId'];
            }
        }

        $paymentText = collect($note['payments'])
            ->map(fn ($p) => $p['amount'] !== null ? $p['method'].' '.number_format($p['amount'], 2, ',', '.') : $p['method'])
            ->implode('; ');

        try {
            $purchase = DB::transaction(function () use ($data, $note, $url, $items, $links, $cnpj, $paymentText) {
                // Barreira 3: confere dentro da transação.
                if ($existing = $this->existingPurchase($note['accessKey'])) {
                    throw new NfceException(NfceException::ALREADY_IMPORTED, 'Esta nota já foi registrada.', ['alreadyImported' => $existing]);
                }

                $purchase = $this->recorder->record(
                    [
                        'date'            => $data['date'].'T00:00:00.000Z',
                        'store'           => trim($data['store']),
                        'store_cnpj'      => $cnpj,
                        'note'            => "NFC-e nº {$note['number']} série {$note['series']}",
                        'source'          => Purchase::SOURCE_NFCE,
                        'nfce_access_key' => $note['accessKey'],
                        'nfce_url'        => $url,
                        'subtotal'        => $note['subtotal'],
                        'discount'        => self::discount($note),
                        'payment_method'  => $paymentText ?: null,
                    ],
                    $items,
                    $data['memberPayments'] ?? [],
                    $note['paid'],
                );

                $this->rememberChoices($note, $items, $cnpj, trim($data['store']));
                $this->removeFromShoppingList($links);

                return $purchase;
            });
        } catch (UniqueConstraintViolationException) {
            // Barreira 4: o índice único pegou uma importação simultânea.
            throw new NfceException(NfceException::ALREADY_IMPORTED, 'Esta nota já foi registrada.', [
                'alreadyImported' => $this->existingPurchase($note['accessKey']),
            ]);
        }

        Cache::forget($this->noteCacheKey($data['accessKey']));

        return $purchase;
    }

    private function rememberChoices(array $note, array $items, string $cnpj, string $storeName): void
    {
        if ($cnpj !== '') {
            StoreAlias::updateOrCreate(['cnpj' => $cnpj], ['name' => $storeName]);
        }

        foreach ($items as $item) {
            ProductAlias::updateOrCreate(
                ['store_cnpj' => $cnpj, 'nf_description' => ItemMatcher::descriptionKey($item['original_name'])],
                ['name' => $item['name'], 'category' => $item['category'], 'unit' => $item['unit']],
            );
        }
    }

    private function removeFromShoppingList(array $ids): void
    {
        if (! $ids) {
            return;
        }
        $listItems    = ShoppingListItem::whereIn('id', $ids)->get();
        $inventoryIds = $listItems->pluck('source_inventory_id')->filter();
        if ($inventoryIds->isNotEmpty()) {
            InventoryItem::whereIn('id', $inventoryIds)->update(['in_next_list' => false]);
        }
        ShoppingListItem::whereIn('id', $listItems->pluck('id'))->delete();
    }

    public function existingPurchase(string $accessKey): ?array
    {
        $p = Purchase::withCount('items')->where('nfce_access_key', $accessKey)->first();

        return $p ? [
            'id'         => $p->id,
            'store'      => $p->store,
            'date'       => $p->date,
            'total'      => (float) $p->total,
            'itemsCount' => $p->items_count,
            'importedAt' => $p->created_at?->toIso8601String(),
        ] : null;
    }

    /** Compra sem nota na mesma data e com o mesmo total (±R$ 0,01): talvez já registrada à mão. */
    private function possibleManualDuplicate(string $date, float $paid): ?array
    {
        $p = Purchase::withCount('items')
            ->whereNull('nfce_access_key')
            ->where('date', 'like', $date.'%')
            ->whereBetween('total', [$paid - 0.01, $paid + 0.01])
            ->first();

        return $p ? ['id' => $p->id, 'store' => $p->store, 'date' => $p->date, 'total' => (float) $p->total, 'itemsCount' => $p->items_count] : null;
    }

    private function keySummary(AccessKey $key): array
    {
        return [
            'accessKey' => $key->value,
            'number'    => $key->number(),
            'series'    => $key->series(),
            'storeName' => StoreAlias::where('cnpj', $key->cnpj())->value('name'),
        ];
    }

    private function captchaState(string $sessionId): array
    {
        return Cache::get($this->captchaCacheKey($sessionId))
            ?? throw new NfceException(NfceException::SESSION_EXPIRED, 'O tempo para digitar o código acabou. Leia o QR Code novamente.');
    }

    private function noteCacheKey(string $accessKey): string
    {
        return 'nfce:note:'.Auth::id().':'.$accessKey;
    }

    private function captchaCacheKey(string $sessionId): string
    {
        return 'nfce:captcha:'.Auth::id().':'.$sessionId;
    }

    /** Desconto informado na nota (ou deduzido de subtotal − pago). */
    private static function discount(array $note): float
    {
        return $note['discount'] > 0 ? $note['discount'] : max(0, round($note['subtotal'] - $note['paid'], 2));
    }

    /**
     * Valores cobrados que não aparecem como item (frete, taxa de serviço...):
     * pago − soma dos itens + desconto. Ex.: itens 80,90 · desconto 4,99 · pago 92,91 → 17,00.
     */
    private static function otherCharges(array $note): float
    {
        $itemsTotal = array_sum(array_column($note['items'], 'totalPrice'));

        return max(0, round($note['paid'] - $itemsTotal + self::discount($note), 2));
    }

    public static function formatCnpj(string $cnpj): string
    {
        return strlen($cnpj) === 14
            ? vsprintf('%s.%s.%s/%s-%s', [substr($cnpj, 0, 2), substr($cnpj, 2, 3), substr($cnpj, 5, 3), substr($cnpj, 8, 4), substr($cnpj, 12, 2)])
            : $cnpj;
    }
}
