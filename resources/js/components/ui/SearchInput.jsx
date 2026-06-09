import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

/** Campo de busca com ícone, usado nas listagens. */
export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative flex-1">
      <FontAwesomeIcon
        icon={faMagnifyingGlass}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
        style={{ height: "1rem", width: "1rem" }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-3.5 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-100"
        aria-label={placeholder}
      />
    </div>
  );
}
