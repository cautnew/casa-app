import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function Card({ className = "", children }) {
  return <div className={`rounded-2xl border border-stone-200 bg-white ${className}`}>{children}</div>;
}

export function StatCard({ icon, label, value, sub, accent = "text-stone-900" }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-stone-500">{label}</span>
        <FontAwesomeIcon icon={icon} className="text-stone-400" style={{ height: "1rem", width: "1rem" }} />
      </div>
      <div className={`mt-3 text-2xl font-semibold tracking-tight ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-stone-400">{sub}</div>}
    </Card>
  );
}
