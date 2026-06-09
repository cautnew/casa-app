import { uid } from "../utils/id.js";
import { splitEqually } from "../utils/finance.js";
import { upsertInventory } from "../utils/inventory.js";

/**
 * Reducer central do app. Toda a lógica de negócio passa por aqui:
 * rateio por integrante, atualização de inventário e histórico de preços.
 */
export function reducer(state, action) {
  switch (action.type) {
    /* ---- Integrantes ---- */
    case "ADD_MEMBER":
      return { ...state, members: [...state.members, { id: uid("m"), ...action.payload }] };
    case "EDIT_MEMBER":
      return { ...state, members: state.members.map((m) => (m.id === action.payload.id ? { ...m, ...action.payload } : m)) };
    case "REMOVE_MEMBER":
      return { ...state, members: state.members.filter((m) => m.id !== action.id) };

    /* ---- Compras ---- */
    case "ADD_PURCHASE": {
      const memberCount = state.members.length || 1;
      const items = action.payload.items.map((i) => ({
        ...i, id: uid("pi"), totalPrice: +(i.quantity * i.unitPrice).toFixed(2),
      }));
      const total = +items.reduce((s, i) => s + i.totalPrice, 0).toFixed(2);
      const purchase = {
        id: uid("buy"), ...action.payload, items, total,
        perMember: +splitEqually(total, memberCount).toFixed(2),
      };
      const inventory = state.inventory.map((i) => ({ ...i, priceHistory: [...i.priceHistory] }));
      items.forEach((it) => upsertInventory(inventory, it, purchase.date, purchase.store));
      return { ...state, purchases: [purchase, ...state.purchases], inventory };
    }
    case "REMOVE_PURCHASE":
      return { ...state, purchases: state.purchases.filter((p) => p.id !== action.id) };

    /* ---- Inventário ---- */
    case "UPDATE_INVENTORY_QTY":
      return { ...state, inventory: state.inventory.map((i) => (i.id === action.id ? { ...i, quantity: Math.max(0, action.quantity) } : i)) };
    case "EDIT_INVENTORY":
      return { ...state, inventory: state.inventory.map((i) => (i.id === action.payload.id ? { ...i, ...action.payload } : i)) };
    case "REMOVE_INVENTORY":
      return { ...state, inventory: state.inventory.filter((i) => i.id !== action.id) };
    case "TOGGLE_NEXT_LIST": {
      const item = state.inventory.find((i) => i.id === action.id);
      if (!item) return state;
      const willAdd = !item.inNextList;
      const inventory = state.inventory.map((i) => (i.id === action.id ? { ...i, inNextList: willAdd } : i));
      let shoppingList = state.shoppingList;
      if (willAdd && !shoppingList.some((s) => s.sourceInventoryId === item.id)) {
        shoppingList = [...shoppingList, {
          id: uid("sl"), name: item.name, category: item.category,
          desiredQty: Math.max(1, item.minStock), unit: item.unit, bought: false, sourceInventoryId: item.id,
        }];
      } else if (!willAdd) {
        shoppingList = shoppingList.filter((s) => s.sourceInventoryId !== item.id);
      }
      return { ...state, inventory, shoppingList };
    }

    /* ---- Lista de compras ---- */
    case "ADD_SHOPPING_ITEM":
      return { ...state, shoppingList: [...state.shoppingList, { id: uid("sl"), bought: false, sourceInventoryId: null, ...action.payload }] };
    case "EDIT_SHOPPING_ITEM":
      return { ...state, shoppingList: state.shoppingList.map((s) => (s.id === action.payload.id ? { ...s, ...action.payload } : s)) };
    case "REMOVE_SHOPPING_ITEM": {
      const item = state.shoppingList.find((s) => s.id === action.id);
      const inventory = item?.sourceInventoryId
        ? state.inventory.map((i) => (i.id === item.sourceInventoryId ? { ...i, inNextList: false } : i))
        : state.inventory;
      return { ...state, shoppingList: state.shoppingList.filter((s) => s.id !== action.id), inventory };
    }
    case "TOGGLE_BOUGHT":
      return { ...state, shoppingList: state.shoppingList.map((s) => (s.id === action.id ? { ...s, bought: !s.bought } : s)) };
    case "FINALIZE_SHOPPING": {
      const memberCount = state.members.length || 1;
      const items = action.items.map((i) => ({
        id: uid("pi"), name: i.name, category: i.category, quantity: i.quantity,
        unit: i.unit, unitPrice: i.unitPrice, totalPrice: +(i.quantity * i.unitPrice).toFixed(2),
      }));
      const total = +items.reduce((s, i) => s + i.totalPrice, 0).toFixed(2);
      const purchase = {
        id: uid("buy"), date: action.date, store: action.store,
        note: "Gerada a partir da lista de compras", items, total,
        perMember: +splitEqually(total, memberCount).toFixed(2),
      };
      const inventory = state.inventory.map((i) => ({ ...i, priceHistory: [...i.priceHistory] }));
      items.forEach((it) => upsertInventory(inventory, it, purchase.date, purchase.store));
      const usedSourceIds = action.items.map((i) => i.sourceInventoryId).filter(Boolean);
      const inv2 = inventory.map((i) => (usedSourceIds.includes(i.id) ? { ...i, inNextList: false } : i));
      const finalizedIds = action.items.map((i) => i.id);
      return {
        ...state,
        purchases: [purchase, ...state.purchases],
        inventory: inv2,
        shoppingList: state.shoppingList.filter((s) => !finalizedIds.includes(s.id)),
      };
    }

    /* ---- Contas ---- */
    case "ADD_BILL":
      return { ...state, bills: [...state.bills, { id: uid("b"), status: "pendente", ...action.payload }] };
    case "EDIT_BILL":
      return { ...state, bills: state.bills.map((b) => (b.id === action.payload.id ? { ...b, ...action.payload } : b)) };
    case "REMOVE_BILL":
      return { ...state, bills: state.bills.filter((b) => b.id !== action.id) };
    case "SET_BILL_STATUS":
      return { ...state, bills: state.bills.map((b) => (b.id === action.id ? { ...b, status: action.status } : b)) };

    default:
      return state;
  }
}
