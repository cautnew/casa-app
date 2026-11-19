<?php

namespace App\Services\Nfce;

/**
 * Chave de acesso de 44 dígitos de uma NF-e/NFC-e:
 * cUF(2) AAMM(4) CNPJ(14) modelo(2) série(3) número(9) tpEmis(1) código(8) DV(1).
 */
final class AccessKey
{
    public const UF_RN = '24';
    public const MODEL_NFCE = '65';

    private function __construct(public readonly string $value) {}

    public static function tryFrom(?string $value): ?self
    {
        $digits = preg_replace('/\D/', '', (string) $value);

        return self::isValid($digits) ? new self($digits) : null;
    }

    public static function isValid(string $digits): bool
    {
        return (bool) preg_match('/^\d{44}$/', $digits)
            && self::checkDigit(substr($digits, 0, 43)) === (int) $digits[43];
    }

    /** Dígito verificador módulo 11 (pesos 2..9 da direita para a esquerda). */
    public static function checkDigit(string $first43): int
    {
        $sum = 0;
        $weight = 2;
        for ($i = strlen($first43) - 1; $i >= 0; $i--) {
            $sum += (int) $first43[$i] * $weight;
            $weight = $weight === 9 ? 2 : $weight + 1;
        }
        $dv = 11 - ($sum % 11);

        return $dv >= 10 ? 0 : $dv;
    }

    public function uf(): string     { return substr($this->value, 0, 2); }
    public function cnpj(): string   { return substr($this->value, 6, 14); }
    public function model(): string  { return substr($this->value, 20, 2); }
    public function series(): int    { return (int) substr($this->value, 22, 3); }
    public function number(): int    { return (int) substr($this->value, 25, 9); }

    public function isRnNfce(): bool
    {
        return $this->uf() === self::UF_RN && $this->model() === self::MODEL_NFCE;
    }
}
