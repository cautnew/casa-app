export function Button({ variant = "primary", size = "md", className = "", children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400";
  const variants = {
    primary: "bg-stone-900 text-white hover:bg-stone-700",
    ghost: "text-stone-600 hover:bg-stone-100",
    outline: "border border-stone-200 text-stone-700 hover:bg-stone-50",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100",
    subtle: "bg-stone-100 text-stone-700 hover:bg-stone-200",
  };
  const sizes = { sm: "text-xs px-3 py-1.5", md: "text-sm px-4 py-2.5", icon: "p-2" };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
