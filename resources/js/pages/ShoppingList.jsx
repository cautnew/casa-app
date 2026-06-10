import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faCheck, faXmark, faClipboardList, faPencil } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { CATEGORIES, UNITS } from "../constants.js";
import { formatBRL } from "../utils/format.js";
import { SectionHeader } from "../components/shared/SectionHeader.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Field, Input, Select } from "../components/ui/Input.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { MemberPaymentsInput } from "./Purchases.jsx";

export function ShoppingList() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Alimentos", desiredQty: 1, unit: "un" });
  const [finalize, setFinalize] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("");

  const filtered = categoryFilter
    ? state.shoppingList.filter((s) => s.category === categoryFilter)
    : state.shoppingList;
  const bought = filtered.filter((s) => s.bought);
  const pending = filtered.filter((s) => !s.bought);

  const add = () => {
    if (!form.name.trim()) return toast("Informe o nome", "error");
    dispatch({ type: "ADD_SHOPPING_ITEM", payload: { ...form, desiredQty: +form.desiredQty } });
    setForm({ name: "", category: "Alimentos", desiredQty: 1, unit: "un" });
    setAdding(false);
    toast("Item adicionado à lista");
  };

  const openFinalize = () => {
    if (!bought.length) return toast("Marque itens como comprados primeiro", "error");
    setFinalize({
      store: "",
      date: new Date().toISOString().slice(0, 10),
      prices: Object.fromEntries(bought.map((b) => [b.id, ""])),
      totals: Object.fromEntries(bought.map((b) => [b.id, ""])),
      memberPayments: state.members.map((m) => ({ memberId: m.id, amount: "" })),
    });
  };

  const setItemPrice = (id, field, value) => {
    const qty = +bought.find((b) => b.id === id)?.desiredQty || 1;
    setFinalize((f) => {
      const prices = { ...f.prices };
      const totals = { ...f.totals };
      if (field === "unit") {
        prices[id] = value;
        totals[id] = value !== "" ? +(+value * qty).toFixed(4) : "";
      } else {
        totals[id] = value;
        prices[id] = value !== "" && qty > 0 ? +(+value / qty).toFixed(4) : "";
      }
      return { ...f, prices, totals };
    });
  };

  const finalizeTotal = finalize
    ? bought.reduce((s, b) => s + (b.desiredQty * (+finalize.prices[b.id] || 0)), 0)
    : 0;

  const doFinalize = () => {
    if (!finalize.store.trim()) return toast("Informe a loja", "error");
    const totalPaid = finalize.memberPayments.reduce((s, p) => s + (+p.amount || 0), 0);
    if (state.members.length > 0 && Math.abs(totalPaid - finalizeTotal) > 0.01) {
      return toast("A soma dos pagamentos deve ser igual ao total da compra", "error");
    }
    const items = bought.map((b) => ({ ...b, quantity: b.desiredQty, unitPrice: +finalize.prices[b.id] || 0 }));
    dispatch({
      type: "FINALIZE_SHOPPING",
      store: finalize.store.trim(),
      date: new Date(finalize.date).toISOString(),
      items,
      memberPayments: finalize.memberPayments.map((p) => ({ memberId: p.memberId, amount: +p.amount || 0 })),
    });
    toast("Compra finalizada e registrada");
    setFinalize(null);
  };

  return (
    <div>
      <SectionHeader
        title="Próxima lista de compras"
        subtitle="Itens marcados e adições manuais"
        action={
          <div className="flex gap-2">
            <div className="w-44">
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Todas as categorias</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </div>
            <Button variant="outline" onClick={() => setAdding(true)}>
              <FontAwesomeIcon icon={faPlus} style={{ height: "1rem" }} /> Item
            </Button>
            <Button onClick={openFinalize}>
              <FontAwesomeIcon icon={faCheck} style={{ height: "1rem" }} /> Finalizar compra
            </Button>
          </div>
        }
      />

      {!state.shoppingList.length ? (
        <EmptyState icon={faClipboardList} title="Lista vazia" message="Adicione itens manualmente ou envie itens com estoque baixo a partir do inventário." />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card className="p-2">
            <p className="px-3 py-2 text-xs font-semibold text-stone-500">A comprar ({pending.length})</p>
            <div className="space-y-1">
              {pending.map((s) => <ShoppingRow key={s.id} item={s} dispatch={dispatch} />)}
              {!pending.length && <p className="px-3 py-6 text-center text-xs text-stone-400">Tudo marcado!</p>}
            </div>
          </Card>
          <Card className="p-2">
            <p className="px-3 py-2 text-xs font-semibold text-stone-500">Comprados ({bought.length})</p>
            <div className="space-y-1">
              {bought.map((s) => <ShoppingRow key={s.id} item={s} dispatch={dispatch} done />)}
              {!bought.length && <p className="px-3 py-6 text-center text-xs text-stone-400">Nenhum item marcado ainda.</p>}
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Adicionar à lista"
        footer={<><Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button><Button onClick={add}>Adicionar</Button></>}
      >
        <div className="space-y-4">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Ovos" autoFocus /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Qtd"><Input type="number" min="1" value={form.desiredQty} onChange={(e) => setForm({ ...form, desiredQty: e.target.value })} /></Field>
            <Field label="Unidade"><Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
            <Field label="Categoria"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!finalize}
        onClose={() => setFinalize(null)}
        title="Finalizar compra"
        wide
        footer={<><Button variant="outline" onClick={() => setFinalize(null)}>Cancelar</Button><Button onClick={doFinalize}>Registrar compra</Button></>}
      >
        {finalize && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Loja"><Input value={finalize.store} onChange={(e) => setFinalize({ ...finalize, store: e.target.value })} placeholder="Ex.: Atacadão" /></Field>
              <Field label="Data"><Input type="date" value={finalize.date} onChange={(e) => setFinalize({ ...finalize, date: e.target.value })} /></Field>
            </div>
            <div className="space-y-2">
              {bought.map((b) => (
                <div key={b.id} className="rounded-xl border border-stone-200 p-3">
                  <p className="mb-2 text-sm text-stone-700">{b.name} <span className="text-stone-400">· {b.desiredQty} {b.unit}</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-xs text-stone-400">Preço un.</label>
                      <Input type="number" min="0" step="0.0001"
                        value={finalize.prices[b.id]}
                        onChange={(e) => setItemPrice(b.id, "unit", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs text-stone-400">Total item</label>
                      <Input type="number" min="0" step="0.0001"
                        value={finalize.totals[b.id]}
                        onChange={(e) => setItemPrice(b.id, "total", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-stone-900 px-4 py-3 text-white">
              <span className="text-sm">Total da compra</span>
              <span className="text-lg font-semibold">{formatBRL(finalizeTotal)}</span>
            </div>
            {state.members.length > 0 && (
              <MemberPaymentsInput
                members={state.members}
                payments={finalize.memberPayments}
                onChange={(p) => setFinalize({ ...finalize, memberPayments: p })}
                total={finalizeTotal}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ShoppingRow({ item, dispatch, done }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(item.desiredQty));
  const [unit, setUnit] = useState(item.unit);

  useEffect(() => {
    if (!editing) {
      setQty(String(item.desiredQty));
      setUnit(item.unit);
    }
  }, [item.desiredQty, item.unit, editing]);

  const save = () => {
    const q = +qty;
    if (!q || q <= 0) return;
    dispatch({ type: "EDIT_SHOPPING_ITEM", payload: { id: item.id, desiredQty: q, unit } });
    setEditing(false);
  };

  const cancel = () => {
    setQty(String(item.desiredQty));
    setUnit(item.unit);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-xl bg-stone-50 px-3 py-2.5">
        <p className="mb-2 text-sm font-medium text-stone-700">{item.name}</p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-0.5 block text-xs text-stone-400">Qtd</label>
            <Input type="number" min="0.001" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
          </div>
          <div className="flex-1">
            <label className="mb-0.5 block text-xs text-stone-400">Unidade</label>
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </Select>
          </div>
          <Button variant="ghost" size="icon" onClick={save} aria-label="Salvar">
            <FontAwesomeIcon icon={faCheck} style={{ height: "0.875rem" }} />
          </Button>
          <Button variant="ghost" size="icon" onClick={cancel} aria-label="Cancelar">
            <FontAwesomeIcon icon={faXmark} style={{ height: "0.875rem" }} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-stone-50">
      <button
        onClick={() => dispatch({ type: "TOGGLE_BOUGHT", id: item.id })}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${done ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300"}`}
        aria-label="Marcar comprado"
      >
        {done && <FontAwesomeIcon icon={faCheck} style={{ height: "0.875rem" }} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? "text-stone-400 line-through" : "text-stone-700"}`}>{item.name}</p>
        <p className="text-xs text-stone-400">{item.desiredQty} {item.unit} · {item.category}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Editar">
        <FontAwesomeIcon icon={faPencil} style={{ height: "0.875rem" }} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => dispatch({ type: "REMOVE_SHOPPING_ITEM", id: item.id })} aria-label="Remover">
        <FontAwesomeIcon icon={faXmark} style={{ height: "1rem" }} />
      </Button>
    </div>
  );
}
