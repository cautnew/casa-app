const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata um número como moeda brasileira. */
export const formatBRL = (v) => BRL.format(Number.isFinite(v) ? v : 0);

const DIACRITICS_RE = /[̀-ͯ]/g;

/** Normaliza um texto para o formato slug (letras minúsculas, números e hífens). */
export function slugify(value) {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
