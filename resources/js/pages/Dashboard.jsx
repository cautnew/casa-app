import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBasketShopping, faReceipt, faWallet, faBoxOpen, faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../store/StoreContext.jsx";
import { useDerived } from "../hooks/useDerived.js";
import { formatBRL } from "../utils/format.js";
import { fmtShort, daysUntil } from "../utils/date.js";
import { priceTrend } from "../utils/finance.js";
import { SectionHeader } from "../components/shared/SectionHeader.jsx";
import { Card, StatCard } from "../components/ui/Card.jsx";
import { Badge, TrendBadge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";

export function Dashboard() {
  const navigate = useNavigate();
  const { state } = useStore();
  const d = useDerived();

  const perMemberData = state.members.map((m) => ({
    name: m.name,
    valor: +((d.memberSpending[m.id] ?? 0)).toFixed(2),
  }));

  const priceVar = state.inventory
    .map((i) => ({ item: i, t: priceTrend(i.priceHistory) }))
    .filter((x) => x.t.prev !== null && x.t.direction !== "same")
    .sort((a, b) => Math.abs(b.t.pct) - Math.abs(a.t.pct))
    .slice(0, 4);

  return (
    <div>
      <SectionHeader title="Visão geral" subtitle="Resumo da casa neste mês" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={faBasketShopping} label="Compras no mês" value={formatBRL(d.totalPurchases)} sub={`${d.monthPurchases.length} compras`} />
        <StatCard icon={faReceipt} label="Contas no mês" value={formatBRL(d.totalBills)} sub={`${d.monthBills.length} contas`} />
        <StatCard icon={faWallet} label="Por morador" value={formatBRL(d.perMember)} sub={`${d.memberCount} integrantes`} />
        <StatCard icon={faBoxOpen} label="Estoque baixo" value={d.lowStock.length} sub="itens p/ repor" accent={d.lowStock.length ? "text-amber-600" : "text-stone-900"} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-stone-800">Valor por morador (mês)</h3>
          <p className="text-xs text-stone-400">Compras + contas rateadas igualmente</p>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perMemberData} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#78716c" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => formatBRL(v)} cursor={{ fill: "#f5f5f4" }} contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }} />
                <Bar dataKey="valor" fill="#1c1917" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-800">Próximas contas</h3>
            <button onClick={() => navigate("/contas")} className="text-xs font-medium text-stone-500 hover:text-stone-900">ver todas</button>
          </div>
          <div className="mt-4 space-y-2.5">
            {d.upcomingBills.slice(0, 4).map((b) => {
              const du = daysUntil(b.dueDate);
              return (
                <div key={b.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-700">{b.description}</p>
                    <p className="text-xs text-stone-400">vence {fmtShort(b.dueDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-stone-800">{formatBRL(b.amount)}</p>
                    {du < 0 ? <Badge tone="red">atrasada</Badge> : du <= 3 ? <Badge tone="amber">em {du}d</Badge> : <Badge tone="neutral">em {du}d</Badge>}
                  </div>
                </div>
              );
            })}
            {!d.upcomingBills.length && <p className="py-6 text-center text-xs text-stone-400">Nenhuma conta pendente 🎉</p>}
          </div>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-800">Variação recente de preços</h3>
            <button onClick={() => navigate("/precos")} className="text-xs font-medium text-stone-500 hover:text-stone-900">análise</button>
          </div>
          <div className="mt-4 divide-y divide-stone-100">
            {priceVar.map(({ item, t }) => (
              <div key={item.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-stone-700">{item.name}</p>
                  <p className="text-xs text-stone-400">{formatBRL(t.prev)} → {formatBRL(t.last)}</p>
                </div>
                <TrendBadge history={item.priceHistory} />
              </div>
            ))}
            {!priceVar.length && <p className="py-6 text-center text-xs text-stone-400">Sem variações relevantes ainda.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-stone-800">Atalhos</h3>
          <div className="mt-4 space-y-2">
            <Button variant="outline" className="w-full justify-between" onClick={() => navigate("/compras?new=1")}>
              Adicionar compra <FontAwesomeIcon icon={faPlus} style={{ height: "1rem" }} />
            </Button>
            <Button variant="outline" className="w-full justify-between" onClick={() => navigate("/inventario?new=1")}>
              Adicionar item <FontAwesomeIcon icon={faPlus} style={{ height: "1rem" }} />
            </Button>
            <Button variant="outline" className="w-full justify-between" onClick={() => navigate("/contas?new=1")}>
              Adicionar conta <FontAwesomeIcon icon={faPlus} style={{ height: "1rem" }} />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
