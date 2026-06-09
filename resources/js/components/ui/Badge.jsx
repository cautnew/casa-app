import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck, faTriangleExclamation, faBoxOpen,
  faArrowUp, faArrowDown, faMinus,
} from "@fortawesome/free-solid-svg-icons";
import { priceTrend, stockStatus } from "../../utils/finance.js";

export function Badge({ tone = "neutral", children }) {
  const tones = {
    neutral: "bg-stone-100 text-stone-600",
    green:   "bg-emerald-50 text-emerald-700",
    amber:   "bg-amber-50 text-amber-700",
    red:     "bg-rose-50 text-rose-700",
    blue:    "bg-sky-50 text-sky-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function StockBadge({ item }) {
  const s = stockStatus(item);
  if (s === "normal")   return <Badge tone="green"><FontAwesomeIcon icon={faCheck} style={{ height: "0.75rem" }} /> Normal</Badge>;
  if (s === "baixo")    return <Badge tone="amber"><FontAwesomeIcon icon={faTriangleExclamation} style={{ height: "0.75rem" }} /> Estoque baixo</Badge>;
  return <Badge tone="red"><FontAwesomeIcon icon={faBoxOpen} style={{ height: "0.75rem" }} /> Acabando</Badge>;
}

export function TrendBadge({ history }) {
  const t = priceTrend(history);
  if (t.direction === "up")   return <Badge tone="red"><FontAwesomeIcon icon={faArrowUp} style={{ height: "0.75rem" }} /> +{Math.abs(t.pct).toFixed(1)}%</Badge>;
  if (t.direction === "down") return <Badge tone="green"><FontAwesomeIcon icon={faArrowDown} style={{ height: "0.75rem" }} /> -{Math.abs(t.pct).toFixed(1)}%</Badge>;
  return <Badge tone="neutral"><FontAwesomeIcon icon={faMinus} style={{ height: "0.75rem" }} /> estável</Badge>;
}
