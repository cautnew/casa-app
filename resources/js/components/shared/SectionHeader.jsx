/**
 * Cabeçalho de página.
 * Desktop: título + subtítulo + ação.
 * Mobile:  apenas subtítulo + ação (título fica na top bar fixa).
 */
export function SectionHeader({ title, subtitle, action }) {
  const hasContent = subtitle || action;
  if (!hasContent) return null;

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {/* Título visível apenas no desktop — no mobile está na MobileTopBar */}
        {title && (
          <h1 className="hidden text-2xl font-semibold tracking-tight text-stone-900 lg:block">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className={`text-sm text-stone-500 ${title ? "lg:mt-1" : ""}`}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
