import { useState, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faCartShopping, faUsers, faCalendar, faPencil } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useOpenNew } from "../hooks/useOpenNew.js";
import { CATEGORIES, UNITS } from "../constants.js";
import { formatBRL } from "../utils/format.js";
import { fmtDate } from "../utils/date.js";
import { splitEqually } from "../utils/finance.js";
import { SectionHeader } from "../components/shared/SectionHeader.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Badge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Field, Input, Select, inputCls } from "../components/ui/Input.jsx";
import { Modal, ConfirmDialog } from "../components/ui/Modal.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { SearchInput } from "../components/ui/SearchInput.jsx";

const emptyItem = () => ({ name: "", category: "Alimentos", quantity: 1, unit: "un", unitPrice: 0, totalPrice: 0 });

/** Bloco reutilizável de entrada de pagamento por integrante. */
export function MemberPaymentsInput({ members, payments, onChange, total }) {
  const paid = payments.reduce((s, p) => s + (+p.amount || 0), 0);
  const remaining = +(total - paid).toFixed(2);

  const setAmount = (memberId, value) =>
    onChange(payments.map((p) => (p.memberId === memberId ? { ...p, amount: value } : p)));

  const distributeEqually = () => {
    const each = +(total / members.length).toFixed(2);
    onChange(payments.map((p, i) => ({
      ...p,
      amount: i < payments.length - 1 ? each : +(total - each * (payments.length - 1)).toFixed(2),
    })));
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-stone-600">Quanto cada um pagou</span>
        <button type="button" onClick={distributeEqually} className="text-xs text-stone-400 underline hover:text-stone-700">
          dividir igualmente
        </button>
      </div>
      <div className="space-y-2">
        {payments.map((p) => {
          const member = members.find((m) => m.id === p.memberId);
          return (
            <div key={p.memberId} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${member?.color ?? "bg-stone-400"}`}>
                {member?.name[0] ?? "?"}
              </span>
              <span className="w-20 truncate text-sm text-stone-700">{member?.name}</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="flex-1"
                placeholder="0,00"
                value={p.amount}
                onChange={(e) => setAmount(p.memberId, e.target.value)}
              />
            </div>
          );
        })}
      </div>
      <div className={`mt-2 text-right text-xs ${Math.abs(remaining) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}>
        {Math.abs(remaining) < 0.01
          ? "Total conferido ✓"
          : remaining > 0
            ? `Faltam ${formatBRL(remaining)} para completar`
            : `Excedido em ${formatBRL(-remaining)}`}
      </div>
    </div>
  );
}

function initPayments(members) {
  return members.map((m) => ({ memberId: m.id, amount: "" }));
}

export function Purchases() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [openNew, clearOpen] = useOpenNew();
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    store: "", note: "",
    items: [emptyItem()],
    memberPayments: [],
  });

  useEffect(() => {
    if (openNew) { setModal(true); clearOpen(); }
  }, [openNew, clearOpen]);

  // Reinicializa payments apenas ao abrir nova compra (não na edição)
  useEffect(() => {
    if (modal && !editTarget) {
      setForm((f) => ({ ...f, memberPayments: initPayments(state.members) }));
    }
  }, [modal, state.members.length, editTarget]);

  const total = form.items.reduce((s, i) => s + (i.quantity * i.unitPrice || 0), 0);

  const list = useMemo(() => {
    const q = query.toLowerCase();
    let r = state.purchases.filter((p) => {
      if (!p.store.toLowerCase().includes(q) && !p.items.some((i) => i.name.toLowerCase().includes(q))) return false;
      const pd = p.date.slice(0, 10);
      if (dateFrom && pd < dateFrom) return false;
      if (dateTo && pd > dateTo) return false;
      return true;
    });
    r = [...r].sort((a, b) =>
      sort === "date" ? new Date(b.date) - new Date(a.date)
        : sort === "value" ? b.total - a.total
          : a.store.localeCompare(b.store));
    return r;
  }, [state.purchases, query, sort, dateFrom, dateTo]);

  const memberPurchaseTotals = useMemo(() => {
    const totals = Object.fromEntries(state.members.map((m) => [m.id, 0]));
    state.purchases
      .filter((p) => { const pd = p.date.slice(0, 10); return (!dateFrom || pd >= dateFrom) && (!dateTo || pd <= dateTo); })
      .forEach((p) => {
        if (p.memberPayments?.length) {
          p.memberPayments.forEach((mp) => { if (mp.memberId in totals) totals[mp.memberId] += mp.amount; });
        } else {
          const each = p.total / (state.members.length || 1);
          state.members.forEach((m) => { totals[m.id] += each; });
        }
      });
    return totals;
  }, [state.purchases, state.members, dateFrom, dateTo]);

  const purchasePeriodTotal = useMemo(() => Object.values(memberPurchaseTotals).reduce((s, v) => s + v, 0), [memberPurchaseTotals]);

  const topItems = useMemo(() => {
    const map = {};
    state.purchases
      .filter((p) => { const pd = p.date.slice(0, 10); return (!dateFrom || pd >= dateFrom) && (!dateTo || pd <= dateTo); })
      .forEach((p) =>
        (p.items ?? []).forEach((item) => {
          const key = item.name.toLowerCase().trim();
          if (!map[key] || item.unitPrice > map[key].unitPrice) {
            map[key] = { name: item.name, category: item.category ?? "Outros", unitPrice: item.unitPrice ?? 0, store: p.store };
          }
        }),
      );
    return Object.values(map).sort((a, b) => b.unitPrice - a.unitPrice).slice(0, 8);
  }, [state.purchases, dateFrom, dateTo]);

  const closeModal = () => {
    setModal(false);
    setEditTarget(null);
    setForm({ date: new Date().toISOString().slice(0, 10), store: "", note: "", items: [emptyItem()], memberPayments: initPayments(state.members) });
  };

  const openEdit = (p) => {
    setForm({
      date: p.date.slice(0, 10),
      store: p.store,
      note: p.note ?? "",
      items: p.items.map((it) => ({
        name: it.name,
        category: it.category,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
      })),
      memberPayments: p.memberPayments?.length
        ? p.memberPayments.map((mp) => ({ memberId: mp.memberId, amount: mp.amount }))
        : initPayments(state.members),
    });
    setEditTarget(p);
    setModal(true);
  };

  const save = () => {
    const items = form.items.filter((i) => i.name.trim() && i.quantity > 0);
    if (!form.store.trim()) return toast("Informe o mercado/loja", "error");
    if (!items.length) return toast("Adicione ao menos um item", "error");
    const totalPaid = form.memberPayments.reduce((s, p) => s + (+p.amount || 0), 0);
    if (state.members.length > 0 && Math.abs(totalPaid - total) > 0.01) {
      return toast("A soma dos pagamentos deve ser igual ao total da compra", "error");
    }
    const payload = {
      date: new Date(form.date).toISOString(),
      store: form.store.trim(),
      note: form.note.trim(),
      items: items.map((i) => ({ ...i, quantity: +i.quantity, unitPrice: +i.unitPrice })),
      memberPayments: form.memberPayments.map((p) => ({ memberId: p.memberId, amount: +p.amount || 0 })),
    };
    if (editTarget) {
      dispatch({ type: "EDIT_PURCHASE", payload: { ...payload, id: editTarget.id } });
      toast("Compra atualizada");
    } else {
      dispatch({ type: "ADD_PURCHASE", payload });
      toast("Compra registrada e estoque atualizado");
    }
    closeModal();
  };

  const setItem = (idx, patch) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => {
        if (i !== idx) return it;
        const u = { ...it, ...patch };
        if ("unitPrice" in patch) {
          u.totalPrice = +(+u.unitPrice * +u.quantity).toFixed(4);
        } else if ("totalPrice" in patch) {
          u.unitPrice = +u.quantity > 0 ? +(+u.totalPrice / +u.quantity).toFixed(4) : 0;
        } else if ("quantity" in patch) {
          u.totalPrice = +(+u.unitPrice * +u.quantity).toFixed(4);
        }
        return u;
      }),
    }));

  return (
    <div>
      <SectionHeader
        title="Compras"
        subtitle="Registre compras e mantenha o estoque atualizado"
        action={<Button onClick={() => setModal(true)}><FontAwesomeIcon icon={faPlus} style={{ height: "1rem" }} /> Nova compra</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2">
        <FontAwesomeIcon icon={faCalendar} className="text-stone-400" style={{ height: "0.75rem" }} />
        <span className="text-xs text-stone-500">Período:</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border-none bg-transparent text-xs text-stone-700 outline-none" />
        <span className="text-xs text-stone-400">—</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border-none bg-transparent text-xs text-stone-700 outline-none" />
      </div>

      {state.members.length > 0 && state.purchases.length > 0 && (
        <div className="mb-4 rounded-xl border border-stone-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faUsers} className="h-4 w-4 text-stone-400" style={{ height: "1rem" }} />
              <span className="text-xs font-semibold text-stone-600">Total pago por integrante (período selecionado)</span>
            </div>
            {purchasePeriodTotal > 0 && <span className="text-xs font-semibold text-stone-700">Total: {formatBRL(purchasePeriodTotal)}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {state.members.map((m) => {
              const pct = purchasePeriodTotal > 0 ? (memberPurchaseTotals[m.id] / purchasePeriodTotal) * 100 : 0;
              return (
                <div key={m.id} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${m.color}`}>
                    {m.name[0]}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-stone-700">{m.name}</p>
                    <p className="text-sm font-semibold text-stone-900">{formatBRL(memberPurchaseTotals[m.id] ?? 0)}</p>
                    {purchasePeriodTotal > 0 && <p className="text-xs text-stone-400">{pct.toFixed(0)}%</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {topItems.length > 0 && (
        <div className="mb-4 rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold text-stone-600">Itens mais caros (período selecionado)</h3>
          <div className="divide-y divide-stone-100">
            {topItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2">
                <span className="w-4 shrink-0 text-center text-xs font-semibold text-stone-300">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-700">{item.name}</p>
                  <p className="text-xs text-stone-400">{item.category}{item.store ? ` · ${item.store}` : ""}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-stone-900">{formatBRL(item.unitPrice)}</p>
                  <p className="text-xs text-stone-400">por unidade</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por loja ou item..." />
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="sm:w-44">
          <option value="date">Mais recentes</option>
          <option value="value">Maior valor</option>
          <option value="store">Loja (A-Z)</option>
        </Select>
      </div>

      {!list.length ? (
        <EmptyState
          icon={faCartShopping}
          title="Nenhuma compra encontrada"
          message="Registre sua primeira compra para alimentar o inventário e o histórico de preços."
          action={<Button onClick={() => setModal(true)}><FontAwesomeIcon icon={faPlus} style={{ height: "1rem" }} /> Nova compra</Button>}
        />
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-stone-800">{p.store}</h3>
                    <Badge tone="neutral">{p.items.length} itens</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-400">{fmtDate(p.date)}{p.note ? ` · ${p.note}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-stone-900">{formatBRL(p.total)}</p>
                  {p.memberPayments?.length > 0 ? (
                    <div className="mt-0.5 flex flex-wrap justify-end gap-x-2 gap-y-0.5">
                      {p.memberPayments.map((mp) => {
                        const m = state.members.find((x) => x.id === mp.memberId);
                        return m ? (
                          <span key={mp.memberId} className="text-xs text-stone-400">{m.name}: {formatBRL(mp.amount)}</span>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400">{formatBRL(p.perMember)} / morador</p>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {p.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm">
                    <span className="text-stone-600">{it.name} <span className="text-stone-400">· {it.quantity}{it.unit}</span></span>
                    <span className="font-medium text-stone-700">{formatBRL(it.totalPrice)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                  <FontAwesomeIcon icon={faPencil} style={{ height: "0.875rem" }} /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirm(p)}>
                  <FontAwesomeIcon icon={faTrash} style={{ height: "0.875rem" }} /> Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modal}
        onClose={closeModal}
        title={editTarget ? "Editar compra" : "Nova compra"}
        wide
        footer={<><Button variant="outline" onClick={closeModal}>Cancelar</Button><Button onClick={save}>{editTarget ? "Salvar alterações" : "Salvar compra"}</Button></>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Data"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Mercado / loja"><Input value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} placeholder="Ex.: Carrefour" /></Field>
          </div>
          <Field label="Observação (opcional)"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex.: compra do mês" /></Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Itens</span>
              <Button variant="subtle" size="sm" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}>
                <FontAwesomeIcon icon={faPlus} style={{ height: "0.875rem" }} /> Item
              </Button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div key={idx} className="rounded-xl border border-stone-200 p-3">
                  <div className="grid grid-cols-12 gap-2">
                    <input className={`${inputCls} col-span-12 sm:col-span-5`} placeholder="Nome do item" value={it.name} onChange={(e) => setItem(idx, { name: e.target.value })} />
                    <select className={`${inputCls} col-span-6 sm:col-span-4`} value={it.category} onChange={(e) => setItem(idx, { category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <button
                      className="col-span-6 flex items-center justify-center gap-1 rounded-xl text-rose-500 hover:bg-rose-50 sm:col-span-3"
                      onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                      aria-label="Remover item"
                    >
                      <FontAwesomeIcon icon={faTrash} style={{ height: "1rem" }} /> <span className="text-xs">remover</span>
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-12 gap-2">
                    <div className="col-span-3">
                      <label className="mb-0.5 block text-xs text-stone-400">Qtd</label>
                      <input type="number" min="0" step="0.001" className={`${inputCls} w-full`} value={it.quantity} onChange={(e) => setItem(idx, { quantity: e.target.value })} />
                    </div>
                    <div className="col-span-3">
                      <label className="mb-0.5 block text-xs text-stone-400">Unidade</label>
                      <select className={`${inputCls} w-full`} value={it.unit} onChange={(e) => setItem(idx, { unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
                    </div>
                    <div className="col-span-3">
                      <label className="mb-0.5 block text-xs text-stone-400">Preço un.</label>
                      <input type="number" min="0" step="0.0001" className={`${inputCls} w-full`} value={it.unitPrice} onChange={(e) => setItem(idx, { unitPrice: e.target.value })} />
                    </div>
                    <div className="col-span-3">
                      <label className="mb-0.5 block text-xs text-stone-400">Total item</label>
                      <input type="number" min="0" step="0.0001" className={`${inputCls} w-full`} value={it.totalPrice ?? ""} onChange={(e) => setItem(idx, { totalPrice: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-stone-900 px-4 py-3 text-white">
            <span className="text-sm">Total da compra</span>
            <span className="text-lg font-semibold">{formatBRL(total)}</span>
          </div>

          {state.members.length > 0 && (
            <MemberPaymentsInput
              members={state.members}
              payments={form.memberPayments}
              onChange={(p) => setForm({ ...form, memberPayments: p })}
              total={total}
            />
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Excluir compra"
        message={`Excluir a compra de ${confirm?.store}? Esta ação não pode ser desfeita.`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { dispatch({ type: "REMOVE_PURCHASE", id: confirm.id }); toast("Compra excluída"); setConfirm(null); }}
      />
    </div>
  );
}
