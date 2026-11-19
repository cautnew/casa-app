import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPencil, faLink, faXmark, faBookmark } from "@fortawesome/free-solid-svg-icons";
import { CATEGORIES, UNITS } from "../../constants.js";
import { formatBRL } from "../../utils/format.js";
import { inputCls } from "../ui/Input.jsx";

const fmtQty = (q) => Number(q).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/**
 * Um item da nota na tela de revisão. Tudo vem preenchido; o usuário só ajusta o necessário.
 * Quantidade e preços vêm da nota — o ✎ permite corrigir quantidade/unidade quando preciso.
 */
export function NfceItemRow({ item, linkedListItem, linkOptions, onChange }) {
  const [editing, setEditing] = useState(false);
  const excluded = !item.include;
  const discounted = Math.abs(item.totalPrice - item.originalTotalPrice) >= 0.005;
  const unitPrice = item.quantity > 0 ? item.totalPrice / item.quantity : item.totalPrice;

  const link = (id) => {
    if (!id) return onChange({ shoppingListItemId: null });
    const li = linkOptions.find((o) => o.id === Number(id));
    onChange({ shoppingListItemId: li.id, name: li.name, category: li.category });
  };

  return (
    <div className={`rounded-xl border px-3 py-3 transition ${excluded ? "border-dashed border-stone-200 bg-stone-50" : "border-stone-200 bg-white"}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onChange({ include: !item.include })}
          className={`mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${item.include ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white"}`}
          aria-label={item.include ? "Não adicionar ao estoque" : "Adicionar ao estoque"}
          aria-pressed={item.include}
          title={item.include ? "Entra no estoque" : "Não entra no estoque"}
        >
          {item.include && <FontAwesomeIcon icon={faCheck} style={{ height: "0.75rem" }} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <input
              value={item.name}
              onChange={(e) => onChange({ name: e.target.value })}
              aria-label={`Nome do item ${item.description}`}
              className={`-ml-2 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium hover:border-stone-200 focus:border-stone-400 focus:bg-white focus:outline-none sm:max-w-xs ${excluded ? "text-stone-400" : "text-stone-800"}`}
            />
            <div className="shrink-0 text-left sm:pt-1 sm:text-right">
              <span className={`text-sm ${excluded ? "text-stone-400" : "text-stone-500"}`}>
                {fmtQty(item.quantity)} {item.unit} × {formatBRL(unitPrice)} ={" "}
              </span>
              <span className={`text-sm font-semibold ${excluded ? "text-stone-400" : "text-stone-900"}`}>{formatBRL(item.totalPrice)}</span>
            </div>
          </div>

          <p className="mt-0.5 truncate text-xs text-stone-400" title={item.description}>
            {item.description}
            {discounted && <> · nota: {formatBRL(item.originalTotalPrice)}</>}
            {excluded && <span className="text-stone-500"> · não entra no estoque</span>}
          </p>

          {editing && (
            <div className="mt-2 flex items-end gap-2">
              <label className="block">
                <span className="mb-0.5 block text-xs text-stone-400">Qtd</span>
                <input type="number" min="0.001" step="0.001" className={`${inputCls} w-28`}
                  value={item.quantity}
                  onChange={(e) => onChange({ quantity: e.target.value === "" ? "" : Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-xs text-stone-400">Unidade</span>
                <select className={`${inputCls} w-28`} value={item.unit} onChange={(e) => onChange({ unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => setEditing(false)} className="mb-2 text-xs font-medium text-stone-600 underline">ok</button>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={item.category}
              onChange={(e) => onChange({ category: e.target.value })}
              aria-label="Categoria"
              className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 focus:border-stone-400 focus:outline-none"
            >
              {(CATEGORIES.includes(item.category) ? CATEGORIES : [item.category, ...CATEGORIES]).map((c) => <option key={c}>{c}</option>)}
            </select>

            {linkedListItem ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-emerald-700">
                <FontAwesomeIcon icon={faCheck} style={{ height: "0.7rem" }} /> Lista: {linkedListItem.name}
                <button type="button" onClick={() => link(null)} className="ml-0.5 rounded-full p-1 hover:bg-emerald-100" aria-label="Desvincular da lista">
                  <FontAwesomeIcon icon={faXmark} style={{ height: "0.65rem" }} />
                </button>
              </span>
            ) : linkOptions.length > 0 ? (
              <label className="inline-flex items-center gap-1 text-xs text-stone-500">
                <FontAwesomeIcon icon={faLink} style={{ height: "0.7rem" }} className="text-stone-400" />
                <select
                  value=""
                  onChange={(e) => link(e.target.value)}
                  aria-label="Vincular a item da lista"
                  className="rounded-lg border border-dashed border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 focus:border-stone-400 focus:outline-none"
                >
                  <option value="">Vincular a item da lista…</option>
                  {linkOptions.map((o) => <option key={o.id} value={o.id}>{o.name}{o.bought ? " ✓" : ""}</option>)}
                </select>
              </label>
            ) : null}

            {item.matchSource === "alias" && !linkedListItem && (
              <span className="inline-flex items-center gap-1 text-xs text-stone-400" title="Nome e categoria lembrados de uma importação anterior">
                <FontAwesomeIcon icon={faBookmark} style={{ height: "0.65rem" }} /> lembrado
              </span>
            )}

            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="ml-auto rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Corrigir quantidade ou unidade" title="Corrigir quantidade ou unidade">
                <FontAwesomeIcon icon={faPencil} style={{ height: "0.75rem" }} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
