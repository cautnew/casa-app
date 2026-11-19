<?php

namespace App\Services\Nfce;

use GuzzleHttp\Cookie\CookieJar;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\UriInterface;

/**
 * Acesso ao portal NFC-e da SEFAZ-RN.
 *
 * Segurança: só faz requisições HTTPS para self::HOST, com certificado verificado,
 * montando as URLs a partir da chave/token (nunca usa uma URL vinda do usuário) e
 * recusando redirecionamentos para qualquer outro host.
 */
class RnSefazClient
{
    public const HOST = 'nfce.sefaz.rn.gov.br';
    private const BASE = 'https://'.self::HOST;
    private const USER_AGENT = 'Mozilla/5.0 (compatible; CasaApp/1.0)';

    /** Link do app/e-mail: abre o DANFE direto. */
    public function fetchDanfe(NfceLink $link): array
    {
        $url = self::BASE.'/portalDFE/nota-potiguar/nfce-mobile-danfe.aspx?'.http_build_query([
            'chNFCe' => $link->key->value,
            'token'  => $link->token,
            'Sender' => $link->sender,
        ]);

        $html = $this->send(fn (PendingRequest $r) => $r->get($url))->body();

        if (! DanfeParser::looksLikeDanfe($html)) {
            throw new NfceException(NfceException::NOT_FOUND, 'A SEFAZ não encontrou esta nota. Confira se o link está completo.');
        }

        return DanfeParser::parse($html);
    }

    public static function danfeUrl(NfceLink $link): string
    {
        return self::BASE.'/portalDFE/nota-potiguar/nfce-mobile-danfe.aspx?'.http_build_query([
            'chNFCe' => $link->key->value, 'token' => $link->token, 'Sender' => $link->sender,
        ]);
    }

    public static function qrUrl(AccessKey $key): string
    {
        return self::BASE.'/consultarNFCe.aspx?p='.$key->value.'|3|1';
    }

    /**
     * Caminho do QR Code: abre a página que pede o código de segurança.
     *
     * @return array{state: array, captcha: string} estado a guardar (cookies + formulário) e a imagem (data URL)
     */
    public function startCaptcha(AccessKey $key): array
    {
        $jar  = new CookieJar;
        $url  = self::BASE.'/portalDFE/NFCe/mDadosNFCe.aspx?p='.rawurlencode($key->value.'|3|1');
        $html = $this->send(fn (PendingRequest $r) => $r->get($url), $jar)->body();

        $form = $this->captchaForm($html);
        if ($form === null) {
            Log::warning('NFC-e: página do código de segurança não reconhecida', ['key' => $key->value]);
            throw new NfceException(NfceException::NOT_FOUND, 'A SEFAZ não mostrou a nota. Tente novamente ou cole o link da nota.');
        }

        $state = ['key' => $key->value, 'pageUrl' => $url, 'form' => $form, 'cookies' => $jar->toArray()];

        return ['state' => $state, 'captcha' => $this->captchaImage($state)];
    }

    /**
     * Nova imagem do código de segurança para a mesma sessão.
     * O portal da SEFAZ falha com frequência nessa imagem (página de erro em ~metade das chamadas),
     * então tentamos algumas vezes antes de desistir.
     */
    public function captchaImage(array $state, int $attempts = 5): string
    {
        $jar = new CookieJar(false, $state['cookies']);
        for ($i = 1; $i <= $attempts; $i++) {
            $res  = $this->send(fn (PendingRequest $r) => $r->get(self::BASE.'/portalDFE/JpegImage.aspx'), $jar);
            $type = explode(';', $res->header('Content-Type') ?: '')[0];
            if ($res->successful() && str_starts_with($type, 'image/') && $res->body() !== '') {
                return 'data:'.$type.';base64,'.base64_encode($res->body());
            }
            if ($i < $attempts) {
                usleep(250_000);
            }
        }

        throw new NfceException(NfceException::SEFAZ_UNAVAILABLE, 'A SEFAZ não conseguiu gerar o código de segurança agora. Tente novamente ou cole o link da nota.');
    }

    /**
     * Envia o código digitado pelo usuário, como o navegador faria ao clicar em "Ver DANFE".
     *
     * @return array dados da nota (DanfeParser::parse)
     *
     * @throws NfceException WRONG_CODE com o novo estado em extra['state'] quando o código não foi aceito
     */
    public function submitCaptcha(array $state, string $code): array
    {
        $jar    = new CookieJar(false, $state['cookies']);
        $action = $state['form']['action'];
        $fields = [...$state['form']['fields'], 'txt_cod_antirobo' => $code, 'btnVerDanfe' => 'Ver DANFE'];

        $res  = $this->send(fn (PendingRequest $r) => $r->asForm()
            ->withHeaders(['Referer' => $state['pageUrl'], 'Origin' => self::BASE])
            ->post($action, $fields), $jar);
        $html = $res->body();

        if (DanfeParser::looksLikeDanfe($html)) {
            return DanfeParser::parse($html);
        }

        // Voltou para a página do código (código errado) ou caiu numa página de erro: recomeça a sessão.
        $form = $this->captchaForm($html);
        if ($form === null) {
            $this->keepForDiagnosis($state['key'], $html);
            $fresh = $this->startCaptcha(AccessKey::tryFrom($state['key']));
        } else {
            $newState = [...$state, 'form' => $form, 'cookies' => $jar->toArray()];
            $fresh = ['state' => $newState, 'captcha' => $this->captchaImage($newState)];
        }

        throw new NfceException(
            NfceException::WRONG_CODE,
            'Código incorreto ou expirado. Digite o código da nova imagem.',
            ['state' => $fresh['state'], 'captcha' => $fresh['captcha']],
        );
    }

    /** Campos ocultos do formulário ASP.NET + URL de envio (absoluta, sempre no host da SEFAZ). */
    private function captchaForm(string $html): ?array
    {
        if (! str_contains($html, 'txt_cod_antirobo')) {
            return null;
        }
        $doc  = \Dom\HTMLDocument::createFromString($html, LIBXML_NOERROR);
        $form = $doc->querySelector('form');
        if (! $form) {
            return null;
        }

        $fields = [];
        foreach ($form->querySelectorAll('input[type="hidden"]') as $input) {
            $fields[$input->getAttribute('name')] = (string) $input->getAttribute('value');
        }

        $action = (string) $form->getAttribute('action');
        $path   = parse_url($action, PHP_URL_PATH) ?? '';
        $query  = parse_url($action, PHP_URL_QUERY);
        // Ações relativas ("mDadosNFCeV2.aspx?...") são relativas a /portalDFE/NFCe/.
        $path   = str_starts_with($path, '/') ? $path : '/portalDFE/NFCe/'.ltrim($path, './');

        return ['action' => self::BASE.$path.($query ? '?'.$query : ''), 'fields' => $fields];
    }

    private function send(callable $call, ?CookieJar $jar = null): Response
    {
        try {
            $request = Http::timeout(15)
                ->connectTimeout(8)
                ->withUserAgent(self::USER_AGENT)
                ->withOptions([
                    'verify'          => true,
                    'cookies'         => $jar ?? false,
                    'allow_redirects' => [
                        'max'         => 3,
                        'protocols'   => ['https'],
                        'on_redirect' => function (RequestInterface $req, $res, UriInterface $uri) {
                            if (strtolower($uri->getHost()) !== self::HOST) {
                                throw new NfceException(NfceException::SEFAZ_UNAVAILABLE, 'A SEFAZ redirecionou para um endereço inesperado.');
                            }
                        },
                    ],
                ]);

            $response = $call($request);
        } catch (ConnectionException $e) {
            throw new NfceException(NfceException::SEFAZ_UNAVAILABLE, 'Não conseguimos acessar a SEFAZ agora. Tente novamente em instantes.');
        } catch (\GuzzleHttp\Exception\RequestException $e) {
            if ($e->getPrevious() instanceof NfceException) {
                throw $e->getPrevious();
            }
            throw new NfceException(NfceException::SEFAZ_UNAVAILABLE, 'Não conseguimos acessar a SEFAZ agora. Tente novamente em instantes.');
        }

        if ($response->serverError()) {
            throw new NfceException(NfceException::SEFAZ_UNAVAILABLE, 'A SEFAZ está instável no momento. Tente novamente em instantes.');
        }

        return $response;
    }

    /** Guarda páginas inesperadas (local, privado) para ajustar o leitor se a SEFAZ mudar o layout. */
    private function keepForDiagnosis(string $key, string $html): void
    {
        try {
            Storage::disk('local')->put('nfce-debug/'.$key.'-'.now()->format('Ymd-His').'.html', $html);
        } catch (\Throwable) {
            // diagnóstico é opcional
        }
    }
}
