import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { NAV } from "./nav.js";

/** Barra de navegação inferior (mobile). */
export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-stone-200 bg-white/90 px-1 py-2 backdrop-blur lg:hidden">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === "/"}
          aria-label={n.label}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-xs font-medium transition ${
              isActive ? "text-stone-900" : "text-stone-400"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <FontAwesomeIcon
                icon={n.icon}
                style={{ height: "1.25rem", width: "1.25rem", opacity: isActive ? 1 : 0.7 }}
              />
              {n.short}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
