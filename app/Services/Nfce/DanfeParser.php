<?php

namespace App\Services\Nfce;

use Dom\HTMLDocument;

/**
 * Lê a página de DANFE da SEFAZ-RN (portal Nota Potiguar) usando os ids fixos dos elementos.
 * Retorna um array simples (fácil de guardar em cache).
 */
final class DanfeParser
{
    public static function looksLikeDanfe(string $html): bool
    {
        return str_contains($html, 'tbItensList') && str_contains($html, 'lblChave');
    }

    public static function parse(string $html): array
    {
        if (! self::looksLikeDanfe($html)) {
            throw new NfceException(NfceException::NOT_FOUND, 'Não encontramos os dados da nota nesta página. Confira o link.');
        }

        $doc = HTMLDocument::createFromString($html, LIBXML_NOERROR);
        $text = function (string $id) use ($doc): string {
            $el = $doc->getElementById($id);

            return $el ? self::clean($el->textContent) : '';
        };
        $afterColon = fn (string $s) => trim(str_contains($s, ':') ? substr($s, strpos($s, ':') + 1) : $s);

        $items = [];
        foreach ($doc->querySelectorAll('[id^="tbItensList_lblTbItensDescricao_"]') as $descEl) {
            $i       = substr($descEl->getAttribute('id'), strlen('tbItensList_lblTbItensDescricao_'));
            $unitRaw = $text("tbItensList_lblTbItensUnidade_{$i}");
            $items[] = [
                'index'       => count($items),
                'code'        => $text("tbItensList_lblTbItensCodigo_{$i}"),
                'description' => self::clean($descEl->textContent),
                'quantity'    => BrFormat::number($text("tbItensList_lblTbItensQtde_{$i}")),
                'unitRaw'     => $unitRaw,
                'unit'        => UnitNormalizer::normalize($unitRaw),
                'unitPrice'   => BrFormat::number($text("tbItensList_lblTbItensValorUnid_{$i}")),
                'totalPrice'  => BrFormat::number($text("tbItensList_lblTbItensValorTotal_{$i}")),
            ];
        }

        $key = AccessKey::tryFrom($text('lblChave'));
        if (! $key || ! $items) {
            throw new NfceException(NfceException::NOT_FOUND, 'Não conseguimos ler os itens desta nota.');
        }

        preg_match('/N[ÚU]MERO:\s*(\d+)\s*S[ÉE]RIE:\s*(\d+)/iu', $text('lblNumeroSerie'), $ns);
        $status = $afterColon($text('lblSituacao'));
        $subtotal = BrFormat::number($text('lblValorTotal'));
        $itemsSum = round(array_sum(array_column($items, 'totalPrice')), 2);

        return [
            'accessKey'  => $key->value,
            'number'     => isset($ns[1]) ? (int) $ns[1] : $key->number(),
            'series'     => isset($ns[2]) ? (int) $ns[2] : $key->series(),
            'issuedAt'   => BrFormat::dateTime($text('lblDataEmissao')),
            'status'     => $status,
            'authorized' => (bool) preg_match('/^autorizad/i', $status),
            'store'      => [
                'legalName' => $afterColon($text('lblRazaoSocialEmitente')),
                'tradeName' => $afterColon($text('lblNomeFantasia')),
                'cnpj'      => preg_replace('/\D/', '', $text('lblCPFCNPJEmitente')) ?: $key->cnpj(),
                'address'   => $afterColon($text('lblEnderecoEmitente')),
            ],
            'items'      => $items,
            'subtotal'   => $subtotal ?: $itemsSum,
            'discount'   => BrFormat::number($text('lblValorDesconto')),
            'paid'       => BrFormat::number($text('lblValorPago')) ?: ($subtotal ?: $itemsSum),
            'payments'   => self::payments($doc),
        ];
    }

    /** "Cartão de Crédito 100,00" / "Vale Alimentação" → [['method' => ..., 'amount' => ?float]] */
    private static function payments(HTMLDocument $doc): array
    {
        $el = $doc->getElementById('lblFormaPagamento');
        if (! $el) {
            return [];
        }
        $divs  = $el->querySelectorAll('div');
        $lines = $divs->length
            ? array_map(fn ($d) => self::clean($d->textContent), iterator_to_array($divs))
            : [self::clean($el->textContent)];

        $out = [];
        foreach (array_filter($lines) as $line) {
            if (preg_match('/^(.*?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/u', $line, $m)) {
                $out[] = ['method' => $m[1], 'amount' => BrFormat::number($m[2])];
            } else {
                $out[] = ['method' => $line, 'amount' => null];
            }
        }

        return $out;
    }

    private static function clean(string $s): string
    {
        return trim(preg_replace('/\s+/u', ' ', str_replace("\u{a0}", ' ', $s)));
    }
}
