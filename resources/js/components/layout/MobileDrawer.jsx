import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faDollarSign } from "@fortawesome/free-solid-svg-icons";
import { NAV } from "./nav.js";

/** Gaveta de navegação lateral (mobile): desliza da esquerda ao abrir. */
export function MobileDrawer({ open, onClose }) {
  const { pathname } = useLocation();

  // Fecha ao mudar de rota
  useEffect(() => { onClose(); }, [pathname]);

  // Trava scroll do body enquanto aberto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="lg:hidden">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Painel lateral */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Cabeçalho do drawer */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-white">
              <FontAwesomeIcon icon={faDollarSign} style={{ height: "1.125rem" }} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Casa</p>
              <p className="text-xs text-stone-400">Compras &amp; contas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="Fechar menu"
          >
            <FontAwesomeIcon icon={faXmark} style={{ height: "1rem" }} />
          </button>
        </div>

        {/* Links de navegação */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-stone-900 text-white"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                }`
              }
            >
              <FontAwesomeIcon icon={n.icon} style={{ height: "1.25rem", width: "1.25rem" }} />
              {n.short}
            </NavLink>
          ))}
        </nav>

        <p className="shrink-0 px-6 py-5 text-xs text-stone-300">Da nossa casa ❤️</p>
      </aside>
    </div>
  );
}
