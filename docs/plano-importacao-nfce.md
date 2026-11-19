# Plano — Registrar compras a partir de NFC-e (nota fiscal eletrônica)

> Status: **aprovado e implementado** (revisão 4) · 18/11/2026 — ver seção 11 para o que mudou na implementação.
>
> Revisão 4: regras para impedir nota duplicada reunidas na seção 4.7.
> Revisão 3: formato real do QR Code confirmado; o caminho QR exige o código de segurança da SEFAZ (2.1).
> Revisão 2: leitura do **QR Code pela câmera** (e por foto), com colar o link como alternativa;
> **desconto rateado proporcionalmente** entre os itens; **nome da loja lembrado por CNPJ**;
> `PC`/`PCT`/`PT` → **pacote**.

## 1. Objetivo

Hoje, ao finalizar a lista de compras, é preciso digitar loja, preço e quantidade de cada item.
A proposta é adicionar um segundo caminho: **escanear o QR Code da NFC-e** (ou colar o link)
e deixar o sistema preencher tudo: loja, data, itens, quantidade, unidade, preço unitário e total.
O registro manual continua existindo para compras sem nota.

## 2. O que foi verificado nas notas de exemplo

Os 5 links (portal "Nota Potiguar" da SEFAZ-RN) foram baixados com sucesso, **sem login e sem
captcha**. A página é HTML (ASP.NET) com elementos de `id` fixo, o que torna a leitura confiável:

| Dado | Elemento na página | Exemplo |
|---|---|---|
| Nome da loja | `lblNomeFantasia` (pode faltar) / `lblRazaoSocialEmitente` | "Loja 268 - Natal Maria Lacerda" / "SENDAS DISTRIBUIDORA S/A" |
| CNPJ e endereço | `lblCPFCNPJEmitente`, `lblEnderecoEmitente` | 06.057.223/0495-02 |
| Itens | `tbItensList_lblTbItens{Codigo,Descricao,Qtde,Unidade,ValorUnid,ValorTotal}_N` | "KIWI kg · 0,695 · Kg · 38,49 · 26,75" |
| Totais | `lblValorTotal`, `lblValorDesconto`, `lblValorPago` | 97,90 / 4,99 / 92,91 |
| Pagamento | `lblFormaPagamento` (um ou vários `<div>`) | "Cartão de Crédito 100,00" + "Vale Alimentação 235,28" |
| Chave de acesso | `lblChave` (44 dígitos) | 2426110605... |
| Data de emissão | `lblDataEmissao` | 11/11/2026 19:05:26 |
| Situação | `lblSituacao` | "Autorizada" |

Observações que influenciam o desenho:
- Números no formato brasileiro (`1.234,56`; quantidade `0,695`).
- As unidades variam muito (`Kg`, `Un`, `UN`, `UND`, `Uni`, `PC`). Elas serão normalizadas para as unidades do app; ver 4.2.
- As descrições são abreviadas ("LTE PO NOLAC 300G", "SALG PIPPOS 75G BACON") e não batem com os nomes da lista ("Leite em pó"). Por isso o sistema precisa de **vínculo + memória de vínculos** (seção 4.3).
- Notas podem ter desconto no total (ex.: Sushi Villa 97,90 − 4,99). Esse desconto será rateado entre os itens (4.4).
- A chave de acesso é única por nota e serve para impedir importação duplicada.
- Outros estados têm portais diferentes. Ficam fora do escopo agora, mas a arquitetura permite adicioná-los.

### 2.1 O QR Code impresso (verificado com as fotos enviadas)

Decodifiquei os QR Codes das fotos dos cupons. O conteúdo segue o padrão nacional v3:

```
http://nfce.set.rn.gov.br/consultarNFCe.aspx?p=24261106057223049502650020001768301020613606|3|1
                                              └──────────── chave de acesso (44) ─────────┘ │ └ ambiente (1 = produção)
                                                                                          versão do QR
```

O que acontece ao abrir esse link:
1. `nfce.set.rn.gov.br` redireciona para HTTPS, mas o certificado desse host é de `*.sefaz.rn.gov.br`.
   O certificado não confere, então o app **não** usa esse host. Ele extrai a chave e consulta direto
   `https://nfce.sefaz.rn.gov.br/consultarNFCe.aspx?p=<chave>|3|1`, que responde normalmente.
2. A SEFAZ leva a `portalDFE/NFCe/mDadosNFCe.aspx`, que **exige um código de segurança (captcha
   de 6 caracteres)** antes de mostrar a nota. Os links do app/e-mail Nota Potiguar
   (`nfce-mobile-danfe.aspx?chNFCe=…&token=…&Sender=…`) **não** têm essa etapa. Por isso eles abriram direto.

Consequência: o caminho pelo QR Code tem **um passo a mais, feito por você**. O app mostra a imagem
do código de segurança da própria SEFAZ, você digita os 6 caracteres e o app continua a leitura.
O app **não** tenta quebrar ou contornar o captcha: quem resolve é sempre uma pessoa. Detalhes em 3.2 e 4.2.

Outras observações:
- O QR já entrega a chave, então a checagem de "nota já importada" acontece **antes** do captcha.
  Uma nota repetida nem pede o código.
- Das 5 fotos, só 2 foram decodificadas por uma leitura simples de imagem estática (as outras estavam
  inclinadas/desfocadas). A leitura ao vivo pela câmera, que tenta vários quadros por segundo, é bem mais
  tolerante, mas reforça a importância de manter "colar o link" sempre à mão.
- O formato da página exibida **depois** do código de segurança só pode ser confirmado digitando um
  código real. Isso será feito com você no início da implementação. A expectativa é que seja o mesmo
  layout de DANFE já mapeado (mesmos `id`s). Se não for, entra um segundo parser.

## 3. Experiência do usuário (UX/UI)

O visual do sistema é mantido: mesmos componentes (`Modal`, `Card`, `Button`, `Field/Input/Select`, `Badge`),
paleta `stone`, ícones FontAwesome e cantos `rounded-xl`.

### 3.1 Pontos de entrada

1. **Lista de compras → "Finalizar compra"** abre primeiro um seletor simples de 2 opções:

```
┌─ Finalizar compra ───────────────────────────────────┐
│  Como você quer registrar esta compra?               │
│                                                      │
│  ┌──────────────────────────┐ ┌────────────────────┐ │
│  │ [🧾] Com nota fiscal      │ │ [✎] Manualmente    │ │
│  │ Escaneie o QR Code ou    │ │ Informe loja e     │ │
│  │ cole o link da NFC-e.    │ │ preço de cada item │ │
│  │        (Recomendado)     │ │                    │ │
│  └──────────────────────────┘ └────────────────────┘ │
└──────────────────────────────────────────────────────┘
```
   - "Manualmente" leva ao fluxo atual, sem alterações (continua exigindo itens marcados).
   - "Com nota fiscal" **não exige** itens marcados. A nota é a fonte da verdade; os itens marcados só ajudam no vínculo automático.
2. **Compras → novo botão "Importar NFC-e"** ao lado de "Nova compra", para compras fora da lista (restaurante, farmácia).

### 3.2 Passo 1 — Ler a nota (QR Code ou link)

Duas abas no topo do modal. A aba inicial é **Escanear QR Code** quando o aparelho tem câmera
(celular) e **Colar link** quando não tem (desktop sem webcam). A última aba usada é lembrada.

```
┌─ Importar nota fiscal ───────────────────────── ① ─ ② ┐
│  [ 📷 Escanear QR Code ]   [ 🔗 Colar link ]           │
│ ┌───────────────────────────────────────────────────┐ │
│ │                                                   │ │
│ │        ┌───────────────────────┐                  │ │
│ │        │   (vídeo da câmera)   │   moldura guia   │ │
│ │        └───────────────────────┘                  │ │
│ │  Aponte para o QR Code no rodapé do cupom         │ │
│ └───────────────────────────────────────────────────┘ │
│  [🔦 Lanterna]  [🔄 Trocar câmera]  [🖼 Ler de uma foto] │
│                                                       │
│  QR Code ilegível?  Cole o link da nota →              │
└───────────────────────────────────────────────────────┘
```

**Escanear QR Code**
- A câmera traseira abre automaticamente. A leitura é contínua: assim que o código é reconhecido,
  o aparelho vibra (quando suportado), a moldura fica verde e a nota passa direto para a leitura,
  sem botão extra.
- **Lanterna**, para cupons em ambientes escuros (quando o aparelho suporta), e **Trocar câmera**.
- **Ler de uma foto**: abre a câmera nativa ou a galeria (`<input type="file" accept="image/*" capture>`).
  Serve para cupom amassado, foto já tirada ou navegador sem acesso ao vídeo.
- Se nenhum código for reconhecido em ~15 s, aparece a dica "Tente aproximar, melhorar a luz ou
  **colar o link**", com atalho para a outra aba.
- Se o QR lido não for de NFC-e (outro QR do cupom, por exemplo), aparece um aviso e a leitura continua.
- Depois da leitura do QR, aparece a etapa **Código de segurança da SEFAZ**:

```
┌─ Importar nota fiscal ───────────────────────── ① ─ ② ┐
│ ✓ QR Code lido · NFC-e 176830 · Sendas                 │
│                                                       │
│ A SEFAZ pede um código de segurança para liberar a    │
│ nota. Digite os caracteres da imagem:                 │
│                                                       │
│   ┌──────────────┐                                    │
│   │  (imagem da  │  [↻ Outra imagem]                  │
│   │   SEFAZ)     │                                    │
│   └──────────────┘                                    │
│   [ _ _ _ _ _ _ ]                    [Continuar →]    │
│                                                       │
│ Tem o link da nota (app/e-mail Nota Potiguar)?        │
│ Cole o link e pule esta etapa →                       │
└───────────────────────────────────────────────────────┘
```
  - O campo já vem com foco, em maiúsculas automáticas e com o teclado certo no celular; Enter envia.
  - Código errado: a mensagem "Código incorreto, tente o da nova imagem" aparece, a imagem é renovada e o campo é limpo.
  - Antes dessa etapa o app já mostra a loja/número da nota (quando der para saber) e já avisa se a nota é repetida.
- Permissão de câmera negada ou indisponível: mensagem explicando como liberar, e a aba
  "Colar link" é aberta automaticamente.
- A câmera é **desligada** ao trocar de aba, fechar o modal ou concluir a leitura.

**Colar link**
```
│ Link da NFC-e                                         │
│ [ https://nfce.sefaz.rn.gov.br/...          ] [Colar] │
│ Dica: o link vem no e-mail/app Nota Potiguar ou no    │
│ texto do QR Code.                [Ler nota  →]        │
```
- Campo com foco automático, botão **Colar** (Clipboard API, se disponível), Enter envia.
- O formato é validado na hora, com mensagem clara.

**Comum às duas abas**
- Durante a leitura, aparece o estado "Lendo nota…" com skeleton dos itens.
- Erros, cada um com mensagem e ação:
  - link/QR inválido ou de outro estado → "Por enquanto só aceitamos notas do RN";
  - SEFAZ fora do ar ou timeout → "Não conseguimos acessar a SEFAZ agora" + **Tentar novamente**;
  - nota não autorizada (cancelada/denegada) → a importação é bloqueada;
  - **nota já importada** → a importação é bloqueada (ver regras completas em **4.7**):

```
┌─ Importar nota fiscal ────────────────────────────────┐
│  ⓘ Esta nota já foi registrada                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Sendas – Loja 268 · 11/11/2026 · R$ 158,91        │ │
│  │ 9 itens · importada em 12/11/2026 às 08:14        │ │
│  └──────────────────────────────────────────────────┘ │
│              [Ler outra nota]  [Ver compra →]          │
└───────────────────────────────────────────────────────┘
```

**Requisito técnico:** o navegador só libera a câmera em **HTTPS** (ou `localhost`). O DDEV já
serve em HTTPS; em produção o domínio precisa de certificado.

### 3.3 Passo 2 — Revisar e confirmar

```
┌─ Importar nota fiscal ─────────────────────────── ① ─ ② ┐
│ ┌ Loja [Assaí Maria Lacerda        ]  Data [13/11/2026] ┐│
│ │ CNPJ 55.440.120/0001-00 · Cartão de Crédito            ││
│ │ ✓ Nome que você usou da última vez para esta loja      ││
│ └────────────────────────────────────────────────────────┘│
│ 9 itens · 6 vinculados à lista     Categoria p/ todos [▾] │
│ ┌────────────────────────────────────────────────────────┐│
│ │☑ Banana                    1,18 kg × 5,59 = R$ 6,60    ││
│ │  BANANA PRATA kg · nota: R$ 6,95                        ││
│ │  [Hortifruti ▾]  ✓ Lista: Banana                    [✎] ││
│ ├────────────────────────────────────────────────────────┤│
│ │☑ LTE PO NOLAC 300G         1 pacote × 21,99 = R$ 21,99 ││
│ │  [Alimentos ▾]   [Vincular a item da lista… ▾]          ││
│ └────────────────────────────────────────────────────────┘│
│ ⚠ Ficaram na lista sem correspondência: Ovos, Detergente  │
│   (continuam na lista para a próxima compra)               │
│ Subtotal 97,90 · Desconto −4,99 (rateado entre os itens)   │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Total pago R$ 92,91 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ [Quanto cada um pagou — componente atual]                  │
│                    [← Voltar]  [Registrar compra]          │
└────────────────────────────────────────────────────────────┘
```
- **Tudo vem preenchido**; o usuário só confere. Campos editáveis: nome da loja, data, nome
  amigável do item, categoria, vínculo com a lista e incluir/excluir item.
- A descrição original da nota aparece sempre em cinza, para rastreabilidade, e o nome amigável fica em destaque.
- **Desconto rateado:** quando a nota tem desconto, cada item mostra o valor já com desconto em destaque
  e o valor original da nota em cinza ("nota: R$ 6,95"). Sem desconto, só um valor aparece.
- **Nome da loja:** se a loja (CNPJ) já foi usada antes, vem com o nome que você deu, junto da dica
  "Nome que você usou da última vez". Se for nova, vem o nome fantasia (ou a razão social), editável.
  O nome que você confirmar é lembrado para as próximas notas desse CNPJ.
- **Vínculo com a lista:** sugestão automática (chip ✓ verde). Sem sugestão, aparece o select
  "Vincular a item da lista…" com os itens pendentes. Ao vincular, o item adota o nome e a categoria do item da lista.
- **Checkbox por item**, para ignorar o que não deve entrar no estoque (ex.: sacola). O item ignorado
  continua contando no total pago (o dinheiro saiu), mas não vai para o inventário.
- "Categoria para todos" agiliza notas de restaurante e farmácia (ex.: tudo em "Alimentos").
- Quantidade e preços vêm da nota e ficam somente leitura, para não divergir do documento fiscal.
  O ícone ✎ permite corrigir quando necessário.
- O rodapé mostra subtotal, desconto e **total pago** em destaque (mesmo bloco escuro do fluxo atual).
- Pagamento por integrante: reutiliza `MemberPaymentsInput`, com o total pago já preenchido.
- No celular, cada item vira um card empilhado e os botões de ação ficam fixos no rodapé do modal.

### 3.4 Depois de registrar
- Toast "Compra registrada a partir da NFC-e (9 itens)".
- Os itens vinculados saem da lista de compras (como no fluxo atual); os não vinculados permanecem.
- Na página **Compras**, a compra ganha o badge **NFC-e** e o botão **Ver nota**, que abre o link original em nova aba.

## 4. Backend (Laravel)

### 4.1 Banco de dados — nova migration

`purchases` (colunas novas, todas opcionais; compras antigas não mudam):
| Coluna | Tipo | Uso |
|---|---|---|
| `source` | string, default `manual` | `manual` · `list` · `nfce` |
| `nfce_access_key` | string(44), nullable | chave de acesso; **única por casa** (`user_id` + chave) |
| `nfce_url` | text, nullable | link original (botão "Ver nota") |
| `store_cnpj` | string(14), nullable, indexado | CNPJ do emitente, só dígitos (usado para lembrar o nome da loja) |
| `subtotal` | decimal(10,2), nullable | valor total dos produtos na nota |
| `discount` | decimal(10,2), default 0 | desconto da nota |
| `payment_method` | string, nullable | "Cartão de Crédito 100,00; Vale Alimentação 235,28" |

`purchase_items`:
| Coluna | Uso |
|---|---|
| `original_name` (string, nullable) | descrição como veio na nota |
| `original_unit_price`, `original_total_price` (decimal, nullable) | valores impressos na nota, antes do rateio do desconto |
| `unit_price` → `decimal(10,4)` | preço por kg com mais casas não perde precisão |

Nova tabela **`product_aliases`** (memória de vínculos, por casa, com `BelongsToHouse`):
| Coluna | Uso |
|---|---|
| `user_id` | casa |
| `store_cnpj` (nullable) | descrições são específicas de cada rede |
| `nf_description` | descrição normalizada da nota ("lte po nolac 300g") |
| `name`, `category`, `unit` | como o usuário quer ver o item |

Quando o usuário vincula ou renomeia "LTE PO NOLAC 300G" → "Leite em pó" (Alimentos), isso é
lembrado e aplicado automaticamente na próxima nota. **Cada importação fica mais rápida que a anterior.**

Nova tabela **`store_aliases`** (nome da loja por casa, com `BelongsToHouse`):
`user_id`, `cnpj` (único por casa), `name`. Ela é criada ou atualizada a cada importação com o nome confirmado.
Usei uma tabela dedicada em vez de "pegar o nome da última compra" porque, se a última compra for
editada ou apagada, a escolha do usuário não se perde.

### 4.2 Leitura da nota

- `app/Services/Nfce/NfceReader.php` (interface) + `RnNfceReader.php` (SEFAZ-RN), com dois caminhos (ver 2.1):
  - **Link do app/e-mail** (`chNFCe` + `token` + `Sender`): leitura direta, numa chamada só.
  - **QR Code** (`p=<chave>|3|1`):
    1. `start`: o backend abre `https://nfce.sefaz.rn.gov.br/consultarNFCe.aspx?p=…`, guarda na sessão do
       usuário os cookies e campos ocultos do formulário ASP.NET e devolve ao front a imagem do código
       de segurança (como `data:` URL, sem expor a SEFAZ diretamente ao navegador);
    2. `continue`: recebe o código digitado, envia o formulário com os mesmos cookies e lê o DANFE resultante.
       Código errado → retorna erro + nova imagem.
    O estado fica em cache por ~5 min, vinculado à sessão do usuário e à chave.
  Um registro por host permite adicionar outros estados no futuro sem mexer no resto.
- Usa `Http::timeout(15)->retry(2)` e `DOMDocument`/`DOMXPath` buscando pelos `id`s da tabela da seção 2.
- Converte números BR → decimal e data BR → ISO, e normaliza a unidade (sem diferenciar maiúsculas/minúsculas):

| Na nota | No app |
|---|---|
| `KG` | `kg` |
| `G`, `GR` | `g` |
| `L`, `LT` | `L` |
| `ML` | `ml` |
| `UN`, `UND`, `UNI`, `UNID` | `un` |
| **`PC`, `PCT`, `PT`, `PAC`** | **`pacote`** |
| `CX` | `caixa` |
| desconhecida | `un` (e o usuário pode corrigir na revisão) |

- Retorna um DTO `NfceData` (emitente, itens, subtotal, desconto, total pago, pagamentos, chave, data, situação).
- **Segurança (SSRF):** o usuário pode informar links de `nfce.sefaz.rn.gov.br` e `nfce.set.rn.gov.br`
  (este último só como fonte da chave). O backend **só faz requisições para `https://nfce.sefaz.rn.gov.br`**,
  com verificação de certificado sempre ativa. Ele monta a URL a partir da chave/token extraídos, nunca
  usa a URL recebida como está, e não segue redirecionamentos para fora desse host.

### 4.3 Sugestão de vínculo e categoria

`app/Services/Nfce/ItemMatcher.php`, em ordem de prioridade:
1. alias salvo (`product_aliases`) para aquela descrição (+ CNPJ);
2. item **marcado como comprado** na lista com nome semelhante;
3. item pendente da lista ou item do inventário com nome semelhante;
4. sem vínculo: o nome vira a descrição da nota em formato legível ("Kiwi") e a categoria sai por palavras-chave
   simples (ex.: kg de fruta/verdura → Hortifruti; "DETERG", "SABAO" → Limpeza), ou "Outros".

Semelhança: o matcher remove acentos, números/gramaturas e stopwords e compara tokens, inclusive por prefixo,
para abreviações como "LTE"→"leite" (via um pequeno dicionário de abreviações comuns). As sugestões são
só sugestões: o usuário confirma na tela de revisão.

### 4.4 Rateio proporcional do desconto

O **total da compra é o valor pago**, e o desconto é distribuído entre os itens proporcionalmente
ao valor de cada um na nota:

```
fator          = valor pago / subtotal                    (ex.: 92,91 / 97,90)
total do item  = round(total na nota × fator, 2)
centavos que sobram do arredondamento → somados ao item de maior valor
preço unitário = total do item / quantidade              (4 casas decimais)
```

- Garantia: a **soma dos itens é exatamente igual ao valor pago**.
- O rateio inclui todos os itens, mesmo os desmarcados para o estoque, porque o dinheiro foi pago por todos.
- O **preço unitário com desconto** é o que vai para o histórico de preços e o inventário, pois é o preço efetivamente pago.
  Os valores originais ficam em `original_unit_price`/`original_total_price`.
- Assim, a análise de gastos por categoria passa a refletir exatamente o que foi pago.
- Nota sem desconto: fator = 1, valores idênticos aos da nota.
- O cálculo é feito **no backend** (fonte única da verdade); a tela de revisão mostra o resultado vindo do `preview`.

### 4.5 Endpoints (dentro do grupo `auth` existente)

| Método | Rota | Função |
|---|---|---|
| `POST` | `/api/nfce/read` `{input}` | Ponto único para QR Code, link colado ou chave digitada. Responde `duplicate` (com a compra existente, sem consultar a SEFAZ), `captcha` (caminho QR: `sessionId` + imagem do código) ou `ready` (prévia completa). **Não grava nada.** |
| `POST` | `/api/nfce/captcha/refresh` `{sessionId}` | Nova imagem do código de segurança. |
| `POST` | `/api/nfce/captcha/submit` `{sessionId, code}` | Envia o código digitado. Certo → `ready` + prévia; errado → 422 `wrong_code` + nova imagem. |
| `POST` | `/api/nfce/import` | Recebe `accessKey`, loja/data (editáveis), itens revisados (`index`, `include`, `name`, `category`, `unit`, `quantity`, `shoppingListItemId`) e `memberPayments`. Grava tudo numa transação. |

No `import`, o backend usa a nota que **ele mesmo leu** (guardada em cache no `preview`/`continue`,
pela chave), e não os valores do payload. Para o caminho QR isso evita pedir o código de novo. Também refaz o rateio, recusa duplicata (HTTP 409) e então:
- cria a `Purchase` (`source=nfce`, total = **valor pago**, subtotal, desconto, CNPJ, chave, link);
- cria os `PurchaseItem`s com os valores rateados e os originais;
- atualiza o inventário e o histórico de preços dos itens incluídos;
- remove da lista os itens vinculados e desmarca `in_next_list` no inventário de origem;
- salva ou atualiza `product_aliases` e `store_aliases`;
- grava os pagamentos por integrante.

### 4.7 Impedir que a mesma nota seja registrada mais de uma vez

**Identificador:** a **chave de acesso** (44 dígitos), que é única para cada NFC-e no país. O link do app,
o link do QR e o número impresso no cupom levam à mesma chave. Por isso a mesma nota é reconhecida
por qualquer caminho de entrada (ex.: importada pelo QR hoje e colada pelo link amanhã).

**Quatro barreiras, da mais cedo para a mais segura:**

| # | Momento | Como | Por quê |
|---|---|---|---|
| 1 | Assim que o QR é lido ou o link é colado | O front extrai a chave e o backend confere antes de consultar a SEFAZ | Avisa na hora, sem esperar a SEFAZ e **sem pedir o código de segurança** |
| 2 | Na tela de revisão | `read`/`captcha/submit` devolvem `alreadyImported` + dados da compra existente | Cobre o caso raro em que a chave só é conhecida depois da leitura |
| 3 | Ao clicar em "Registrar compra" | O `import` confere de novo dentro da transação → **HTTP 409** com os dados da compra existente | Outra pessoa da casa pode ter importado a mesma nota em outro celular enquanto você revisava |
| 4 | No banco de dados | Índice **único** `(user_id, nfce_access_key)` em `purchases`; violação é convertida em 409 | Garantia final contra cliques duplos ou requisições simultâneas, mesmo que as barreiras acima falhem |

Além disso, o botão "Registrar compra" fica desabilitado com "Registrando…" enquanto a requisição está em andamento.

**Regras:**
- Duplicata pela chave **não tem "importar mesmo assim"**: é a mesma nota, e importar de novo dobraria
  gastos e estoque. As opções são "Ver compra" e "Ler outra nota".
- **Editar** uma compra importada mantém a chave, então ela continua protegida.
- **Excluir** a compra libera a chave, e a nota pode ser importada de novo. É o jeito de "refazer" uma importação errada.
- A unicidade é **por casa**: duas casas diferentes podem registrar a mesma nota (ex.: compra dividida
  entre casas), sem que uma veja os dados da outra.
- Notas canceladas/denegadas já são bloqueadas antes (3.2), então não chegam a esta checagem.

**Compra registrada manualmente antes (sem chave):** se você registrou a compra à mão e depois tenta
importar a nota, a chave não ajuda. Para esse caso há um **alerta suave** na revisão quando existir
compra **sem nota** na mesma data com o mesmo valor total (±R$ 0,01):

```
⚠ Parece que esta compra já foi registrada manualmente:
  "Sendas" · 11/11/2026 · R$ 158,91 · 9 itens          [Ver compra]
  Se for a mesma, cancele a importação ou exclua a compra manual antes.
                                   [Cancelar]  [Importar mesmo assim]
```
Aqui "Importar mesmo assim" existe porque pode ser coincidência (duas compras diferentes de mesmo valor no mesmo dia).

### 4.8 Refatoração para não duplicar regras

Hoje `PurchaseController::store` e `ShoppingController::finalize` têm cópias iguais de
`upsertInventory` e da criação da compra. Elas serão extraídas para um `app/Services/PurchaseRecorder.php`,
usado pelos três fluxos (manual, lista, NFC-e). O comportamento dos fluxos atuais **não muda**.

## 5. Frontend (React)

| Arquivo | Mudança |
|---|---|
| `components/nfce/NfceImportModal.jsx` (novo) | Modal em 2 passos (ler → revisar), estados de loading/erro |
| `components/nfce/QrScanner.jsx` (novo) | Câmera ao vivo, lanterna, troca de câmera, leitura por foto, liberação da câmera ao sair |
| `components/nfce/SecurityCodeStep.jsx` (novo) | Etapa do código de segurança da SEFAZ (imagem, campo, renovar, erro) |
| `components/nfce/NfceLinkInput.jsx` (novo) | Aba "Colar link" |
| `components/nfce/NfceItemRow.jsx` (novo) | Linha/card do item na revisão |
| `components/shared/PurchaseMethodChooser.jsx` (novo) | Seletor "Com nota fiscal / Manualmente" |
| `pages/ShoppingList.jsx` | "Finalizar compra" abre o seletor; fluxo manual intacto |
| `pages/Purchases.jsx` | Botão "Importar NFC-e"; badge NFC-e e "Ver nota" nos cards |
| `store/StoreContext.jsx` | Ação `IMPORT_NFCE` + recarga do estado (o `preview` é chamado direto, sem alterar o estado) |
| `utils/nfce.js` (novo) | Validação do link e extração da chave (formatos `chNFCe` e `p=`) |
| `constants.js` | Sem mudança: `pacote` já existe em `UNITS` |

**Biblioteca de QR Code:** `qr-scanner` (nimiq, MIT, ~16 kB gzip). Ela usa a API nativa
`BarcodeDetector` quando disponível (Chrome/Android) e, nos outros casos (Safari/iOS), cai para um
decodificador em Web Worker. Suporta câmera ao vivo, leitura de imagem e lanterna.
Ela é carregada sob demanda (`import()` dinâmico), só quando o modal abre, e não pesa no resto do app.

## 6. Testes

- **Unitários do leitor:** fixtures HTML das 5 notas de exemplo em `tests/Fixtures/nfce/`, com CPF, nome e
  endereço do destinatário **anonimizados**. Cobrem 1 item, 9 itens, 22 itens, desconto, múltiplos pagamentos e nota
  sem nome fantasia. Mais a página do código de segurança e o DANFE pós-código, capturados no teste com você (2.1).
- **Unitários:** números/datas BR, normalização de unidades (incl. `PC`/`PCT` → pacote), extração da chave
  dos dois formatos de link, matcher e **rateio** (a soma tem que bater com o valor pago ao centavo;
  sem desconto os valores ficam iguais; arredondamento com muitos itens).
- **Duplicidade (4.7):** mesma nota pelo link e depois pelo QR (bloqueada sem chamar a SEFAZ nem pedir código);
  `import` repetido → 409; duas requisições simultâneas → só uma grava (índice único); excluir a compra libera
  a reimportação; mesma nota em duas casas é permitida; alerta de possível duplicata com compra manual.
- **Feature** (`Http::fake`): preview, import, URL fora da lista permitida (422),
  SEFAZ indisponível (502), nota cancelada, isolamento entre casas, itens vinculados removidos da lista,
  nome de loja lembrado na segunda importação do mesmo CNPJ.
- **Manual:** os 5 links reais no navegador, mais o escaneamento de um cupom real pelo celular (via HTTPS do DDEV),
  incluindo QR por foto e permissão de câmera negada.

## 7. Ordem de implementação

1. Migration + models (`Purchase`, `PurchaseItem`, `ProductAlias`, `StoreAlias`).
2. `PurchaseRecorder` + refatoração dos dois controllers existentes, com testes garantindo o comportamento atual.
3. `RnNfceReader` (link do app + link do QR) + normalização + fixtures + testes.
4. Rateio do desconto + `ItemMatcher` + endpoints `preview`/`import` + testes.
5. Frontend: seletor, modal com aba "Colar link", tela de revisão, badge/"Ver nota".
6. Backend `read` (caminho QR) + `captcha/refresh`/`captcha/submit` (capturar com você uma página pós-código real) + frontend: aba
   "Escanear QR Code" (câmera, foto, lanterna, fallbacks) e etapa do código de segurança.
7. Teste ponta a ponta com as notas reais e um cupom físico.

## 8. Fora do escopo (possíveis próximos passos)

- Notas de outros estados (basta um novo `NfceReader`).
- Importar várias notas de uma vez.

## 9. Decisões tomadas

| # | Decisão |
|---|---|
| 1 | Total da compra = **valor pago**; o desconto é **rateado proporcionalmente** entre os itens (seção 4.4). Os valores originais da nota ficam guardados. |
| 2 | Nome da loja: nome fantasia (ou razão social) na primeira vez; o nome que você der é **lembrado por CNPJ** e aplicado automaticamente nas próximas notas. |
| 3 | `PC`, `PCT`, `PT`, `PAC` → **pacote** (nunca "un"). |
| 4 | Entrada por **QR Code** (câmera ao vivo ou foto) e por **link colado**, como alternativa sempre visível. |
| 5 | Caminho QR inclui a etapa do **código de segurança da SEFAZ**, digitado por você (proposta; aguardando aprovação). |
| 6 | **Nota duplicada é bloqueada** pela chave de acesso (4 barreiras, seção 4.7); compra manual parecida gera alerta suave. |

## 10. Pendência

- ~~Foto do QR Code~~ — recebida e decodificada (seção 2.1).
- Na implementação: uma sessão rápida com você digitando um código de segurança real, para capturar o
  layout do DANFE pós-código e criar a fixture de teste.

## 11. Notas da implementação

- **Endpoints simplificados:** `preview` e `qr/start` viraram um único `POST /api/nfce/read`, que decide sozinho
  entre link direto, QR (código de segurança) e chave digitada (tabela da seção 4.5 atualizada).
- **Outros valores (entrega/taxas):** a nota do Sushi Villa lista 1 item de R$ 80,90, mas o total dos produtos é
  R$ 97,90 — R$ 17,00 cobrados sem item. A revisão mostra "Itens na nota", "Outros valores", "Desconto" e o
  "Total pago"; pela regra 1 da seção 9, o valor pago é distribuído entre os itens.
- **Chave de acesso validada** pelo dígito verificador (módulo 11) no navegador e no servidor — um QR mal lido
  ou uma chave digitada errada é recusada na hora, sem consultar a SEFAZ.
- **Endurecimento:** as rotas de leitura têm limite de 30 requisições/min por usuário; páginas inesperadas da
  SEFAZ no caminho do QR são guardadas em `storage/app/private/nfce-debug/` para diagnóstico.
- **Banco em execução:** no DDEV a aplicação usa MariaDB (o DDEV sobrescreve o `DB_CONNECTION` do `.env`).
  A migration foi aplicada e conferida no MariaDB; os testes automáticos usam SQLite em memória.
- **Verificado com a SEFAZ real (de dentro do DDEV):** leitura direta do link do app (22 itens, R$ 335,28,
  "Autorizada") e abertura da página do código de segurança (imagem + cookie de sessão).
- **Ainda não verificado:** o envio de um código de segurança correto — depende de uma pessoa digitar um código
  real (pendência da seção 10).

