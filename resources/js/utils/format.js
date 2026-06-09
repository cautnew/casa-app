const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata um número como moeda brasileira. */
export const formatBRL = (v) => BRL.format(Number.isFinite(v) ? v : 0);
