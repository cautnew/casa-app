import { useState, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faMinus, faPen, faTrash, faBox, faClipboardList } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useOpenNew } from "../hooks/useOpenNew.js";
import { CATEGORIES, UNITS } from "../constants.js";
import { formatBRL } from "../utils/format.js";
import { priceTrend, stockStatus } from "../utils/finance.js";
import { SectionHeader } from "../components/shared/SectionHeader.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Badge, StockBadge, TrendBadge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Field, Input, Select } from "../components/ui/Input.jsx";
import { Modal, ConfirmDialog } from "../components/ui/Modal.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { SearchInput } from "../components/ui/SearchInput.jsx";

export function Inventory() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [openNew, clearOpen] = useOpenNew();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Todas");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const blankItem = () => ({ name: "", category: "Alimentos", quantity: 0, unit: "un", minStock: 1 });
  useEffect(() => { if (openNew) { setModal(blankItem()); clearOpen(); } }, [openNew, clearOpen]);

  const list = useMemo(() => state.inventory.filter((i) => {
    if (!i.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (cat !== "Todas" && i.category !== cat) return false;
    if (filter === "low" && stockStatus(i) === "normal") return false;
    if (filter === "next" && !i.inNextList) return false;
    return true;
  }), [state.inventory, query, cat, filter]);

  const save = () => {
    if (!modal.name?.trim()) return toast("Informe o nome", "error");
    if (modal.id) {
      dispatch({ type: "EDIT_INVENTORY", payload: { ...modal, quantity: +modal.quantity, minStock: +modal.minStock } });
      toast("Item atualizado");
    } else {
      dispatch({
        type: "ADD_PURCHASE",
        payload: {
          date: new Date().toISOString(),
          store: "Cadastro manual",
          note: "Item adicionado manualmente",
          items: [{ name: modal.name.trim(), category: modal.category, quantity: +modal.quantity || 0, unit: modal.unit, unitPrice: 0 }],
        },
      });
      toast("Item adicionado ao inventário");
    }
    setModal(null);
  };

  return (
    <div>
      <SectionHeader
        title="Itens em casa"
        subtitle="Inventário com estoque, status e histórico de preços"
        action={<Button onClick={() => setModal(blankItem())}><FontAwesomeIcon icon={faPlus} style={{ height: "1rem" }} /> Adicionar item</Button>}
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar item..." />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="lg:w-40">
          <option>Todas</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <div className="flex gap-1 rounded-xl border border-stone-200 bg-white p-1">
          {[["all", "Todos"], ["low", "Estoque baixo"], ["next", "Próx. compra"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === v ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"}`}>{l}</button>
          ))}
        </div>
      </div>

      {!list.length ? (
        <EmptyState icon={faBox} title="Nenhum item" message="Registre compras ou adicione itens manualmente para montar o inventário." />
      ) : (
        <Card className="divide-y divide-stone-100">
          {list.map((i) => {
            const t = priceTrend(i.priceHistory);
            return (
              <div key={i.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-stone-800">{i.name}</p>
                    {i.inNextList && <Badge tone="blue">na lista</Badge>}
                  </div>
                  <p className="text-xs text-stone-400">{i.category} · últ. {formatBRL(i.lastPrice)} · média {formatBRL(i.avgPrice)}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" onClick={() => dispatch({ type: "UPDATE_INVENTORY_QTY", id: i.id, quantity: i.quantity - 1 })} aria-label="Diminuir">
                    <FontAwesomeIcon icon={faMinus} style={{ height: "0.875rem" }} />
                  </Button>
                  <span className="w-16 text-center text-sm font-medium text-stone-700">{i.quantity} {i.unit}</span>
                  <Button variant="outline" size="icon" onClick={() => dispatch({ type: "UPDATE_INVENTORY_QTY", id: i.id, quantity: i.quantity + 1 })} aria-label="Aumentar">
                    <FontAwesomeIcon icon={faPlus} style={{ height: "0.875rem" }} />
                  </Button>
                </div>

                <div className="w-28"><StockBadge item={i} /></div>
                <div className="w-24">{t.prev !== null ? <TrendBadge history={i.priceHistory} /> : <span className="text-xs text-stone-300">—</span>}</div>

                <div className="flex gap-1">
                  <Button variant={i.inNextList ? "subtle" : "ghost"} size="sm" onClick={() => { dispatch({ type: "TOGGLE_NEXT_LIST", id: i.id }); toast(i.inNextList ? "Removido da lista" : "Adicionado à próxima compra"); }}>
                    <FontAwesomeIcon icon={faClipboardList} style={{ height: "0.875rem" }} /> {i.inNextList ? "Na lista" : "Próx. compra"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setModal({ ...i })} aria-label="Editar">
                    <FontAwesomeIcon icon={faPen} style={{ height: "1rem" }} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setConfirm(i)} aria-label="Remover">
                    <FontAwesomeIcon icon={faTrash} style={{ height: "1rem" }} />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? "Editar item" : "Novo item"}
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}
      >
        {modal && (
          <div className="space-y-4">
            <Field label="Nome"><Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="Ex.: Arroz" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria"><Select value={modal.category} onChange={(e) => setModal({ ...modal, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Unidade"><Select value={modal.unit} onChange={(e) => setModal({ ...modal, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade atual"><Input type="number" min="0" value={modal.quantity} onChange={(e) => setModal({ ...modal, quantity: e.target.value })} /></Field>
              <Field label="Estoque mínimo"><Input type="number" min="0" value={modal.minStock} onChange={(e) => setModal({ ...modal, minStock: e.target.value })} /></Field>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Remover item"
        message={`Remover ${confirm?.name} do inventário?`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { dispatch({ type: "REMOVE_INVENTORY", id: confirm.id }); toast("Item removido"); setConfirm(null); }}
      />
    </div>
  );
}
