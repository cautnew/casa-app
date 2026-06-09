import { useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { NAV } from "./nav.js";

/** Barra superior fixa (mobile): hamburger + título da página atual. */
export function MobileTopBar({ onOpen }) {
  const { pathname } = useLocation();
  const current = NAV.find((n) =>
    n.to === "/" ? pathname === "/" : pathname.startsWith("/" + n.to.replace(/^\//, "")),
  );

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-stone-200 bg-white/90 px-4 backdrop-blur lg:hidden">
      <button
        onClick={onOpen}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-600 transition hover:bg-stone-100"
        aria-label="Abrir menu"
      >
        <FontAwesomeIcon icon={faBars} style={{ height: "1.125rem" }} />
      </button>
      <span className="text-base font-semibold tracking-tight text-stone-900">
        {current?.label ?? "Casa"}
      </span>
    </header>
  );
}
