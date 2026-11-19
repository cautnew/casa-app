import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faTriangleExclamation, faStore } from "@fortawesome/free-solid-svg-icons";
import { CATEGORIES } from "../../constants.js";
import { formatBRL } from "../../utils/format.js";
import { fmtDate } from "../../utils/date.js";
import { Field, Input } from "../ui/Input.jsx";
import { MemberPaymentsInput } from "../shared/MemberPaymentsInput.jsx";
import { NfceItemRow } from "./NfceItemRow.jsx";

/** Passo 2: revisar o que veio da nota e confirmar. */
export function NfceReview({ preview, form, setForm, members, shoppingList, onViewPurchase }) {
  const setItem = (index, patch) =>
    setForm((f) => ({ ...f, items: f.items.map((i) => (i.index === index ? { ...i, ...patch } : i)) }));

  const applyCategoryToAll = (category) => {
    if (!category) return;
    setForm((f) => ({ ...f, items: f.items.map((i) => (i.include ? { ...i, category } : i)) }));
  };

  const listById = useMemo(() => Object.fromEntries(shoppingList.map((s) => [s.id, s])), [shoppingList]);
  const linkedIds = new Set(form.items.map((i) => i.shoppingListItemId).filter(Boolean));
  const freeListItems = shoppingList.filter((s) => !linkedIds.has(s.id));
  const unmatchedBought = shoppingList.filter((s) => s.bought && !linkedIds.has(s.id));
  const linkedCount = form.items.filter((i) => i.shoppingListItemId && listById[i.shoppingListItemId]).length;
  const store = preview.store;
  const payments = preview.payments?.map((p) => (p.amount != null ? `${p.method} ${formatBRL(p.amount)}` : p.method)).join(" · ");

  return (
    <div className="space-y-4">
      {preview.possibleManualDuplicate && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="flex items-center gap-2 font-medium">
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ height: "0.875rem" }} />
            Parece que esta compra já foi registrada manualmente
          </p>
          <p className="mt-1 text-xs">
            “{preview.possibleManualDuplicate.store}” · {fmtDate(preview.possibleManualDuplicate.date)} · {formatBRL(preview.possibleManualDuplicate.total)} · {preview.possibleManualDuplicate.itemsCount} itens.{" "}
            Se for a mesma, cancele esta importação ou exclua a compra manual antes.{" "}
            <button type="button" className="font-medium underline" onClick={() => onViewPurchase(preview.possibleManualDuplicate.id)}>Ver compra</button>
          </p>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_11rem]">
          <Field label="Loja">
            <Input value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} />
          </Field>
          <Field label="Data">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-stone-500">
          <FontAwesomeIcon icon={faStore} style={{ height: "0.7rem" }} className="text-stone-400" />
          <span>CNPJ {store.cnpjFormatted}</span>
          {payments && <span>· {payments}</span>}
          <span>· NFC-e {preview.number}</span>
        </p>
        {store.remembered ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700">
            <FontAwesomeIcon icon={faCircleCheck} style={{ height: "0.7rem" }} /> Nome que você usou da última vez para esta loja
          </p>
        ) : (
          <p className="mt-1 text-xs text-stone-400">
            Na nota: {store.legalName}. O nome que você deixar aqui será usado nas próximas notas desta loja.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-stone-500">
          {form.items.length} {form.items.length === 1 ? "item" : "itens"}
          {shoppingList.length > 0 && <> · {linkedCount} vinculado{linkedCount === 1 ? "" : "s"} à lista</>}
        </p>
        <select
          value=""
          onChange={(e) => applyCategoryToAll(e.target.value)}
          aria-label="Aplicar categoria a todos os itens"
          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600 focus:border-stone-400 focus:outline-none"
        >
          <option value="">Categoria para todos…</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {form.items.map((item) => {
          const linked = item.shoppingListItemId ? listById[item.shoppingListItemId] : null;
          return (
            <NfceItemRow
              key={item.index}
              item={item}
              linkedListItem={linked}
              linkOptions={freeListItems}
              onChange={(patch) => setItem(item.index, patch)}
            />
          );
        })}
      </div>

      {unmatchedBought.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ height: "0.75rem" }} className="mt-0.5" />
          <span>
            Marcados como comprados, mas sem correspondência na nota: {unmatchedBought.map((s) => s.name).join(", ")}.
            Eles continuam na lista — vincule acima se algum estiver na nota com outro nome.
          </span>
        </p>
      )}

      <div className="space-y-1 rounded-xl border border-stone-200 px-4 py-3 text-sm">
        <div className="flex justify-between text-stone-500"><span>Itens na nota</span><span>{formatBRL(preview.itemsTotal)}</span></div>
        {preview.otherCharges > 0 && (
          <div className="flex justify-between text-stone-500"><span>Outros valores (entrega/taxas)</span><span>+ {formatBRL(preview.otherCharges)}</span></div>
        )}
        {preview.discount > 0 && (
          <div className="flex justify-between text-emerald-700"><span>Desconto</span><span>− {formatBRL(preview.discount)}</span></div>
        )}
        {(preview.discount > 0 || preview.otherCharges > 0) && (
          <p className="pt-1 text-xs text-stone-400">A diferença foi distribuída entre os itens, proporcionalmente ao valor de cada um.</p>
        )}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-stone-900 px-4 py-3 text-white">
        <span className="text-sm">Total pago</span>
        <span className="text-lg font-semibold">{formatBRL(preview.paid)}</span>
      </div>

      {members.length > 0 && (
        <MemberPaymentsInput
          members={members}
          payments={form.memberPayments}
          onChange={(p) => setForm({ ...form, memberPayments: p })}
          total={preview.paid}
        />
      )}
    </div>
  );
}
