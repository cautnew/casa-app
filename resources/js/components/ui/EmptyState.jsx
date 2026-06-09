import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

/** Estado vazio reutilizável com ícone FontAwesome, título, mensagem e ação opcional. */
export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-white p-3.5 shadow-sm">
        <FontAwesomeIcon icon={icon} className="text-stone-400" style={{ height: "1.5rem", width: "1.5rem" }} />
      </div>
      <h3 className="text-sm font-semibold text-stone-700">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-stone-400">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
