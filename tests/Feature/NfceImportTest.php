<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\Member;
use App\Models\ProductAlias;
use App\Models\Purchase;
use App\Models\ShoppingListItem;
use App\Models\StoreAlias;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class NfceImportTest extends TestCase
{
    use RefreshDatabase;

    private const KEY_SENDAS_9  = '24261106057223049502650050002499661053044530';
    private const KEY_SENDAS_22 = '24261106057223049502650020001768301020613606';
    private const KEY_SUSHI     = '24261155440120000100650020000343801066740769';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        $this->user = User::factory()->create();
        $this->actingAs($this->user);
    }

    private static function fixture(string $name): string
    {
        return file_get_contents(__DIR__.'/../Fixtures/nfce/'.$name.'.html');
    }

    private static function appLink(string $key): string
    {
        return "https://nfce.sefaz.rn.gov.br/portalDFE/nota-potiguar/nfce-mobile-danfe.aspx?chNFCe={$key}&token=AABBCCDDEEFF00112233&Sender=0011223344556677";
    }

    private static function qr(string $key): string
    {
        return "http://nfce.set.rn.gov.br/consultarNFCe.aspx?p={$key}|3|1";
    }

    private function fakeDanfe(string $fixture): void
    {
        Http::fake(['nfce.sefaz.rn.gov.br/portalDFE/nota-potiguar/*' => Http::response(self::fixture($fixture))]);
    }

    private function readReady(string $fixture, string $key): array
    {
        $this->fakeDanfe($fixture);

        return $this->postJson('/api/nfce/read', ['input' => self::appLink($key)])
            ->assertOk()->assertJsonPath('status', 'ready')->json('preview');
    }

    /** Payload de import "aceitando tudo como sugerido". */
    private static function importPayload(array $preview, array $overrides = []): array
    {
        return [
            'accessKey' => $preview['accessKey'],
            'store'     => $preview['store']['name'],
            'date'      => $preview['date'],
            'items'     => array_map(fn ($i) => [
                'index'              => $i['index'],
                'include'            => true,
                'name'               => $i['name'],
                'category'           => $i['category'],
                'unit'               => $i['unit'],
                'shoppingListItemId' => $i['shoppingListItemId'],
            ], $preview['items']),
            ...$overrides,
        ];
    }

    public function test_reads_app_link_and_builds_preview_with_suggestions(): void
    {
        $banana = ShoppingListItem::create(['name' => 'Banana', 'category' => 'Hortifruti', 'desired_qty' => 1, 'unit' => 'kg', 'bought' => true]);
        $leite  = ShoppingListItem::create(['name' => 'Leite em pó', 'category' => 'Alimentos', 'desired_qty' => 1, 'unit' => 'un', 'bought' => false]);
        ShoppingListItem::create(['name' => 'Ovos', 'category' => 'Alimentos', 'desired_qty' => 12, 'unit' => 'un', 'bought' => false]);

        $p = $this->readReady('sendas-9-itens', self::KEY_SENDAS_9);

        $this->assertSame('Loja 268 - Natal Maria Lacerda', $p['store']['name']);
        $this->assertFalse($p['store']['remembered']);
        $this->assertSame('06.057.223/0495-02', $p['store']['cnpjFormatted']);
        $this->assertSame('2026-11-11', $p['date']);
        $this->assertSame(158.91, $p['paid']);
        $this->assertCount(9, $p['items']);
        $this->assertNull($p['alreadyImported']);

        $byDesc = collect($p['items'])->keyBy('description');
        $this->assertSame($banana->id, $byDesc['BANANA PRATA kg']['shoppingListItemId']);
        $this->assertSame('Banana', $byDesc['BANANA PRATA kg']['name']);
        $this->assertSame('list', $byDesc['BANANA PRATA kg']['matchSource']);
        $this->assertSame($leite->id, $byDesc['LTE PO NOLAC 300G']['shoppingListItemId']);
        $this->assertSame('pacote', $byDesc['LTE PO NOLAC 300G']['unit']);
        $this->assertSame('Kiwi', $byDesc['KIWI kg']['name']);
        $this->assertSame('Hortifruti', $byDesc['KIWI kg']['category']);
        $this->assertNull($byDesc['KIWI kg']['shoppingListItemId']);

        Http::assertSent(fn (Request $r) => str_starts_with($r->url(), 'https://nfce.sefaz.rn.gov.br/'));
    }

    public function test_import_records_purchase_inventory_list_and_memory(): void
    {
        $inv = InventoryItem::create(['name' => 'Banana', 'category' => 'Hortifruti', 'quantity' => 0, 'unit' => 'kg', 'min_stock' => 1, 'in_next_list' => true, 'last_price' => 5, 'avg_price' => 5]);
        $banana = ShoppingListItem::create(['name' => 'Banana', 'category' => 'Hortifruti', 'desired_qty' => 1, 'unit' => 'kg', 'bought' => true, 'source_inventory_id' => $inv->id]);
        $ovos = ShoppingListItem::create(['name' => 'Ovos', 'category' => 'Alimentos', 'desired_qty' => 12, 'unit' => 'un', 'bought' => false]);
        $m = Member::create(['name' => 'Ana', 'color' => 'bg-rose-400']);

        $p = $this->readReady('sendas-9-itens', self::KEY_SENDAS_9);
        $payload = self::importPayload($p, ['store' => 'Assaí Maria Lacerda', 'memberPayments' => [['memberId' => $m->id, 'amount' => 158.91]]]);
        // Usuário renomeia o leite e desmarca o pão do estoque.
        foreach ($payload['items'] as &$i) {
            if ($p['items'][$i['index']]['description'] === 'LTE PO NOLAC 300G') {
                $i['name'] = 'Leite em pó';
                $i['category'] = 'Alimentos';
            }
            if ($p['items'][$i['index']]['description'] === 'PAO INT PLUS V 480G') {
                $i['include'] = false;
            }
        }
        unset($i);

        $this->postJson('/api/nfce/import', $payload)->assertCreated();

        $purchase = Purchase::with('items', 'memberPayments')->sole();
        $this->assertSame('nfce', $purchase->source);
        $this->assertSame(self::KEY_SENDAS_9, $purchase->nfce_access_key);
        $this->assertSame('Assaí Maria Lacerda', $purchase->store);
        $this->assertSame('06057223049502', $purchase->store_cnpj);
        $this->assertSame('2026-11-11T00:00:00.000Z', $purchase->date);
        $this->assertEquals(158.91, (float) $purchase->total);
        $this->assertSame('Vale Alimentação', $purchase->payment_method);
        $this->assertCount(9, $purchase->items);
        $this->assertEqualsWithDelta(158.91, $purchase->items->sum(fn ($i) => (float) $i->total_price), 0.001);
        $this->assertSame('KIWI kg', $purchase->items->firstWhere('name', 'Kiwi')->original_name);
        $this->assertCount(1, $purchase->memberPayments);

        // Lista: banana vinculada sai, ovos ficam; inventário de origem desmarcado.
        $this->assertDatabaseMissing('shopping_list_items', ['id' => $banana->id]);
        $this->assertDatabaseHas('shopping_list_items', ['id' => $ovos->id]);
        $inv->refresh();
        $this->assertFalse($inv->in_next_list);
        $this->assertEquals(1.18, $inv->quantity);

        // Pão foi registrado na compra, mas não entrou no estoque.
        $this->assertNotNull($purchase->items->firstWhere('original_name', 'PAO INT PLUS V 480G'));
        $this->assertSame(0, InventoryItem::where('name', 'like', 'Pao%')->count());
        $this->assertSame(1, InventoryItem::where('name', 'Leite em pó')->where('unit', 'pacote')->count());

        // Memória: nome da loja e vínculo do produto.
        $this->assertSame('Assaí Maria Lacerda', StoreAlias::where('cnpj', '06057223049502')->value('name'));
        $this->assertSame('Leite em pó', ProductAlias::where('nf_description', 'lte po nolac 300g')->value('name'));
    }

    public function test_second_note_from_same_store_uses_remembered_names(): void
    {
        $p = $this->readReady('sendas-9-itens', self::KEY_SENDAS_9);
        $payload = self::importPayload($p, ['store' => 'Assaí Maria Lacerda']);
        foreach ($payload['items'] as &$i) {
            if ($p['items'][$i['index']]['description'] === 'LTE PO NOLAC 300G') {
                [$i['name'], $i['category']] = ['Leite em pó', 'Alimentos'];
            }
        }
        unset($i);
        $this->postJson('/api/nfce/import', $payload)->assertCreated();

        $p2 = $this->readReady('sendas-22-itens-2-pagamentos', self::KEY_SENDAS_22);

        $this->assertSame('Assaí Maria Lacerda', $p2['store']['name']);
        $this->assertTrue($p2['store']['remembered']);
        $leite = collect($p2['items'])->firstWhere('description', 'LTE PO NOLAC 300G');
        $this->assertSame('Leite em pó', $leite['name']);
        $this->assertSame('alias', $leite['matchSource']);
    }

    public function test_discount_is_distributed_and_other_charges_reported(): void
    {
        $p = $this->readReady('sushi-desconto', self::KEY_SUSHI);

        $this->assertSame(80.90, $p['itemsTotal']);
        $this->assertSame(4.99, $p['discount']);
        $this->assertEquals(17.0, $p['otherCharges']);
        $this->assertSame(92.91, $p['items'][0]['totalPrice']);
        $this->assertSame(80.90, $p['items'][0]['originalTotalPrice']);

        $this->postJson('/api/nfce/import', self::importPayload($p))->assertCreated();
        $purchase = Purchase::with('items')->sole();
        $this->assertEquals(92.91, (float) $purchase->total);
        $this->assertEquals(4.99, (float) $purchase->discount);
        $this->assertEquals(92.91, (float) $purchase->items[0]->total_price);
        $this->assertEquals(80.90, (float) $purchase->items[0]->original_total_price);
    }

    public function test_multiple_payments_are_recorded_as_text(): void
    {
        $p = $this->readReady('sendas-22-itens-2-pagamentos', self::KEY_SENDAS_22);
        $this->postJson('/api/nfce/import', self::importPayload($p))->assertCreated();

        $this->assertSame('Cartão de Crédito 100,00; Vale Alimentação 235,28', Purchase::sole()->payment_method);
    }

    // ---- Duplicidade (plano, seção 4.7) ------------------------------------------------

    public function test_duplicate_is_detected_on_read_before_calling_sefaz_by_link_or_qr(): void
    {
        $p = $this->readReady('sendas-9-itens', self::KEY_SENDAS_9);
        $this->postJson('/api/nfce/import', self::importPayload($p))->assertCreated();

        Http::fake(); // zera o registro de requisições
        foreach ([self::appLink(self::KEY_SENDAS_9), self::qr(self::KEY_SENDAS_9), self::KEY_SENDAS_9] as $input) {
            $this->postJson('/api/nfce/read', ['input' => $input])
                ->assertOk()
                ->assertJsonPath('status', 'duplicate')
                ->assertJsonPath('alreadyImported.id', Purchase::sole()->id)
                ->assertJsonPath('alreadyImported.itemsCount', 9);
        }
        Http::assertNothingSent();
    }

    public function test_importing_the_same_note_twice_returns_409(): void
    {
        $p = $this->readReady('sendas-9-itens', self::KEY_SENDAS_9);
        $payload = self::importPayload($p);
        $this->postJson('/api/nfce/import', $payload)->assertCreated();

        // Mesmo que a nota volte para o cache (ex.: lida em outro aparelho antes da gravação)...
        $this->readReadyIgnoringDuplicate();
        $this->postJson('/api/nfce/import', $payload)
            ->assertStatus(409)
            ->assertJsonPath('code', 'already_imported')
            ->assertJsonPath('alreadyImported.id', Purchase::sole()->id);

        $this->assertSame(1, Purchase::count());
    }

    /** Simula outra pessoa da casa que leu a nota antes de ela ser gravada: põe a nota no cache direto. */
    private function readReadyIgnoringDuplicate(): void
    {
        $note = \App\Services\Nfce\DanfeParser::parse(self::fixture('sendas-9-itens'));
        app(\App\Services\Nfce\NfceImporter::class)->preview($note, 'https://nfce.sefaz.rn.gov.br/x');
    }

    public function test_database_rejects_same_key_twice_in_same_house(): void
    {
        $attrs = ['date' => '2026-11-11', 'store' => 'X', 'total' => 1, 'per_member' => 1, 'source' => 'nfce', 'nfce_access_key' => self::KEY_SENDAS_9];
        Purchase::create($attrs);

        $this->expectException(UniqueConstraintViolationException::class);
        Purchase::create($attrs);
    }

    public function test_deleting_the_purchase_allows_reimport(): void
    {
        $p = $this->readReady('sendas-9-itens', self::KEY_SENDAS_9);
        $this->postJson('/api/nfce/import', self::importPayload($p))->assertCreated();
        $this->deleteJson('/api/purchases/'.Purchase::sole()->id)->assertNoContent();

        $p = $this->readReady('sendas-9-itens', self::KEY_SENDAS_9);
        $this->postJson('/api/nfce/import', self::importPayload($p))->assertCreated();
        $this->assertSame(1, Purchase::count());
    }

    public function test_another_house_can_import_the_same_note(): void
    {
        $p = $this->readReady('sendas-9-itens', self::KEY_SENDAS_9);
        $this->postJson('/api/nfce/import', self::importPayload($p))->assertCreated();

        $this->actingAs(User::factory()->create());
        $p = $this->readReady('sendas-9-itens', self::KEY_SENDAS_9);
        $this->assertNull($p['alreadyImported']);
        $this->assertFalse($p['store']['remembered']); // memória de lojas também é por casa
        $this->postJson('/api/nfce/import', self::importPayload($p))->assertCreated();

        $this->assertSame(1, Purchase::count()); // cada casa só vê a sua
        $this->assertSame(2, Purchase::withoutGlobalScopes()->count());
    }

    public function test_warns_about_possible_manual_duplicate(): void
    {
        $this->postJson('/api/purchases', [
            'date'  => '2026-11-11T00:00:00.000Z',
            'store' => 'Sendas',
            'items' => [['name' => 'Compras', 'category' => 'Alimentos', 'quantity' => 1, 'unit' => 'un', 'unitPrice' => 158.91]],
        ])->assertCreated();

        $p = $this->readReady('sendas-9-itens', self::KEY_SENDAS_9);
        $this->assertSame('Sendas', $p['possibleManualDuplicate']['store']);

        // É só um alerta: importar continua permitido.
        $this->postJson('/api/nfce/import', self::importPayload($p))->assertCreated();
    }

    // ---- Erros ------------------------------------------------------------------------

    public function test_rejects_links_outside_allowed_hosts_without_any_request(): void
    {
        Http::fake();
        $this->postJson('/api/nfce/read', ['input' => 'https://evil.example.com/?chNFCe='.self::KEY_SENDAS_9])
            ->assertStatus(422)->assertJsonPath('code', 'invalid_link');
        Http::assertNothingSent();
    }

    public function test_sefaz_unavailable(): void
    {
        Http::fake(['*' => Http::failedConnection()]);
        $this->postJson('/api/nfce/read', ['input' => self::appLink(self::KEY_SENDAS_9)])
            ->assertStatus(502)->assertJsonPath('code', 'sefaz_unavailable');
    }

    public function test_cancelled_note_is_blocked(): void
    {
        Http::fake(['*' => Http::response(str_replace('Situação: Autorizada', 'Situação: Cancelada', self::fixture('sendas-9-itens')))]);
        $this->postJson('/api/nfce/read', ['input' => self::appLink(self::KEY_SENDAS_9)])
            ->assertStatus(422)->assertJsonPath('code', 'not_authorized');
    }

    public function test_import_without_recent_read_asks_to_read_again(): void
    {
        $this->postJson('/api/nfce/import', [
            'accessKey' => self::KEY_SENDAS_9, 'store' => 'X', 'date' => '2026-11-11',
            'items' => [['index' => 0, 'include' => true, 'name' => 'A', 'category' => 'Outros', 'unit' => 'un']],
        ])->assertStatus(410)->assertJsonPath('code', 'read_expired');
    }

    // ---- QR Code + código de segurança --------------------------------------------------

    public function test_qr_flow_with_security_code(): void
    {
        Http::fake([
            'nfce.sefaz.rn.gov.br/portalDFE/NFCe/mDadosNFCe.aspx*'   => Http::response(self::fixture('pagina-codigo-seguranca'), 200, ['Set-Cookie' => 'ASP.NET_SessionId=abc; path=/']),
            'nfce.sefaz.rn.gov.br/portalDFE/JpegImage.aspx*'         => Http::response('JPEGDATA', 200, ['Content-Type' => 'image/jpeg']),
            'nfce.sefaz.rn.gov.br/portalDFE/NFCe/mDadosNFCeV2.aspx*' => Http::response(self::fixture('sendas-22-itens-2-pagamentos')),
        ]);

        $start = $this->postJson('/api/nfce/read', ['input' => self::qr(self::KEY_SENDAS_22)])
            ->assertOk()
            ->assertJsonPath('status', 'captcha')
            ->assertJsonPath('note.number', 176830)
            ->assertJsonPath('captcha', 'data:image/jpeg;base64,'.base64_encode('JPEGDATA'))
            ->assertJsonMissingPath('state')
            ->json();

        $this->postJson('/api/nfce/captcha/refresh', ['sessionId' => $start['sessionId']])
            ->assertOk()->assertJsonStructure(['captcha']);

        $ready = $this->postJson('/api/nfce/captcha/submit', ['sessionId' => $start['sessionId'], 'code' => 'AB12CD'])
            ->assertOk()->assertJsonPath('status', 'ready')->json('preview');
        $this->assertCount(22, $ready['items']);
        $this->assertStringStartsWith('https://nfce.sefaz.rn.gov.br/consultarNFCe.aspx?p='.self::KEY_SENDAS_22, $ready['url']);

        // O formulário foi enviado à SEFAZ como o navegador faria, com o código digitado e o cookie da sessão.
        Http::assertSent(fn (Request $r) => $r->method() === 'POST'
            && str_starts_with($r->url(), 'https://nfce.sefaz.rn.gov.br/portalDFE/NFCe/mDadosNFCeV2.aspx?chNFCe='.self::KEY_SENDAS_22)
            && $r['txt_cod_antirobo'] === 'AB12CD'
            && $r['__VIEWSTATEGENERATOR'] === 'CAFDC37D'
            && str_contains($r->header('Cookie')[0] ?? '', 'ASP.NET_SessionId=abc'));

        $this->postJson('/api/nfce/import', self::importPayload($ready))->assertCreated();
        $this->assertSame('nfce', Purchase::sole()->source);
    }

    public function test_qr_wrong_code_returns_new_image(): void
    {
        Http::fake([
            'nfce.sefaz.rn.gov.br/portalDFE/NFCe/mDadosNFCe.aspx*'   => Http::response(self::fixture('pagina-codigo-seguranca')),
            'nfce.sefaz.rn.gov.br/portalDFE/JpegImage.aspx*'         => Http::response('JPEG', 200, ['Content-Type' => 'image/jpeg']),
            'nfce.sefaz.rn.gov.br/portalDFE/NFCe/mDadosNFCeV2.aspx*' => Http::response(self::fixture('pagina-erro-sefaz')),
        ]);

        $sessionId = $this->postJson('/api/nfce/read', ['input' => self::qr(self::KEY_SENDAS_22)])->json('sessionId');

        $this->postJson('/api/nfce/captcha/submit', ['sessionId' => $sessionId, 'code' => 'ERRADO'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'wrong_code')
            ->assertJsonStructure(['captcha'])
            ->assertJsonMissingPath('state');

        // A sessão continua válida para uma nova tentativa.
        $this->postJson('/api/nfce/captcha/refresh', ['sessionId' => $sessionId])->assertOk();
    }

    public function test_captcha_image_is_retried_when_sefaz_fails(): void
    {
        Http::fake([
            'nfce.sefaz.rn.gov.br/portalDFE/NFCe/mDadosNFCe.aspx*' => Http::response(self::fixture('pagina-codigo-seguranca')),
            'nfce.sefaz.rn.gov.br/portalDFE/JpegImage.aspx*'       => Http::sequence()
                ->push(self::fixture('pagina-erro-sefaz'), 200, ['Content-Type' => 'text/html; charset=utf-8'])
                ->push(self::fixture('pagina-erro-sefaz'), 200, ['Content-Type' => 'text/html; charset=utf-8'])
                ->push('JPEG', 200, ['Content-Type' => 'image/jpeg; charset=utf-8']),
        ]);

        $this->postJson('/api/nfce/read', ['input' => self::qr(self::KEY_SENDAS_22)])
            ->assertOk()
            ->assertJsonPath('status', 'captcha')
            ->assertJsonPath('captcha', 'data:image/jpeg;base64,'.base64_encode('JPEG'));
    }

    public function test_captcha_image_gives_up_after_repeated_failures(): void
    {
        Http::fake([
            'nfce.sefaz.rn.gov.br/portalDFE/NFCe/mDadosNFCe.aspx*' => Http::response(self::fixture('pagina-codigo-seguranca')),
            'nfce.sefaz.rn.gov.br/portalDFE/JpegImage.aspx*'       => Http::response(self::fixture('pagina-erro-sefaz'), 200, ['Content-Type' => 'text/html']),
        ]);

        $this->postJson('/api/nfce/read', ['input' => self::qr(self::KEY_SENDAS_22)])
            ->assertStatus(502)->assertJsonPath('code', 'sefaz_unavailable');
    }

    public function test_captcha_session_is_per_house(): void
    {
        Http::fake([
            'nfce.sefaz.rn.gov.br/portalDFE/NFCe/mDadosNFCe.aspx*' => Http::response(self::fixture('pagina-codigo-seguranca')),
            'nfce.sefaz.rn.gov.br/portalDFE/JpegImage.aspx*'       => Http::response('JPEG', 200, ['Content-Type' => 'image/jpeg']),
        ]);
        $sessionId = $this->postJson('/api/nfce/read', ['input' => self::qr(self::KEY_SENDAS_22)])->json('sessionId');

        $this->actingAs(User::factory()->create());
        $this->postJson('/api/nfce/captcha/submit', ['sessionId' => $sessionId, 'code' => 'AB12CD'])
            ->assertStatus(410)->assertJsonPath('code', 'session_expired');
    }

    public function test_state_exposes_nfce_fields(): void
    {
        $p = $this->readReady('sushi-desconto', self::KEY_SUSHI);
        $this->postJson('/api/nfce/import', self::importPayload($p))->assertCreated();

        $this->getJson('/api/state')
            ->assertJsonPath('purchases.0.source', 'nfce')
            ->assertJsonPath('purchases.0.nfceAccessKey', self::KEY_SUSHI)
            ->assertJsonPath('purchases.0.discount', 4.99)
            ->assertJsonPath('purchases.0.items.0.originalName', 'SUSHI MIX+ 2 ROLINHO + 2 COCA');
    }
}
