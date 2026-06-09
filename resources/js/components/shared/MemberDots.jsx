/** Avatares sobrepostos dos integrantes da casa. */
export function MemberDots({ members }) {
  return (
    <div className="flex -space-x-1.5">
      {members.map((m) => (
        <span
          key={m.id}
          title={m.name}
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white ${m.color}`}
        >
          {m.name[0]}
        </span>
      ))}
    </div>
  );
}
