<?php

namespace App\Services\Nfce;

final class BrFormat
{
    /** "1.234,56" → 1234.56 ; "0,695" → 0.695 */
    public static function number(?string $value): float
    {
        $v = trim((string) $value);
        if ($v === '') {
            return 0.0;
        }
        $v = str_replace(['R$', ' ', "\u{a0}"], '', $v);
        if (str_contains($v, ',')) {
            $v = str_replace('.', '', $v);
            $v = str_replace(',', '.', $v);
        }

        return is_numeric($v) ? (float) $v : 0.0;
    }

    /** "11/11/2026 19:05:26" → "2026-11-11 19:05:26" (ou null) */
    public static function dateTime(?string $value): ?string
    {
        if (! preg_match('#(\d{2})/(\d{2})/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?#', (string) $value, $m)) {
            return null;
        }
        $time = $m[4] ?? '00:00:00';
        if (strlen($time) === 5) {
            $time .= ':00';
        }

        return "{$m[3]}-{$m[2]}-{$m[1]} {$time}";
    }
}
