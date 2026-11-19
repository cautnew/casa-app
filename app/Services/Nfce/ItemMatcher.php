<?php

namespace App\Services\Nfce;

use App\Models\InventoryItem;
use App\Models\ProductAlias;
use App\Models\ShoppingListItem;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Sugere, para cada item da nota, o nome amigável, a categoria e o item da lista de compras correspondente.
 *
 * Prioridade: 1) vínculo lembrado (ProductAlias)  2) item da lista (marcados como comprados primeiro)
 *             3) item do inventário  4) descrição da nota + categoria por palavras-chave.
 * São apenas sugestões: o usuário confirma na tela de revisão.
 */
class ItemMatcher
{
    private const STOPWORDS = ['de', 'da', 'do', 'das', 'dos', 'em', 'com', 'c', 'e', 'sem', 'tipo', 'para', 'p', 'a', 'o', 'no', 'na'];
    private const UNIT_WORDS = ['kg', 'g', 'gr', 'ml', 'l', 'lt', 'un', 'und', 'uni', 'pc', 'pct', 'cx', 'fd'];

    /** Abreviações comuns em notas de supermercado. */
    private const ABBREVIATIONS = [
        'lte' => 'leite', 'leit' => 'leite', 'choc' => 'chocolate', 'ch' => 'chocolate', 'salg' => 'salgadinho',
        'refrig' => 'refrigerante', 'refri' => 'refrigerante', 'deterg' => 'detergente', 'sab' => 'sabao',
        'sabon' => 'sabonete', 'amac' => 'amaciante', 'desinf' => 'desinfetante', 'hig' => 'higienico',
        'iog' => 'iogurte', 'iogur' => 'iogurte', 'quei' => 'queijo', 'qjo' => 'queijo', 'pres' => 'presunto',
        'marg' => 'margarina', 'mant' => 'manteiga', 'bisc' => 'biscoito', 'cerv' => 'cerveja', 'frgo' => 'frango',
        'fgo' => 'frango', 'fil' => 'file', 'bov' => 'bovina', 'tang' => 'tangerina', 'tanger' => 'tangerina',
        'achoc' => 'achocolatado', 'req' => 'requeijao', 'ext' => 'extrato', 'tom' => 'tomate', 'int' => 'integral',
        'acuc' => 'acucar', 'feij' => 'feijao', 'macarr' => 'macarrao', 'azeit' => 'azeite', 'cr' => 'creme',
        'pap' => 'papel', 'alim' => 'alimento', 'cond' => 'condicionador', 'shamp' => 'shampoo', 'desod' => 'desodorante',
    ];

    private const CATEGORY_KEYWORDS = [
        'Farmácia'   => ['dipirona', 'paracetamol', 'ibuprofeno', 'xarope', 'comprimido', 'comp', 'caps', 'cpr', 'gts', 'pomada', 'curativo', 'band', 'vitamina', 'spray', 'nasal'],
        'Limpeza'    => ['detergente', 'sabao', 'desinfetante', 'amaciante', 'alvejante', 'sanitaria', 'esponja', 'limpador', 'limpa', 'multiuso', 'lustra', 'saco', 'lixo', 'vassoura', 'pano', 'inseticida'],
        'Higiene'    => ['higienico', 'sabonete', 'shampoo', 'condicionador', 'dental', 'escova', 'desodorante', 'absorvente', 'fralda', 'cotonete', 'lenco', 'barbear', 'fio'],
        'Bebidas'    => ['refrigerante', 'coca', 'guarana', 'suco', 'cerveja', 'vinho', 'agua', 'energetico', 'cha', 'refresco'],
        'Hortifruti' => ['banana', 'maca', 'kiwi', 'tangerina', 'laranja', 'limao', 'mamao', 'melao', 'melancia', 'uva', 'manga', 'abacaxi', 'pera', 'morango', 'abacate', 'tomate', 'cebola', 'batata', 'cenoura', 'alface', 'alho', 'pimentao', 'pepino', 'abobora', 'chuchu', 'brocolis', 'couve', 'repolho', 'macaxeira', 'inhame', 'coentro', 'cebolinha', 'hortifruti'],
        'Padaria'    => ['pao', 'bolo', 'bisnaguinha', 'torrada', 'rosca', 'broa'],
    ];

    /**
     * @param  array  $items  itens do DanfeParser
     * @return array  por índice: name, category, unit, shoppingListItemId, matchSource
     */
    public function suggest(array $items, string $cnpj): array
    {
        $aliases = ProductAlias::whereIn('store_cnpj', [$cnpj, ''])->get()
            ->sortBy(fn ($a) => $a->store_cnpj === '' ? 1 : 0) // específico da loja primeiro
            ->groupBy('nf_description')->map->first();
        $list      = ShoppingListItem::orderByDesc('bought')->orderBy('id')->get();
        $inventory = InventoryItem::orderBy('name')->get();

        $result = [];
        foreach ($items as $item) {
            $alias = $aliases->get(self::descriptionKey($item['description']));
            $result[$item['index']] = $alias
                ? ['name' => $alias->name, 'category' => $alias->category, 'unit' => $alias->unit, 'shoppingListItemId' => null, 'matchSource' => 'alias']
                : $this->fallback($item, $inventory);
        }

        // Vínculo com a lista: atribuição gulosa 1-para-1 pelos melhores pares.
        $pairs = [];
        foreach ($items as $item) {
            $descTokens = self::tokens($item['description']);
            $aliasName  = $result[$item['index']]['matchSource'] === 'alias' ? $result[$item['index']]['name'] : null;
            foreach ($list as $li) {
                $score = $aliasName !== null && self::normalize($aliasName) === self::normalize($li->name)
                    ? 2.0
                    : self::score(self::tokens($li->name), $descTokens);
                if ($score > 0) {
                    $pairs[] = [$score + ($li->bought ? 0.5 : 0), $item['index'], $li];
                }
            }
        }
        usort($pairs, fn ($a, $b) => $b[0] <=> $a[0]);

        $usedItems = [];
        $usedList  = [];
        foreach ($pairs as [$score, $index, $li]) {
            if (isset($usedItems[$index]) || isset($usedList[$li->id])) {
                continue;
            }
            $usedItems[$index] = $usedList[$li->id] = true;
            $result[$index]['shoppingListItemId'] = $li->id;
            if ($result[$index]['matchSource'] !== 'alias') {
                $result[$index]['name']        = $li->name;
                $result[$index]['category']    = $li->category;
                $result[$index]['matchSource'] = 'list';
            }
        }

        return $result;
    }

    private function fallback(array $item, Collection $inventory): array
    {
        $descTokens = self::tokens($item['description']);
        $best       = null;
        $bestScore  = 0;
        foreach ($inventory as $inv) {
            $score = self::score(self::tokens($inv->name), $descTokens);
            if ($score > $bestScore) {
                [$best, $bestScore] = [$inv, $score];
            }
        }

        if ($best) {
            return ['name' => $best->name, 'category' => $best->category, 'unit' => $item['unit'], 'shoppingListItemId' => null, 'matchSource' => 'inventory'];
        }

        return [
            'name'               => self::friendlyName($item['description']),
            'category'           => self::guessCategory($item['description']),
            'unit'               => $item['unit'],
            'shoppingListItemId' => null,
            'matchSource'        => null,
        ];
    }

    /** Chave usada para lembrar vínculos: descrição sem acentos, minúscula e com espaços normalizados. */
    public static function descriptionKey(string $description): string
    {
        return trim(preg_replace('/\s+/', ' ', Str::lower(Str::ascii($description))));
    }

    /** "KIWI kg" → "Kiwi" ; "SALG PIPPOS 75G BACON" → "Salg pippos 75g bacon" */
    public static function friendlyName(string $description): string
    {
        $name = preg_replace('/\s+(kg|un|und)$/i', '', trim($description));

        return Str::ucfirst(Str::lower($name));
    }

    public static function guessCategory(string $description): string
    {
        if (preg_match('/\d\s*(mg|mcg)\b/i', $description)) {
            return 'Farmácia';
        }
        $tokens = self::tokens($description);
        foreach (self::CATEGORY_KEYWORDS as $category => $words) {
            if (array_intersect($tokens, $words)) {
                return $category;
            }
        }

        return 'Outros';
    }

    private static function normalize(string $s): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', ' ', Str::lower(Str::ascii($s))));
    }

    /** @return string[] */
    public static function tokens(string $s): array
    {
        $out = [];
        foreach (explode(' ', self::normalize($s)) as $t) {
            if ($t === '' || preg_match('/\d/', $t) || in_array($t, self::STOPWORDS, true) || in_array($t, self::UNIT_WORDS, true)) {
                continue;
            }
            $out[] = self::ABBREVIATIONS[$t] ?? $t;
        }

        return array_values(array_unique($out));
    }

    /**
     * Fração dos tokens do candidato (nome da lista/inventário) encontrados na descrição.
     * Só considera par quando todos os tokens batem (ou ≥ 75% para nomes com 4+ palavras).
     */
    private static function score(array $candidate, array $desc): float
    {
        if (! $candidate || ! $desc) {
            return 0;
        }
        $matched = 0;
        foreach ($candidate as $c) {
            foreach ($desc as $d) {
                if ($c === $d || (min(strlen($c), strlen($d)) >= 3 && (str_starts_with($c, $d) || str_starts_with($d, $c)))) {
                    $matched++;
                    break;
                }
            }
        }
        $ratio = (float) $matched / count($candidate);
        $ok    = $ratio >= 1.0 || (count($candidate) >= 4 && $ratio >= 0.75);

        // Desempate: quanto mais da descrição o candidato explica, melhor.
        return $ok ? $ratio + min($matched / count($desc), 1) * 0.1 : 0;
    }
}
