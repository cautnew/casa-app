export const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-100";

export const Input = (p) => <input {...p} className={`${inputCls} ${p.className || ""}`} />;
export const Textarea = (p) => <textarea {...p} className={`${inputCls} resize-none ${p.className || ""}`} />;
export const Select = ({ children, ...p }) => (
  <select {...p} className={`${inputCls} ${p.className || ""}`}>{children}</select>
);

export function Field({ label, children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1.5">
      <span className="text-xs font-medium text-stone-500">{label}</span>
      {children}
    </label>
  );
}
