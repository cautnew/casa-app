import { useMemo } from "react";
import { useStore } from "../store/StoreContext.jsx";
import { currentMonthKey, monthKey, daysUntil } from "../utils/date.js";
import { stockStatus } from "../utils/finance.js";

/** Seletores derivados do estado (totais do mês, rateio, estoque baixo, etc.). */
export function useDerived() {
  const { state } = useStore();
  return useMemo(() => {
    const cm = currentMonthKey();
    const monthPurchases = state.purchases.filter((p) => monthKey(p.date) === cm);
    const monthBills = state.bills.filter((b) => b.referenceMonth === cm);
    const totalPurchases = monthPurchases.reduce((s, p) => s + p.total, 0);
    const totalBills = monthBills.reduce((s, b) => s + b.amount, 0);
    const memberCount = state.members.length || 1;
    const perMember = (totalPurchases + totalBills) / memberCount;
    const lowStock = state.inventory.filter((i) => stockStatus(i) !== "normal");
    const upcomingBills = state.bills
      .filter((b) => b.status !== "paga")
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    // Gastos reais por integrante: soma dos memberPayments registrados.
    // Fallback para rateio igual quando não há pagamentos individuais.
    const memberSpending = Object.fromEntries(state.members.map((m) => [m.id, 0]));

    monthPurchases.forEach((p) => {
      if (p.memberPayments && p.memberPayments.length > 0) {
        p.memberPayments.forEach((mp) => {
          if (mp.memberId in memberSpending) memberSpending[mp.memberId] += mp.amount;
        });
      } else {
        state.members.forEach((m) => { memberSpending[m.id] += p.total / memberCount; });
      }
    });

    monthBills.filter((b) => b.status === "paga").forEach((b) => {
      if (b.memberPayments && b.memberPayments.length > 0) {
        b.memberPayments.forEach((mp) => {
          if (mp.memberId in memberSpending) memberSpending[mp.memberId] += mp.amount;
        });
      } else {
        state.members.forEach((m) => { memberSpending[m.id] += b.amount / memberCount; });
      }
    });

    return {
      cm, monthPurchases, monthBills, totalPurchases, totalBills,
      perMember, lowStock, upcomingBills, memberCount, memberSpending,
    };
  }, [state]);
}
