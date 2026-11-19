<?php

namespace App\Services\Nfce;

/** Converte as unidades que aparecem nas notas para as unidades do app (resources/js/constants.js). */
final class UnitNormalizer
{
    private const MAP = [
        'KG' => 'kg', 'KGS' => 'kg', 'QUILO' => 'kg',
        'G' => 'g', 'GR' => 'g', 'GRS' => 'g',
        'L' => 'L', 'LT' => 'L', 'LTS' => 'L', 'LITRO' => 'L',
        'ML' => 'ml',
        'UN' => 'un', 'UND' => 'un', 'UNI' => 'un', 'UNID' => 'un', 'UNIDADE' => 'un', 'U' => 'un', 'PEÇA' => 'un', 'PECA' => 'un',
        // "PC" nas notas significa pacote (ex.: "LTE PO NOLAC 300G · PC").
        'PC' => 'pacote', 'PCT' => 'pacote', 'PT' => 'pacote', 'PAC' => 'pacote', 'PACOTE' => 'pacote', 'FD' => 'pacote', 'FARDO' => 'pacote',
        'CX' => 'caixa', 'CXA' => 'caixa', 'CAIXA' => 'caixa',
    ];

    public static function normalize(?string $unit): string
    {
        $key = mb_strtoupper(trim((string) $unit));

        return self::MAP[$key] ?? 'un';
    }
}
