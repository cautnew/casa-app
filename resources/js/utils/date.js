/** dd/mm/aaaa */
export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

/** dd mês */
export const fmtShort = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short" });

/** Chave de competência: "AAAA-MM" */
export const monthKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const currentMonthKey = () => monthKey(new Date().toISOString());

/** Dias restantes até a data (negativo = atrasado). */
export const daysUntil = (iso) => Math.ceil((new Date(iso) - new Date()) / 86400000);

export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

export const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};
