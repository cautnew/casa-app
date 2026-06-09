// Gerador de IDs únicos e simples (estável dentro da sessão).
let counter = 0;
export const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;
