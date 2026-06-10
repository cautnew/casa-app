import { useState, useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from "recharts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../store/StoreContext.jsx";
import { monthKey } from "../utils/date.js";
import { formatBRL } from "../utils/format.js";
import { SectionHeader } from "../components/shared/SectionHeader.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Badge } from "../components/ui/Badge.jsx";

// ── Cores dos integrantes (Tailwind → hex) ────────────────────────────────────
const COLOR_HEX = {
  "bg-rose-400":    "#fb7185",
  "bg-sky-400":     "#38bdf8",
  "bg-emerald-400": "#34d399",
  "bg-amber-400":   "#fbbf24",
  "bg-violet-400":  "#a78bfa",
  "bg-teal-400":    "#2dd4bf",
};
const FALLBACK_COLORS = ["#1c1917", "#78716c", "#57534e", "#a8a29e", "#d6d3d1", "#292524"];
const memberHex = (m, idx) => COLOR_HEX[m.color] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

// ── Cores das categorias nos gráficos empilhados ─────────────────────────────
const CATEGORY_COLORS = [
  "#1c1917", "#78716c", "#a8a29e", "#fb7185", "#38bdf8",
  "#34d399", "#fbbf24", "#a78bfa", "#2dd4bf", "#f97316", "#0ea5e9", "#d6d3d1",
];
const categoryHex = (idx) => CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

// ── "Jan/25" a partir de "YYYY-MM" ───────────────────────────────────────────
const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmtMonthKey = (k) => { const [y, m] = k.split("-"); return `${MONTH_NAMES[+m - 1]}/${y.slice(2)}`; };

// ── Meses entre duas datas (inclusive) ───────────────────────────────────────
function monthsBetween(from, to) {
  const result = [];
  const cur = new Date(from.slice(0, 7) + "-01");
  const end = new Date(to.slice(0, 7) + "-01");
  while (cur <= end && result.length <= 25) {
    result.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return result;
}

// ── Período padrão: primeiro dia do mês de 11 meses atrás → último dia deste mês
function defaultFrom() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 11);
  return d.toISOString().slice(0, 10);
}
function defaultTo() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const MAX_DAYS = 725;

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e7e5e4",
  fontSize: 12,
  boxShadow: "0 1px 4px rgba(0,0,0,.06)",
};

export function Analytics() {
  const { state } = useStore();

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo,   setDateTo]   = useState(defaultTo);

  // ── Clampa automaticamente ao máximo de 725 dias ──────────────────────────
  const handleFromChange = (val) => {
    const from = new Date(val);
    const to   = new Date(dateTo);
    if ((to - from) / 86400000 > MAX_DAYS) {
      const clamped = new Date(from);
      clamped.setDate(clamped.getDate() + MAX_DAYS);
      setDateTo(clamped.toISOString().slice(0, 10));
    }
    setDateFrom(val);
  };

  const handleToChange = (val) => {
    const to   = new Date(val);
    const from = new Date(dateFrom);
    if ((to - from) / 86400000 > MAX_DAYS) {
      const clamped = new Date(to);
      clamped.setDate(clamped.getDate() - MAX_DAYS);
      setDateFrom(clamped.toISOString().slice(0, 10));
    }
    setDateTo(val);
  };

  const rangedays = Math.floor((new Date(dateTo) - new Date(dateFrom)) / 86400000);

  // ── Dados filtrados pelo período ──────────────────────────────────────────
  const purchases = useMemo(
    () => state.purchases.filter((p) => {
      const d = p.date.slice(0, 10);
      return d >= dateFrom && d <= dateTo;
    }),
    [state.purchases, dateFrom, dateTo],
  );

  const bills = useMemo(
    () => state.bills.filter((b) => {
      const d = b.dueDate.slice(0, 10);
      return d >= dateFrom && d <= dateTo;
    }),
    [state.bills, dateFrom, dateTo],
  );

  // ── Meses exibidos no eixo X ──────────────────────────────────────────────
  const activeMonths = useMemo(() => monthsBetween(dateFrom, dateTo), [dateFrom, dateTo]);

  // ── Totais de resumo ──────────────────────────────────────────────────────
  const totalPurchases = useMemo(() => purchases.reduce((s, p) => s + p.total, 0), [purchases]);
  const totalBills     = useMemo(() => bills.reduce((s, b) => s + b.amount, 0), [bills]);
  const totalGeral     = totalPurchases + totalBills;
  const numMonths      = activeMonths.length || 1;
  const avgPerMonth    = totalGeral / numMonths;

  // ── Evolução mensal ───────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map = Object.fromEntries(
      activeMonths.map((m) => [m, { label: fmtMonthKey(m), compras: 0, contas: 0 }]),
    );
    purchases.forEach((p) => {
      const mk = monthKey(p.date);
      if (map[mk]) map[mk].compras += p.total;
    });
    bills.forEach((b) => {
      const mk = monthKey(b.dueDate);
      if (map[mk]) map[mk].contas += b.amount;
    });
    return activeMonths.map((m) => map[m]);
  }, [activeMonths, purchases, bills]);

  // ── Gastos por categoria ──────────────────────────────────────────────────
  const categoryData = useMemo(() => {
    const map = {};
    purchases.forEach((p) =>
      (p.items ?? []).forEach((item) => {
        const c = item.category ?? "Outros";
        map[c] = (map[c] ?? 0) + (item.totalPrice ?? 0);
      }),
    );
    bills.forEach((b) => {
      const c = b.category ?? "Outros";
      map[c] = (map[c] ?? 0) + b.amount;
    });
    return Object.entries(map)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [purchases, bills]);

  // ── Gastos por categoria, mensalizados ────────────────────────────────────
  const allCategories = useMemo(() => categoryData.map((c) => c.category), [categoryData]);

  const categoryMonthlyData = useMemo(() => {
    const map = Object.fromEntries(
      activeMonths.map((m) => [
        m,
        { label: fmtMonthKey(m), ...Object.fromEntries(allCategories.map((c) => [c, 0])) },
      ]),
    );
    purchases.forEach((p) => {
      const mk = monthKey(p.date);
      if (!map[mk]) return;
      (p.items ?? []).forEach((item) => {
        const c = item.category ?? "Outros";
        map[mk][c] = (map[mk][c] ?? 0) + (item.totalPrice ?? 0);
      });
    });
    bills.forEach((b) => {
      const mk = monthKey(b.dueDate);
      if (!map[mk]) return;
      const c = b.category ?? "Outros";
      map[mk][c] = (map[mk][c] ?? 0) + b.amount;
    });
    return activeMonths.map((m) => map[m]);
  }, [activeMonths, purchases, bills, allCategories]);

  // ── Total gasto por integrante no período ─────────────────────────────────
  const memberTotals = useMemo(() => {
    const mc = state.members.length || 1;
    const totals = Object.fromEntries(state.members.map((m) => [m.id, 0]));
    const add = (mp, total) => {
      if (mp?.length > 0) {
        mp.forEach((p) => { if (p.memberId in totals) totals[p.memberId] += p.amount; });
      } else {
        state.members.forEach((m) => { totals[m.id] += total / mc; });
      }
    };
    purchases.forEach((p) => add(p.memberPayments, p.total));
    bills.filter((b) => b.status === "paga").forEach((b) => add(b.memberPayments, b.amount));
    return state.members.map((m, idx) => ({ ...m, total: totals[m.id], hex: memberHex(m, idx) }));
  }, [purchases, bills, state.members]);
  const maxMemberTotal = Math.max(1, ...memberTotals.map((m) => m.total));

  // ── Contas mais caras ─────────────────────────────────────────────────────
  const topBills = useMemo(
    () => [...bills].sort((a, b) => b.amount - a.amount).slice(0, 10),
    [bills],
  );

  // ── Contribuição por integrante por mês ───────────────────────────────────
  const memberMonthlyData = useMemo(() => {
    const mc = state.members.length || 1;
    const map = Object.fromEntries(
      activeMonths.map((m) => [
        m,
        { label: fmtMonthKey(m), ...Object.fromEntries(state.members.map((mem) => [mem.id, 0])) },
      ]),
    );

    const add = (mk, mp, total) => {
      if (!map[mk]) return;
      if (mp?.length > 0) {
        mp.forEach((p) => { if (p.memberId in map[mk]) map[mk][p.memberId] += p.amount; });
      } else {
        state.members.forEach((m) => { map[mk][m.id] += total / mc; });
      }
    };

    purchases.forEach((p) => add(monthKey(p.date), p.memberPayments, p.total));
    bills.filter((b) => b.status === "paga")
         .forEach((b) => add(monthKey(b.dueDate), b.memberPayments, b.amount));

    return activeMonths.map((m) => {
      const row = { label: map[m].label };
      state.members.forEach((mem) => { row[mem.name] = +(map[m][mem.id] ?? 0).toFixed(2); });
      return row;
    });
  }, [activeMonths, purchases, bills, state.members]);

  const xInterval = numMonths <= 6 ? 0 : numMonths <= 12 ? 1 : 2;
  const barSize   = numMonths <= 6 ? 32 : numMonths <= 12 ? 24 : 14;

  return (
    <div>
      <SectionHeader
        title="Análises financeiras"
        subtitle="Evolução de gastos, categorias e contribuições por integrante"
      />

      {/* ── Filtro de período ─────────────────────────────────────────────── */}
      <div className="mb-4 rounded-xl border border-stone-200 bg-white px-3 py-2.5">
        {/* Rótulo */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <FontAwesomeIcon icon={faCalendar} className="text-stone-400" style={{ height: "0.75rem" }} />
          <span className="text-xs text-stone-500">Período</span>
        </div>
        {/* Datas: w-0 flex-1 força divisão igual sem transbordar no mobile */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => handleFromChange(e.target.value)}
            className="w-0 flex-1 border-none bg-transparent text-xs text-stone-700 outline-none"
          />
          <span className="shrink-0 text-xs text-stone-400">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => handleToChange(e.target.value)}
            className="w-0 flex-1 border-none bg-transparent text-xs text-stone-700 outline-none"
          />
        </div>
        {rangedays >= MAX_DAYS - 1 && (
          <p className="mt-1 text-xs text-amber-500">máximo de 24 meses atingido</p>
        )}
      </div>

      {/* ── Resumo ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Total no período"  value={formatBRL(totalGeral)}     sub={`${numMonths} ${numMonths === 1 ? "mês" : "meses"}`} />
        <MiniStat label="Compras"           value={formatBRL(totalPurchases)} sub={`${purchases.length} compras`} />
        <MiniStat label="Contas"            value={formatBRL(totalBills)}     sub={`${bills.length} contas`} />
        <MiniStat label="Média mensal"      value={formatBRL(avgPerMonth)}    sub="compras + contas" />
      </div>

      {/* ── Evolução mensal ───────────────────────────────────────────────── */}
      <Card className="mt-3 p-5">
        <h3 className="text-sm font-semibold text-stone-800">Evolução mensal dos gastos</h3>
        <p className="text-xs text-stone-400 mt-0.5">Compras e contas por mês · empilhadas</p>
        <div className="mt-4 h-56 min-w-0 overflow-hidden">
          <ResponsiveContainer width="99%" height="100%">
            <BarChart data={monthlyData} margin={{ left: -18, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#78716c" }}
                axisLine={false}
                tickLine={false}
                interval={xInterval}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#a8a29e" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
              />
              <Tooltip
                formatter={(v, name) => [formatBRL(v), name === "compras" ? "Compras" : "Contas"]}
                cursor={{ fill: "#f5f5f4" }}
                contentStyle={TOOLTIP_STYLE}
              />
              <Legend
                iconType="square"
                iconSize={10}
                wrapperStyle={{ fontSize: 12 }}
                formatter={(v) => v === "compras" ? "Compras" : "Contas"}
              />
              <Bar dataKey="compras" stackId="a" fill="#1c1917" maxBarSize={barSize} />
              <Bar dataKey="contas"  stackId="a" fill="#a8a29e" maxBarSize={barSize} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Gastos por categoria, mês a mês ───────────────────────────────── */}
      <Card className="mt-3 p-5">
        <h3 className="text-sm font-semibold text-stone-800">Gastos por categoria, por mês do período</h3>
        <p className="text-xs text-stone-400 mt-0.5">Itens de compras + contas, agrupados por categoria · empilhados</p>
        {categoryMonthlyData.length > 0 && allCategories.length > 0 ? (
          <div className="mt-4 h-64 min-w-0 overflow-hidden">
            <ResponsiveContainer width="99%" height="100%">
              <BarChart data={categoryMonthlyData} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#78716c" }}
                  axisLine={false}
                  tickLine={false}
                  interval={xInterval}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#a8a29e" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
                />
                <Tooltip
                  formatter={(v, name) => [formatBRL(v), name]}
                  cursor={{ fill: "#f5f5f4" }}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                {allCategories.map((c, idx) => (
                  <Bar
                    key={c}
                    dataKey={c}
                    stackId="cat"
                    fill={categoryHex(idx)}
                    maxBarSize={barSize}
                    radius={idx === allCategories.length - 1 ? [6, 6, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-10 text-center text-xs text-stone-400">Sem dados no período</p>
        )}
      </Card>

      {/* ── Categorias + Contribuição por integrante ──────────────────────── */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-stone-800">Gastos por categoria, total do período</h3>
          <p className="text-xs text-stone-400 mt-0.5">Itens de compras + contas da casa</p>
          {categoryData.length > 0 ? (
            <div className="mt-4 space-y-3">
              {categoryData.map(({ category, total }) => {
                const pct = totalGeral > 0 ? (total / totalGeral) * 100 : 0;
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-stone-700">{category}</span>
                      <span className="text-xs text-stone-500">
                        {formatBRL(total)}
                        <span className="ml-1.5 text-stone-400">{pct.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-stone-100">
                      <div
                        className="h-1.5 rounded-full bg-stone-800 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-10 text-center text-xs text-stone-400">Sem dados no período</p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-stone-800">Contribuição por integrante / mês</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Compras + contas pagas · rateio real ou igualitário
          </p>
          {state.members.length > 0 ? (
            <>
            <div className="mt-4 space-y-2">
              {memberTotals.map((m) => {
                const pct = (m.total / maxMemberTotal) * 100;
                return (
                  <div key={m.id}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.hex }} />
                        {m.name}
                      </span>
                      <span className="text-xs text-stone-500">{formatBRL(m.total)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-stone-100">
                      <div
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: m.hex }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 h-64 min-w-0 overflow-hidden">
              <ResponsiveContainer width="99%" height="100%">
                <BarChart data={memberMonthlyData} margin={{ left: -18, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#78716c" }}
                    axisLine={false}
                    tickLine={false}
                    interval={xInterval}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#a8a29e" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
                  />
                  <Tooltip
                    formatter={(v, name) => [formatBRL(v), name]}
                    cursor={{ fill: "#f5f5f4" }}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  {state.members.map((m, idx) => (
                    <Bar
                      key={m.id}
                      dataKey={m.name}
                      stackId="c"
                      fill={memberHex(m, idx)}
                      maxBarSize={barSize}
                      radius={idx === state.members.length - 1 ? [6, 6, 0, 0] : undefined}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            </>
          ) : (
            <p className="py-10 text-center text-xs text-stone-400">Nenhum integrante cadastrado</p>
          )}
        </Card>
      </div>

      {/* ── Contas mais caras ────────────────────────────────────────────── */}
      <Card className="mt-3 p-5">
        <h3 className="text-sm font-semibold text-stone-800">Contas mais caras</h3>
        <p className="text-xs text-stone-400 mt-0.5">
          Maiores despesas fixas e variáveis no período
        </p>
        {topBills.length > 0 ? (
          <div className="mt-4 divide-y divide-stone-100">
            {topBills.map((bill, idx) => {
              const isOverdue = bill.status !== "paga" && new Date(bill.dueDate) < new Date();
              return (
                <div key={bill.id} className="flex items-center gap-4 py-2.5">
                  <span className="w-5 shrink-0 text-center text-sm font-semibold text-stone-300">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-700">{bill.description}</p>
                    <p className="text-xs text-stone-400">{bill.category}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <p className="text-sm font-semibold text-stone-900">{formatBRL(bill.amount)}</p>
                    {bill.status === "paga"
                      ? <Badge tone="green">paga</Badge>
                      : isOverdue
                        ? <Badge tone="red">atrasada</Badge>
                        : <Badge tone="neutral">pendente</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-10 text-center text-xs text-stone-400">
            Nenhuma conta registrada no período
          </p>
        )}
      </Card>
    </div>
  );
}

function MiniStat({ label, value, sub }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-stone-400">{sub}</p>}
    </Card>
  );
}
