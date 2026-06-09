// Cálculos financeiros e de estoque centralizados (lógica de negócio pura).

/** Rateio igualitário de um total entre N integrantes. */
export const splitEqually = (total, count) => (count > 0 ? total / count : 0);

/**
 * Tendência do preço a partir do histórico [{ date, price }].
 * Retorna direção (up/down/same), variação percentual e os dois últimos preços.
 */
export function priceTrend(history = []) {
  if (history.length < 2)
    return { direction: "same", pct: 0, last: history.at(-1)?.price ?? 0, prev: null };
  const last = history.at(-1).price;
  const prev = history.at(-2).price;
  if (prev === 0) return { direction: "same", pct: 0, last, prev };
  const pct = ((last - prev) / prev) * 100;
  const direction = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "same";
  return { direction, pct, last, prev };
}

/** Status de estoque de um item: normal | baixo | acabando. */
export function stockStatus(item) {
  const { quantity, minStock } = item;
  if (quantity <= 0) return "acabando";
  if (quantity <= minStock) return "baixo";
  return "normal";
}

/** Normaliza nome para comparação (case/espaços). */
export const norm = (s) => s.trim().toLowerCase();
