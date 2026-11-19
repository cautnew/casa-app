<?php

namespace App\Services\Nfce;

use RuntimeException;

/**
 * Erro "esperado" na leitura/importação de uma NFC-e, com um código estável que o front usa
 * para escolher a mensagem e a ação (tentar de novo, colar link, etc.).
 */
class NfceException extends RuntimeException
{
    public const INVALID_LINK      = 'invalid_link';
    public const UNSUPPORTED_STATE = 'unsupported_state';
    public const SEFAZ_UNAVAILABLE = 'sefaz_unavailable';
    public const NOT_FOUND         = 'not_found';
    public const NOT_AUTHORIZED    = 'not_authorized';
    public const WRONG_CODE        = 'wrong_code';
    public const SESSION_EXPIRED   = 'session_expired';
    public const READ_EXPIRED      = 'read_expired';
    public const ALREADY_IMPORTED  = 'already_imported';

    private const STATUS = [
        self::INVALID_LINK      => 422,
        self::UNSUPPORTED_STATE => 422,
        self::SEFAZ_UNAVAILABLE => 502,
        self::NOT_FOUND         => 404,
        self::NOT_AUTHORIZED    => 422,
        self::WRONG_CODE        => 422,
        self::SESSION_EXPIRED   => 410,
        self::READ_EXPIRED      => 410,
        self::ALREADY_IMPORTED  => 409,
    ];

    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly array $extra = [],
    ) {
        parent::__construct($message);
    }

    public function status(): int
    {
        return self::STATUS[$this->errorCode] ?? 422;
    }

    public function toArray(): array
    {
        return ['code' => $this->errorCode, 'message' => $this->getMessage(), ...$this->extra];
    }
}
