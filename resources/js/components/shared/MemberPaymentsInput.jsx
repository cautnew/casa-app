import { formatBRL } from "../../utils/format.js";
import { Input } from "../ui/Input.jsx";

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
