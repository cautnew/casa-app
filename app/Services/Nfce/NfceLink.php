<?php

namespace App\Services\Nfce;

/**
 * Interpreta o que o usuário informou (link do app/e-mail Nota Potiguar, conteúdo do QR Code
 * ou a própria chave de 44 dígitos) e extrai só os dados necessários.
 *
 * A URL recebida NUNCA é usada para fazer requisições: o cliente da SEFAZ monta as URLs
 * a partir da chave/token extraídos (proteção contra SSRF).
 */
final class NfceLink
{
    /** Hosts aceitos como ORIGEM do link (o do QR impresso e o do portal). */
    private const ACCEPTED_HOSTS = ['nfce.sefaz.rn.gov.br', 'nfce.set.rn.gov.br', 'www.nfce.set.rn.gov.br'];

    private function __construct(
        public readonly AccessKey $key,
        public readonly ?string $token,
        public readonly ?string $sender,
    ) {}

    /** O link do app/e-mail abre a nota direto, sem código de segurança. */
    public function isDirect(): bool
    {
        return $this->token !== null && $this->sender !== null;
    }

    public static function parse(string $input): self
    {
        $input = trim($input);

        // Só a chave (digitada ou copiada do cupom, com ou sem espaços).
        if (preg_match('/^[\d\s.]{44,60}$/', $input)) {
            return new self(self::validKey($input), null, null);
        }

        $parts = parse_url($input);
        $host  = strtolower($parts['host'] ?? '');
        if (! $parts || ! in_array($parts['scheme'] ?? '', ['http', 'https'], true) || $host === '') {
            throw self::invalid();
        }

        if (! in_array($host, self::ACCEPTED_HOSTS, true)) {
            if (str_ends_with($host, '.gov.br')) {
                throw new NfceException(NfceException::UNSUPPORTED_STATE, 'Por enquanto só aceitamos notas do Rio Grande do Norte.');
            }
            throw self::invalid();
        }

        parse_str($parts['query'] ?? '', $query);
        $query = array_change_key_case($query, CASE_LOWER);

        // Link do app/e-mail: ?chNFCe=<chave>&token=<..>&Sender=<..>
        if (! empty($query['chnfce'])) {
            $token  = self::hexParam($query['token'] ?? null);
            $sender = self::hexParam($query['sender'] ?? null);

            return new self(self::validKey($query['chnfce']), $token, $sender);
        }

        // QR Code: ?p=<chave>|<versão>|<ambiente>[|...]
        if (! empty($query['p'])) {
            return new self(self::validKey(explode('|', $query['p'])[0]), null, null);
        }

        throw self::invalid();
    }

    private static function validKey(string $raw): AccessKey
    {
        $key = AccessKey::tryFrom($raw) ?? throw self::invalid();
        if ($key->uf() !== AccessKey::UF_RN) {
            throw new NfceException(NfceException::UNSUPPORTED_STATE, 'Por enquanto só aceitamos notas do Rio Grande do Norte.');
        }
        if ($key->model() !== AccessKey::MODEL_NFCE) {
            throw new NfceException(NfceException::INVALID_LINK, 'Este documento não é uma NFC-e (nota do consumidor).');
        }

        return $key;
    }

    private static function hexParam(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^[0-9A-Fa-f]{8,200}$/', $value) ? $value : null;
    }

    private static function invalid(): NfceException
    {
        return new NfceException(NfceException::INVALID_LINK, 'Este link não parece ser de uma NFC-e. Confira e tente novamente.');
    }
}
