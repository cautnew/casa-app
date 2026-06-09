import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDollarSign } from "@fortawesome/free-solid-svg-icons";
import { NAV } from "./nav.js";

/** Navegação lateral fixa (desktop). */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-stone-200 bg-white px-4 py-6 lg:flex">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-white">
          <FontAwesomeIcon icon={faDollarSign} style={{ height: "1.25rem", width: "1.25rem" }} />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">Casa</p>
          <p className="text-xs text-stone-400">Compras &amp; contas</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              }`
            }
          >
            <FontAwesomeIcon icon={n.icon} style={{ height: "1.25rem", width: "1.25rem" }} /> {n.label}
          </NavLink>
        ))}
      </nav>

      <p className="px-3 text-xs text-stone-300">Da nossa casa ❤️</p>
    </aside>
  );
}
