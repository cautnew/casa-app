<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\Member;
use App\Models\Purchase;
use App\Models\ShoppingListItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fixa o comportamento dos fluxos existentes (compra manual e finalização da lista),
 * para garantir que a extração do PurchaseRecorder não muda nada.
 */
class PurchaseFlowsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->actingAs($this->user);
    }

    public function test_manual_purchase_creates_items_inventory_and_payments(): void
    {
        $a = Member::create(['name' => 'Ana', 'color' => 'bg-rose-400']);
        Member::create(['name' => 'Bia', 'color' => 'bg-sky-400']);

        $this->postJson('/api/purchases', [
            'date'  => '2026-11-10T00:00:00.000Z',
            'store' => 'Mercado X',
            'items' => [
                ['name' => 'Arroz', 'category' => 'Alimentos', 'quantity' => 2, 'unit' => 'kg', 'unitPrice' => 5.5],
                ['name' => 'Sabão', 'category' => 'Limpeza', 'quantity' => 1, 'unit' => 'un', 'unitPrice' => 3],
            ],
            'memberPayments' => [['memberId' => $a->id, 'amount' => 14]],
        ])->assertCreated();

        $p = Purchase::with('items', 'memberPayments')->sole();
        $this->assertSame('manual', $p->source);
        $this->assertEquals(14.0, (float) $p->total);
        $this->assertEquals(7.0, (float) $p->per_member);
        $this->assertCount(2, $p->items);
        $this->assertEquals(11.0, (float) $p->items->firstWhere('name', 'Arroz')->total_price);
        $this->assertCount(1, $p->memberPayments);

        $arroz = InventoryItem::where('name', 'Arroz')->sole();
        $this->assertEquals(2.0, $arroz->quantity);
        $this->assertEquals(5.5, $arroz->last_price);
        $this->assertCount(1, $arroz->priceHistory);
    }

    public function test_manual_purchase_adds_to_existing_inventory_and_averages_price(): void
    {
        $inv = InventoryItem::create([
            'name' => 'Arroz', 'category' => 'Alimentos', 'quantity' => 1, 'unit' => 'kg',
            'min_stock' => 1, 'in_next_list' => false, 'last_price' => 4, 'avg_price' => 4,
        ]);
        $inv->priceHistory()->create(['date' => '2026-10-01', 'price' => 4, 'store' => 'Y']);

        $this->postJson('/api/purchases', [
            'date'  => '2026-11-10T00:00:00.000Z',
            'store' => 'Mercado X',
            'items' => [['name' => ' arroz ', 'category' => 'Alimentos', 'quantity' => 2, 'unit' => 'kg', 'unitPrice' => 6]],
        ])->assertCreated();

        $inv->refresh();
        $this->assertEquals(3.0, $inv->quantity);
        $this->assertEquals(6.0, $inv->last_price);
        $this->assertEquals(5.0, $inv->avg_price);
        $this->assertSame(1, InventoryItem::count());
    }

    public function test_finalize_shopping_list(): void
    {
        $inv = InventoryItem::create([
            'name' => 'Leite', 'category' => 'Alimentos', 'quantity' => 0, 'unit' => 'L',
            'min_stock' => 2, 'in_next_list' => true, 'last_price' => 5, 'avg_price' => 5,
        ]);
        $leite = ShoppingListItem::create([
            'name' => 'Leite', 'category' => 'Alimentos', 'desired_qty' => 3, 'unit' => 'L',
            'bought' => true, 'source_inventory_id' => $inv->id,
        ]);
        $ovos = ShoppingListItem::create([
            'name' => 'Ovos', 'category' => 'Alimentos', 'desired_qty' => 12, 'unit' => 'un', 'bought' => false,
        ]);

        $this->postJson('/api/shopping/finalize', [
            'store' => 'Mercado X',
            'date'  => '2026-11-10T00:00:00.000Z',
            'items' => [[
                'id' => $leite->id, 'name' => 'Leite', 'category' => 'Alimentos', 'quantity' => 3,
                'unit' => 'L', 'unitPrice' => 4.99, 'sourceInventoryId' => $inv->id,
            ]],
        ])->assertCreated();

        $p = Purchase::with('items')->sole();
        $this->assertSame('list', $p->source);
        $this->assertSame('Gerada a partir da lista de compras', $p->note);
        $this->assertEquals(14.97, (float) $p->total);

        $this->assertDatabaseMissing('shopping_list_items', ['id' => $leite->id]);
        $this->assertDatabaseHas('shopping_list_items', ['id' => $ovos->id]);

        $inv->refresh();
        $this->assertFalse($inv->in_next_list);
        $this->assertEquals(3.0, $inv->quantity);
    }

    public function test_purchases_are_isolated_between_houses(): void
    {
        $this->postJson('/api/purchases', [
            'date'  => '2026-11-10T00:00:00.000Z',
            'store' => 'Mercado X',
            'items' => [['name' => 'Arroz', 'category' => 'Alimentos', 'quantity' => 1, 'unit' => 'kg', 'unitPrice' => 5]],
        ])->assertCreated();

        $this->actingAs(User::factory()->create());
        $this->assertSame(0, Purchase::count());
        $this->getJson('/api/state')->assertJsonCount(0, 'purchases');
    }
}
