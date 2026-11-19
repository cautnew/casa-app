<?php

namespace App\Services\Nfce;

/**
 * Distribui o valor efetivamente pago entre os itens, proporcionalmente ao valor de cada um.
 * Trabalha em centavos para garantir que a soma dos itens seja exatamente o valor pago.
 */
final class DiscountAllocator
{
    /**
     * @param  float[]  $totals  valores dos itens como impressos na nota
     * @return float[]  valores rateados, mesma ordem/chaves
     */
    public static function allocate(array $totals, float $paid): array
    {
        $cents    = array_map(fn ($v) => (int) round($v * 100), $totals);
        $sum      = array_sum($cents);
        $target   = (int) round($paid * 100);

        if ($sum <= 0 || $target === $sum) {
            return array_map(fn ($c) => $c / 100, $cents);
        }

        $allocated = [];
        foreach ($cents as $k => $c) {
            $allocated[$k] = (int) round($c * $target / $sum);
        }

        // Centavos que sobram/faltam do arredondamento vão para o item de maior valor.
        $diff = $target - array_sum($allocated);
        if ($diff !== 0) {
            $largest = array_keys($cents, max($cents))[0];
            $allocated[$largest] += $diff;
        }

        return array_map(fn ($c) => $c / 100, $allocated);
    }
}
