import { uid } from "../utils/id.js";
import { splitEqually } from "../utils/finance.js";
import { buildInventory } from "../utils/inventory.js";
import { daysAgo, inDays, currentMonthKey } from "../utils/date.js";
import { norm } from "../utils/finance.js";

const mockMembers = [
  { id: "m1", name: "Ana", color: "bg-rose-400" },
  { id: "m2", name: "Bruno", color: "bg-sky-400" },
  { id: "m3", name: "Carla", color: "bg-emerald-400" },
];

function pItem(name, category, quantity, unit, unitPrice) {
  return {
    id: uid("pi"), name, category, quantity, unit, unitPrice,
    totalPrice: +(quantity * unitPrice).toFixed(2),
  };
}

function buildPurchase(date, store, note, items, members) {
  const total = +items.reduce((s, i) => s + i.totalPrice, 0).toFixed(2);
  return {
    id: uid("buy"), date, store, note, items, total,
    perMember: +splitEqually(total, members).toFixed(2),
  };
}

const mockPurchases = [
  buildPurchase(daysAgo(40), "Carrefour", "Compra do mês", [
    pItem("Arroz", "Alimentos", 1, "pacote", 24.9),
    pItem("Feijão", "Alimentos", 1, "kg", 8.5),
    pItem("Leite", "Bebidas", 6, "L", 4.2),
    pItem("Detergente", "Limpeza", 2, "un", 2.9),
    pItem("Café", "Bebidas", 1, "pacote", 18.0),
  ], 3),
  buildPurchase(daysAgo(22), "Atacadão", "", [
    pItem("Arroz", "Alimentos", 1, "pacote", 22.5),
    pItem("Leite", "Bebidas", 6, "L", 4.5),
    pItem("Papel higiênico", "Higiene", 1, "pacote", 19.9),
    pItem("Banana", "Hortifruti", 2, "kg", 5.9),
    pItem("Sabão em pó", "Limpeza", 1, "caixa", 16.5),
  ], 3),
  buildPurchase(daysAgo(8), "Carrefour", "Reposição rápida", [
    pItem("Leite", "Bebidas", 6, "L", 4.9),
    pItem("Café", "Bebidas", 1, "pacote", 21.5),
    pItem("Banana", "Hortifruti", 2, "kg", 6.8),
    pItem("Pão de forma", "Padaria", 1, "un", 9.9),
    pItem("Detergente", "Limpeza", 2, "un", 3.2),
  ], 3),
];

const mockBills = [
  { id: "b1", description: "Conta de luz", category: "Luz", amount: 245.8, dueDate: inDays(4), status: "pendente", referenceMonth: currentMonthKey(), note: "" },
  { id: "b2", description: "Internet fibra 500MB", category: "Internet", amount: 99.9, dueDate: inDays(12), status: "pendente", referenceMonth: currentMonthKey(), note: "" },
  { id: "b3", description: "Água", category: "Água", amount: 78.4, dueDate: daysAgo(3), status: "pendente", referenceMonth: currentMonthKey(), note: "Verificar vazamento" },
  { id: "b4", description: "Aluguel", category: "Aluguel", amount: 1800, dueDate: inDays(1), status: "pendente", referenceMonth: currentMonthKey(), note: "" },
  { id: "b5", description: "Gás", category: "Gás", amount: 120, dueDate: daysAgo(20), status: "paga", referenceMonth: currentMonthKey(), note: "" },
];

/** Estado inicial: inventário derivado das compras + ajustes para demonstração. */
export function buildInitialState() {
  const inventory = buildInventory(mockPurchases);
  const findInv = (n) => inventory.find((i) => norm(i.name) === norm(n));
  if (findInv("Detergente")) findInv("Detergente").quantity = 1;
  if (findInv("Café")) findInv("Café").quantity = 0;
  if (findInv("Feijão")) findInv("Feijão").minStock = 2;

  const shoppingList = [
    { id: uid("sl"), name: "Café", category: "Bebidas", desiredQty: 1, unit: "pacote", bought: false, sourceInventoryId: findInv("Café")?.id ?? null },
    { id: uid("sl"), name: "Ovos", category: "Alimentos", desiredQty: 12, unit: "un", bought: false, sourceInventoryId: null },
  ];
  if (findInv("Café")) findInv("Café").inNextList = true;

  return { members: mockMembers, purchases: mockPurchases, inventory, shoppingList, bills: mockBills };
}
