import { uid } from "./id.js";
import { norm } from "./finance.js";

/**
 * Insere ou atualiza um item de inventário a partir de um item comprado.
 * Muta o array `inventory` (use sobre uma cópia no reducer).
 * Acumula o histórico de preços e recalcula último/médio preço.
 */
export function upsertInventory(inventory, pItem, date, store) {
  const idx = inventory.findIndex(
    (i) => norm(i.name) === norm(pItem.name) && i.unit === pItem.unit
  );
  const entry = { date, price: pItem.unitPrice, store };

  if (idx === -1) {
    inventory.push({
      id: uid("inv"),
      name: pItem.name,
      category: pItem.category,
      quantity: pItem.quantity,
      unit: pItem.unit,
      minStock: Math.max(1, Math.round(pItem.quantity * 0.3)),
      lastPrice: pItem.unitPrice,
      avgPrice: pItem.unitPrice,
      priceHistory: [entry],
      inNextList: false,
    });
  } else {
    const it = inventory[idx];
    it.quantity += pItem.quantity;
    it.priceHistory = [...it.priceHistory, entry];
    it.lastPrice = pItem.unitPrice;
    it.avgPrice =
      it.priceHistory.reduce((s, e) => s + e.price, 0) / it.priceHistory.length;
  }
}

/** Reconstrói o inventário replayando todas as compras em ordem cronológica. */
export function buildInventory(purchases) {
  const inventory = [];
  [...purchases]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((p) =>
      p.items.forEach((it) => upsertInventory(inventory, it, p.date, p.store))
    );
  return inventory;
}
