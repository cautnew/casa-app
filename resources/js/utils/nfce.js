// Utilidades da importação de NFC-e (ver docs/plano-importacao-nfce.md).

const ACCEPTED_HOSTS = ["nfce.sefaz.rn.gov.br", "nfce.set.rn.gov.br", "www.nfce.set.rn.gov.br"];

/** Dígito verificador módulo 11 da chave de acesso. */
function checkDigit(first43) {
  let sum = 0;
  let weight = 2;
  for (let i = first43.length - 1; i >= 0; i--) {
    sum += Number(first43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  return dv >= 10 ? 0 : dv;
}

export function isValidAccessKey(digits) {
  return /^\d{44}$/.test(digits) && checkDigit(digits.slice(0, 43)) === Number(digits[43]);
}

/**
 * Extrai a chave de acesso do conteúdo de um QR Code, de um link ou da chave digitada.
 * Retorna { key, reason } — reason explica por que não foi possível (para mensagens claras).
 */
export function parseNfceInput(raw) {
  const text = (raw ?? "").trim();
  if (!text) return { key: null, reason: "empty" };

  if (/^[\d\s.]{44,60}$/.test(text)) {
    const digits = text.replace(/\D/g, "");
    return isValidAccessKey(digits) ? checkKey(digits) : { key: null, reason: "invalid" };
  }

  let url;
  try {
    url = new URL(text);
  } catch {
    return { key: null, reason: "invalid" };
  }
  const host = url.hostname.toLowerCase();
  if (!ACCEPTED_HOSTS.includes(host)) {
    return { key: null, reason: host.endsWith(".gov.br") ? "state" : "invalid" };
  }

  const params = new URLSearchParams([...url.searchParams].map(([k, v]) => [k.toLowerCase(), v]));
  const candidate = params.get("chnfce") ?? (params.get("p") ?? "").split("|")[0];
  return isValidAccessKey(candidate) ? checkKey(candidate) : { key: null, reason: "invalid" };
}

function checkKey(key) {
  if (key.slice(0, 2) !== "24") return { key: null, reason: "state" };
  if (key.slice(20, 22) !== "65") return { key: null, reason: "model" };
  return { key, reason: null };
}

export const INPUT_ERRORS = {
  empty: "Cole o link da nota.",
  invalid: "Este link não parece ser de uma NFC-e. Confira e tente novamente.",
  state: "Por enquanto só aceitamos notas do Rio Grande do Norte.",
  model: "Este documento não é uma NFC-e (nota do consumidor).",
};

/** Lembra a última aba usada (só conveniência — pode não estar disponível). */
export const lastTab = {
  get() {
    try { return localStorage.getItem("nfce:lastTab"); } catch { return null; }
  },
  set(tab) {
    try { localStorage.setItem("nfce:lastTab", tab); } catch { /* ignora */ }
  },
};

export const formatCnpj = (c) =>
  c?.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : c ?? "";
