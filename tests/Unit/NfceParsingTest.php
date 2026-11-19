<?php

namespace Tests\Unit;

use App\Services\Nfce\AccessKey;
use App\Services\Nfce\BrFormat;
use App\Services\Nfce\DanfeParser;
use App\Services\Nfce\DiscountAllocator;
use App\Services\Nfce\NfceException;
use App\Services\Nfce\NfceLink;
use App\Services\Nfce\UnitNormalizer;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class NfceParsingTest extends TestCase
{
    private static function fixture(string $name): string
    {
        return file_get_contents(__DIR__.'/../Fixtures/nfce/'.$name.'.html');
    }

    public static function realKeys(): array
    {
        return [
            ['24261106057223049502650050002499661053044530'],
            ['24261155440120000100650020000343801066740769'],
            ['24261104227467008538650150000032681000032695'],
            ['24261127286419000108650050000171221541762060'],
            ['24261106057223049502650020001768301020613606'],
        ];
    }

    #[DataProvider('realKeys')]
    public function test_real_access_keys_have_valid_check_digit(string $key): void
    {
        $k = AccessKey::tryFrom($key);
        $this->assertNotNull($k);
        $this->assertTrue($k->isRnNfce());
    }

    public function test_access_key_rejects_wrong_check_digit_and_parts(): void
    {
        $this->assertNull(AccessKey::tryFrom('24261106057223049502650050002499661053044531'));
        $this->assertNull(AccessKey::tryFrom('123'));

        $k = AccessKey::tryFrom('2426 1106 0572 2304 9502 6500 5000 2499 6610 5304 4530');
        $this->assertSame('06057223049502', $k->cnpj());
        $this->assertSame(249966, $k->number());
        $this->assertSame(5, $k->series());
    }

    public function test_parses_app_link_with_token(): void
    {
        $link = NfceLink::parse('https://nfce.sefaz.rn.gov.br/portalDFE/nota-potiguar/nfce-mobile-danfe.aspx?chNFCe=24261106057223049502650050002499661053044530&token=F1235B0FDA96CECD3135FAACBE9677F9&Sender=64636A676E');
        $this->assertSame('24261106057223049502650050002499661053044530', $link->key->value);
        $this->assertTrue($link->isDirect());
    }

    public function test_parses_printed_qr_code(): void
    {
        $link = NfceLink::parse('http://nfce.set.rn.gov.br/consultarNFCe.aspx?p=24261106057223049502650020001768301020613606|3|1');
        $this->assertSame('24261106057223049502650020001768301020613606', $link->key->value);
        $this->assertFalse($link->isDirect());
    }

    public function test_parses_bare_access_key(): void
    {
        $link = NfceLink::parse(' 2426 1106 0572 2304 9502 6500 2000 1768 3010 2061 3606 ');
        $this->assertFalse($link->isDirect());
    }

    public static function invalidLinks(): array
    {
        return [
            'outro site'        => ['https://evil.example.com/consultarNFCe.aspx?p=24261106057223049502650020001768301020613606|3|1', NfceException::INVALID_LINK],
            'sem chave'         => ['https://nfce.sefaz.rn.gov.br/portalDFE/qualquer.aspx', NfceException::INVALID_LINK],
            'dígito errado'     => ['http://nfce.set.rn.gov.br/consultarNFCe.aspx?p=24261106057223049502650020001768301020613607|3|1', NfceException::INVALID_LINK],
            'outro estado'      => ['https://www.fazenda.sp.gov.br/nfce/qrcode?p=35261106057223049502650020001768301020613606|2|1', NfceException::UNSUPPORTED_STATE],
            'texto qualquer'    => ['olá mundo', NfceException::INVALID_LINK],
            'esquema estranho'  => ['file:///etc/passwd', NfceException::INVALID_LINK],
            'userinfo no host'  => ['https://nfce.sefaz.rn.gov.br@evil.example.com/?p=24261106057223049502650020001768301020613606|3|1', NfceException::INVALID_LINK],
        ];
    }

    #[DataProvider('invalidLinks')]
    public function test_rejects_invalid_links(string $input, string $code): void
    {
        try {
            NfceLink::parse($input);
            $this->fail('Deveria rejeitar');
        } catch (NfceException $e) {
            $this->assertSame($code, $e->errorCode);
        }
    }

    public function test_br_format(): void
    {
        $this->assertSame(1234.56, BrFormat::number('1.234,56'));
        $this->assertSame(0.695, BrFormat::number('0,695'));
        $this->assertSame(2.0, BrFormat::number('2,0'));
        $this->assertSame(0.0, BrFormat::number(''));
        $this->assertSame('2026-11-11 19:05:26', BrFormat::dateTime('Data de Emissão: 11/11/2026 19:05:26 '));
        $this->assertNull(BrFormat::dateTime('sem data'));
    }

    public function test_unit_normalizer(): void
    {
        $this->assertSame('kg', UnitNormalizer::normalize('Kg'));
        foreach (['Un', 'UN', 'UND', 'Uni'] as $u) {
            $this->assertSame('un', UnitNormalizer::normalize($u), $u);
        }
        foreach (['PC', 'PCT', 'pt', 'Pac'] as $u) {
            $this->assertSame('pacote', UnitNormalizer::normalize($u), $u);
        }
        $this->assertSame('caixa', UnitNormalizer::normalize('CX'));
        $this->assertSame('un', UnitNormalizer::normalize('XYZ'));
    }

    public function test_allocator_keeps_values_without_discount(): void
    {
        $this->assertSame([26.75, 6.98], DiscountAllocator::allocate([26.75, 6.98], 33.73));
    }

    public function test_allocator_distributes_discount_proportionally_and_sums_exactly(): void
    {
        $out = DiscountAllocator::allocate([80.90, 17.00], 92.91);
        $this->assertEqualsWithDelta(92.91, array_sum($out), 0.0001);
        $this->assertEqualsWithDelta(76.78, $out[0], 0.011);
        $this->assertEqualsWithDelta(16.13, $out[1], 0.011);
    }

    public function test_allocator_rounding_with_many_items(): void
    {
        $totals = array_fill(0, 33, 3.33);
        $out = DiscountAllocator::allocate($totals, 100.00);
        $this->assertEqualsWithDelta(100.00, array_sum($out), 0.0001);
        foreach ($out as $v) {
            $this->assertEqualsWithDelta(round($v, 2), $v, 0.000001);
        }
    }

    public function test_parses_danfe_with_9_items(): void
    {
        $n = DanfeParser::parse(self::fixture('sendas-9-itens'));

        $this->assertSame('24261106057223049502650050002499661053044530', $n['accessKey']);
        $this->assertSame(249966, $n['number']);
        $this->assertSame(5, $n['series']);
        $this->assertSame('2026-11-11 19:05:26', $n['issuedAt']);
        $this->assertTrue($n['authorized']);
        $this->assertSame('Loja 268 - Natal Maria Lacerda', $n['store']['tradeName']);
        $this->assertSame('SENDAS DISTRIBUIDORA S/A', $n['store']['legalName']);
        $this->assertSame('06057223049502', $n['store']['cnpj']);
        $this->assertCount(9, $n['items']);
        $this->assertSame(['index' => 0, 'code' => '001', 'description' => 'KIWI kg', 'quantity' => 0.695, 'unitRaw' => 'Kg', 'unit' => 'kg', 'unitPrice' => 38.49, 'totalPrice' => 26.75], $n['items'][0]);
        $this->assertSame('pacote', $n['items'][6]['unit']); // LTE PO NOLAC 300G · PC
        $this->assertSame(158.91, $n['subtotal']);
        $this->assertSame(158.91, $n['paid']);
        $this->assertSame([['method' => 'Vale Alimentação', 'amount' => null]], $n['payments']);
    }

    public function test_parses_discount_note(): void
    {
        $n = DanfeParser::parse(self::fixture('sushi-desconto'));
        $this->assertSame(97.90, $n['subtotal']);
        $this->assertSame(4.99, $n['discount']);
        $this->assertSame(92.91, $n['paid']);
        // A nota lista só 1 item (80,90); os 17,00 restantes do total são cobranças sem item (ex.: entrega).
        $this->assertCount(1, $n['items']);
        $this->assertSame(80.90, $n['items'][0]['totalPrice']);
    }

    public function test_parses_note_without_trade_name(): void
    {
        $n = DanfeParser::parse(self::fixture('essencia-sem-fantasia'));
        $this->assertSame('', $n['store']['tradeName']);
        $this->assertSame('ESSENCIA COMERCIAL LTDA', $n['store']['legalName']);
        $this->assertCount(3, $n['items']);
    }

    public function test_parses_22_items_and_multiple_payments(): void
    {
        $n = DanfeParser::parse(self::fixture('sendas-22-itens-2-pagamentos'));
        $this->assertCount(22, $n['items']);
        $this->assertSame([
            ['method' => 'Cartão de Crédito', 'amount' => 100.0],
            ['method' => 'Vale Alimentação', 'amount' => 235.28],
        ], $n['payments']);
        $this->assertEqualsWithDelta(335.28, array_sum(array_column($n['items'], 'totalPrice')), 0.001);
    }

    public function test_rejects_pages_that_are_not_danfe(): void
    {
        $this->expectException(NfceException::class);
        DanfeParser::parse(self::fixture('pagina-codigo-seguranca'));
    }
}
