import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowTrendUp, faArrowTrendDown, faBasketShopping, faChartLine, faCalendar } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../store/StoreContext.jsx";
import { CATEGORIES } from "../constants.js";
import { formatBRL } from "../utils/format.js";
import { fmtShort } from "../utils/date.js";
import { priceTrend } from "../utils/finance.js";
import { SectionHeader } from "../components/shared/SectionHeader.jsx";
import { Card } from "../components/ui/Card.jsx";
import { TrendBadge } from "../components/ui/Badge.jsx";
import { Select } from "../components/ui/Input.jsx";
import { EmptyState } from "../components/ui/EmptyState.jsx";

export function Prices() {
  const { state } = useStore();
  const [selectedId, setSelectedId] = useState(null);
  const [cat, setCat] = useState("Todas");
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

  const inPeriod = (dateStr) => { const d = (dateStr || "").slice(0, 10); return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo); };

  const itemsWithHistory = state.inventory.filter((i) => i.priceHistory.some((h) => inPeriod(h.date)));
  const filtered = itemsWithHistory.filter((i) => cat === "Todas" || i.category === cat);
  const selected = state.inventory.find((i) => i.id === selectedId) ?? filtered[0];

  const trends = state.inventory
    .map((i) => { const ph = i.priceHistory.filter((h) => inPeriod(h.date)); return ph.length >= 2 ? { item: i, t: priceTrend(ph) } : null; })
    .filter(Boolean);
  const biggestUp        = [...trends].filter((x) => x.t.direction === "up").sort((a, b) => b.t.pct - a.t.pct)[0];
  const biggestDown      = [...trends].filter((x) => x.t.direction === "down").sort((a, b) => a.t.pct - b.t.pct)[0];
  const mostBoughtResult = [...state.inventory]
    .map((i) => ({ item: i, count: i.priceHistory.filter((h) => inPeriod(h.date)).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)[0] ?? null;

  const chartData = selected?.priceHistory.filter((h) => inPeriod(h.date)).map((h) => ({ data: fmtShort(h.date), preco: h.price })) ?? [];

  return (
    <div>
      <SectionHeader title="Acompanhamento de preços" subtitle="Evolução, comparações e insights" />

      <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2">
        <FontAwesomeIcon icon={faCalendar} className="text-stone-400" style={{ height: "0.75rem" }} />
        <span className="text-xs text-stone-500">Período:</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border-none bg-transparent text-xs text-stone-700 outline-none" />
        <span className="text-xs text-stone-400">—</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border-none bg-transparent text-xs text-stone-700 outline-none" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <InsightCard tone="red"     icon={faArrowTrendUp}   label="Maior alta"     item={biggestUp?.item.name}  value={biggestUp  ? `+${biggestUp.t.pct.toFixed(1)}%`  : "—"} />
        <InsightCard tone="green"   icon={faArrowTrendDown} label="Maior queda"    item={biggestDown?.item.name} value={biggestDown ? `${biggestDown.t.pct.toFixed(1)}%` : "—"} />
        <InsightCard tone="neutral" icon={faBasketShopping} label="Mais comprado"  item={mostBoughtResult?.item.name} value={mostBoughtResult ? `${mostBoughtResult.count}x` : "—"} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-800">Itens</h3>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-32 text-xs">
              <option>Todas</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {filtered.map((i) => (
              <button
                key={i.id}
                onClick={() => setSelectedId(i.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${selected?.id === i.id ? "bg-stone-900 text-white" : "hover:bg-stone-100"}`}
              >
                <span className="text-sm font-medium">{i.name}</span>
                <span className={`text-xs ${selected?.id === i.id ? "text-stone-300" : "text-stone-400"}`}>{formatBRL(i.lastPrice)}</span>
              </button>
            ))}
            {!filtered.length && <p className="py-6 text-center text-xs text-stone-400">Sem itens nesta categoria.</p>}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-stone-800">{selected.name}</h3>
                  <p className="text-xs text-stone-400">{selected.category} · {chartData.length} registros no período · média {formatBRL(selected.avgPrice)}</p>
                </div>
                {selected.priceHistory.length >= 2 && <TrendBadge history={selected.priceHistory} />}
              </div>
              <div className="mt-5 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: -16, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                    <XAxis dataKey="data" tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip formatter={(v) => formatBRL(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }} />
                    <Line type="monotone" dataKey="preco" stroke="#1c1917" strokeWidth={2.5} dot={{ r: 3, fill: "#1c1917" }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <EmptyState icon={faChartLine} title="Sem dados" message="Registre compras para acompanhar a evolução dos preços." />
          )}
        </Card>
      </div>
    </div>
  );
}

function InsightCard({ tone, icon, label, item, value }) {
  const tones = { red: "text-rose-600", green: "text-emerald-600", neutral: "text-stone-800" };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-stone-500">{label}</span>
        <FontAwesomeIcon icon={icon} className={`h-4 w-4 ${tones[tone]}`} style={{ height: "1rem" }} />
      </div>
      <div className={`mt-3 text-xl font-semibold ${tones[tone]}`}>{value}</div>
      <div className="mt-0.5 truncate text-xs text-stone-400">{item ?? "—"}</div>
    </Card>
  );
}
