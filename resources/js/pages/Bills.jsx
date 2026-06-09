import { useState, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPen, faTrash, faCheck, faReceipt, faWallet, faCalendar, faUsers } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../store/StoreContext.jsx";
import { useToast } from "../hooks/useToast.jsx";
import { useOpenNew } from "../hooks/useOpenNew.js";
import { BILL_CATEGORIES } from "../constants.js";
import { formatBRL } from "../utils/format.js";
import { fmtDate, daysUntil, currentMonthKey } from "../utils/date.js";
import { splitEqually } from "../utils/finance.js";
import { SectionHeader } from "../components/shared/SectionHeader.jsx";
import { Card, StatCard } from "../components/ui/Card.jsx";
import { Badge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Field, Input, Select, Textarea } from "../components/ui/Input.jsx";
import { Modal, ConfirmDialog } from "../components/ui/Modal.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";
import { SearchInput } from "../components/ui/SearchInput.jsx";

/** Bloco de entradas de pagamento por integrante. */
function MemberPaymentsInput({ members, payments, onChange, total }) {
  const paid = payments.reduce((s, p) => s + (+p.amount || 0), 0);
  const remaining = +(total - paid).toFixed(2);

  const setAmount = (memberId, value) =>
    onChange(payments.map((p) => (p.memberId === memberId ? { ...p, amount: value } : p)));

  const distributeEqually = () => {
    const each = +(total / members.length).toFixed(2);
    const base = payments.map((p, i) => ({ ...p, amount: i < payments.length - 1 ? each : +(total - each * (payments.length - 1)).toFixed(2) }));
    onChange(base);
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

function addMonthsToDate(dateStr, months) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const totalMonths = month - 1 + months;
  const y = year + Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

const PAYMENT_METHODS = ["PIX", "crédito", "débito", "dinheiro"];

export function Bills() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [openNew, clearOpen] = useOpenNew();
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [payModal, setPayModal] = useState(null); // { bill, payments[] }
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const blankBill = () => ({
    description: "", category: "Luz", amount: 0,
    dueDate: new Date().toISOString().slice(0, 10),
    status: "pendente", referenceMonth: currentMonthKey(), note: "",
    installments: 1, paymentMethod: "", paymentInstitution: "",
    memberPayments: initPayments(state.members),
  });

  useEffect(() => { if (openNew) { setModal(blankBill()); clearOpen(); } }, [openNew, clearOpen]);

  const displayStatus = (b) => (b.status !== "paga" && daysUntil(b.dueDate) < 0 ? "atrasada" : b.status);

  const periodBills = useMemo(() =>
    state.bills.filter((b) => {
      const bd = b.dueDate.slice(0, 10);
      return (!dateFrom || bd >= dateFrom) && (!dateTo || bd <= dateTo);
    }),
    [state.bills, dateFrom, dateTo]
  );

  const periodBillsTotal = useMemo(
    () => periodBills.reduce((s, b) => s + b.amount, 0),
    [periodBills]
  );

  const list = useMemo(() => periodBills.filter((b) => {
    if (!b.description.toLowerCase().includes(query.toLowerCase())) return false;
    if (statusFilter !== "all" && displayStatus(b) !== statusFilter) return false;
    return true;
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)), [periodBills, query, statusFilter]);

  const save = () => {
    if (!modal.description.trim()) return toast("Informe a descrição", "error");
    const payments = modal.status === "paga" ? modal.memberPayments : [];
    const totalPaid = payments.reduce((s, p) => s + (+p.amount || 0), 0);
    if (modal.status === "paga" && Math.abs(totalPaid - +modal.amount) > 0.01) {
      return toast("A soma dos pagamentos deve ser igual ao valor total", "error");
    }

    const basePayload = {
      category: modal.category,
      amount: +modal.amount,
      status: modal.status,
      note: modal.note,
      paymentMethod: modal.paymentMethod || "",
      paymentInstitution: modal.paymentInstitution || "",
      memberPayments: payments.map((p) => ({ memberId: p.memberId, amount: +p.amount || 0 })),
    };

    if (modal.id) {
      dispatch({
        type: "EDIT_BILL",
        payload: { ...basePayload, id: modal.id, description: modal.description, dueDate: new Date(modal.dueDate).toISOString(), referenceMonth: modal.referenceMonth },
      });
      toast("Conta atualizada");
    } else {
      const n = Math.max(1, +modal.installments || 1);
      if (n === 1) {
        dispatch({
          type: "ADD_BILL",
          payload: { ...basePayload, description: modal.description, dueDate: new Date(modal.dueDate).toISOString(), referenceMonth: modal.dueDate.slice(0, 7) },
        });
        toast("Conta adicionada");
      } else {
        const payloads = Array.from({ length: n }, (_, i) => {
          const dueDateStr = addMonthsToDate(modal.dueDate, i);
          return {
            ...basePayload,
            description: `${modal.description} (${i + 1}/${n})`,
            dueDate: new Date(dueDateStr).toISOString(),
            referenceMonth: dueDateStr.slice(0, 7),
          };
        });
        dispatch({ type: "ADD_BILLS_BATCH", payloads });
        toast(`${n} parcelas adicionadas`);
      }
    }
    setModal(null);
  };

  const openMarkPaid = (bill) => {
    setPayModal({
      bill,
      payments: bill.memberPayments?.length
        ? bill.memberPayments.map((mp) => ({ memberId: mp.memberId, amount: mp.amount }))
        : initPayments(state.members),
    });
  };

  const confirmMarkPaid = () => {
    const totalPaid = payModal.payments.reduce((s, p) => s + (+p.amount || 0), 0);
    if (Math.abs(totalPaid - payModal.bill.amount) > 0.01) {
      return toast("A soma dos pagamentos deve ser igual ao valor total", "error");
    }
    dispatch({
      type: "SET_BILL_STATUS",
      id: payModal.bill.id,
      status: "paga",
      memberPayments: payModal.payments.map((p) => ({ memberId: p.memberId, amount: +p.amount || 0 })),
    });
    toast("Conta marcada como paga");
    setPayModal(null);
  };

  const memberBillTotals = useMemo(() => {
    const totals = Object.fromEntries(state.members.map((m) => [m.id, 0]));
    periodBills.forEach((b) => {
      if (b.status === "paga" && b.memberPayments?.length) {
        b.memberPayments.forEach((mp) => { if (mp.memberId in totals) totals[mp.memberId] += mp.amount; });
      } else if (b.status === "paga") {
        state.members.forEach((m) => { totals[m.id] += b.amount / (state.members.length || 1); });
      }
    });
    return totals;
  }, [periodBills, state.members]);

  const billPeriodTotal = useMemo(() => Object.values(memberBillTotals).reduce((s, v) => s + v, 0), [memberBillTotals]);

  return (
    <div>
      <SectionHeader
        title="Contas da casa"
        subtitle="Despesas fixas e variáveis com rastreio de quem pagou"
        action={<Button onClick={() => setModal(blankBill())}><FontAwesomeIcon icon={faPlus} style={{ height: "1rem" }} /> Nova conta</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2">
        <FontAwesomeIcon icon={faCalendar} className="text-stone-400" style={{ height: "0.75rem" }} />
        <span className="text-xs text-stone-500">Período:</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border-none bg-transparent text-xs text-stone-700 outline-none" />
        <span className="text-xs text-stone-400">—</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border-none bg-transparent text-xs text-stone-700 outline-none" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={faReceipt}  label="Total do período" value={formatBRL(periodBillsTotal)} sub={`${periodBills.length} contas`} />
        <StatCard icon={faWallet}   label="Por morador"      value={formatBRL(splitEqually(periodBillsTotal, state.members.length))} />
        <StatCard icon={faCalendar} label="Pendentes"        value={periodBills.filter((b) => b.status !== "paga").length} accent="text-amber-600" />
      </div>

      {state.members.length > 0 && (
        <div className="mb-4 rounded-xl border border-stone-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faUsers} className="h-4 w-4 text-stone-400" style={{ height: "1rem" }} />
              <span className="text-xs font-semibold text-stone-600">Contas pagas por integrante (período selecionado)</span>
            </div>
            {billPeriodTotal > 0 && <span className="text-xs font-semibold text-stone-700">Total: {formatBRL(billPeriodTotal)}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {state.members.map((m) => {
              const pct = billPeriodTotal > 0 ? (memberBillTotals[m.id] / billPeriodTotal) * 100 : 0;
              return (
                <div key={m.id} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${m.color}`}>
                    {m.name[0]}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-stone-700">{m.name}</p>
                    <p className="text-sm font-semibold text-stone-900">{formatBRL(memberBillTotals[m.id] ?? 0)}</p>
                    {billPeriodTotal > 0 && <p className="text-xs text-stone-400">{pct.toFixed(0)}%</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar conta..." />
        <div className="flex gap-1 rounded-xl border border-stone-200 bg-white p-1">
          {[["all", "Todas"], ["pendente", "Pendentes"], ["paga", "Pagas"], ["atrasada", "Atrasadas"]].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${statusFilter === v ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"}`}>{l}</button>
          ))}
        </div>
      </div>

      {!list.length ? (
        <EmptyState
          icon={faReceipt}
          title="Nenhuma conta"
          message="Cadastre contas de água, luz, internet e outras despesas da casa."
          action={<Button onClick={() => setModal(blankBill())}><FontAwesomeIcon icon={faPlus} style={{ height: "1rem" }} /> Nova conta</Button>}
        />
      ) : (
        <div className="space-y-3">
          {list.map((b) => {
            const st = displayStatus(b);
            const du = daysUntil(b.dueDate);
            return (
              <Card key={b.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-stone-100 p-2.5">
                      <FontAwesomeIcon icon={faReceipt} className="h-5 w-5 text-stone-500" style={{ height: "1.25rem" }} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-stone-800">{b.description}</h3>
                        {st === "paga" ? <Badge tone="green">paga</Badge> : st === "atrasada" ? <Badge tone="red">atrasada</Badge> : du <= 3 ? <Badge tone="amber">vence em {du}d</Badge> : <Badge tone="neutral">pendente</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-stone-400">
                        {b.category} · vence {fmtDate(b.dueDate)}
                        {b.paymentMethod ? ` · ${b.paymentMethod}${b.paymentInstitution ? ` (${b.paymentInstitution})` : ""}` : ""}
                        {b.note ? ` · ${b.note}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-stone-900">{formatBRL(b.amount)}</p>
                    {b.memberPayments?.length > 0 ? (
                      <div className="mt-0.5 flex flex-wrap justify-end gap-1">
                        {b.memberPayments.map((mp) => {
                          const m = state.members.find((x) => x.id === mp.memberId);
                          return m ? (
                            <span key={mp.memberId} className="text-xs text-stone-400">
                              {m.name}: {formatBRL(mp.amount)}
                            </span>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400">{formatBRL(splitEqually(b.amount, state.members.length))} / morador</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                  <div className="flex -space-x-1.5">
                    {state.members.map((m) => (
                      <span key={m.id} title={m.name} className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white ${m.color}`}>
                        {m.name[0]}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {b.status !== "paga"
                      ? <Button variant="subtle" size="sm" onClick={() => openMarkPaid(b)}>
                          <FontAwesomeIcon icon={faCheck} style={{ height: "0.875rem" }} /> Marcar paga
                        </Button>
                      : <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "SET_BILL_STATUS", id: b.id, status: "pendente" })}>Reabrir</Button>}
                    <Button variant="ghost" size="icon" onClick={() => setModal({ ...b, dueDate: b.dueDate.slice(0, 10), paymentMethod: b.paymentMethod ?? "", paymentInstitution: b.paymentInstitution ?? "", memberPayments: b.memberPayments?.length ? b.memberPayments.map((mp) => ({ memberId: mp.memberId, amount: mp.amount })) : initPayments(state.members) })} aria-label="Editar">
                      <FontAwesomeIcon icon={faPen} style={{ height: "1rem" }} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirm(b)} aria-label="Remover">
                      <FontAwesomeIcon icon={faTrash} style={{ height: "1rem" }} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal nova / editar conta */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? "Editar conta" : "Nova conta"}
        footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}
      >
        {modal && (
          <div className="space-y-4">
            <Field label="Descrição"><Input value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} placeholder="Ex.: Conta de luz" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria"><Select value={modal.category} onChange={(e) => setModal({ ...modal, category: e.target.value })}>{BILL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Valor (R$)"><Input type="number" min="0" step="0.01" value={modal.amount} onChange={(e) => setModal({ ...modal, amount: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vencimento"><Input type="date" value={modal.dueDate} onChange={(e) => setModal({ ...modal, dueDate: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={modal.status} onChange={(e) => setModal({ ...modal, status: e.target.value })}>
                  <option value="pendente">Pendente</option>
                  <option value="paga">Paga</option>
                </Select>
              </Field>
            </div>
            {!modal.id && (
              <Field label="Parcelas">
                <Input type="number" min="1" step="1" value={modal.installments} onChange={(e) => setModal({ ...modal, installments: e.target.value })} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Forma de pagamento (opcional)">
                <Select value={modal.paymentMethod} onChange={(e) => setModal({ ...modal, paymentMethod: e.target.value })}>
                  <option value="">—</option>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </Select>
              </Field>
              <Field label="Cartão / instituição (opcional)">
                <Input value={modal.paymentInstitution} onChange={(e) => setModal({ ...modal, paymentInstitution: e.target.value })} placeholder="Ex.: Nubank" />
              </Field>
            </div>
            <Field label="Observação (opcional)"><Textarea rows={2} value={modal.note} onChange={(e) => setModal({ ...modal, note: e.target.value })} /></Field>
            {modal.status === "paga" && state.members.length > 0 && (
              <MemberPaymentsInput
                members={state.members}
                payments={modal.memberPayments}
                onChange={(p) => setModal({ ...modal, memberPayments: p })}
                total={+modal.amount || 0}
              />
            )}
            {modal.status !== "paga" && (
              <p className="rounded-xl bg-stone-50 px-3 py-2 text-center text-xs text-stone-500">
                Dividido entre {state.members.length} = {formatBRL(splitEqually(+modal.amount || 0, state.members.length))} por morador
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Modal marcar como paga */}
      <Modal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title="Registrar pagamento"
        footer={<><Button variant="outline" onClick={() => setPayModal(null)}>Cancelar</Button><Button onClick={confirmMarkPaid}>Confirmar pagamento</Button></>}
      >
        {payModal && (
          <div className="space-y-4">
            <div className="rounded-xl bg-stone-900 px-4 py-3 text-white">
              <p className="text-xs text-stone-400">{payModal.bill.description}</p>
              <p className="text-lg font-semibold">{formatBRL(payModal.bill.amount)}</p>
            </div>
            <MemberPaymentsInput
              members={state.members}
              payments={payModal.payments}
              onChange={(p) => setPayModal({ ...payModal, payments: p })}
              total={payModal.bill.amount}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Excluir conta"
        message={`Excluir "${confirm?.description}"?`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { dispatch({ type: "REMOVE_BILL", id: confirm.id }); toast("Conta excluída"); setConfirm(null); }}
      />
    </div>
  );
}
