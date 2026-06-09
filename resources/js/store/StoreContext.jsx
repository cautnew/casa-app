import { createContext, useContext, useState, useEffect, useCallback } from "react";

const StoreContext = createContext(null);

const BASE = "/api";

async function apiFetch(method, path, body) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";

  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!r.ok) {
    const msg = await r.text().catch(() => `HTTP ${r.status}`);
    throw new Error(msg || `HTTP ${r.status}`);
  }

  return r.status === 204 ? null : r.json();
}

const EMPTY = { members: [], purchases: [], inventory: [], shoppingList: [], bills: [] };

export function StoreProvider({ children }) {
  const [state, setState] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const data = await apiFetch("GET", "/state");
    setState(data);
  }, []);

  useEffect(() => {
    reload().catch(setError).finally(() => setLoading(false));
  }, [reload]);

  const dispatch = useCallback(async (action) => {
    try {
      switch (action.type) {
        case "ADD_MEMBER":
          await apiFetch("POST", "/members", action.payload);
          break;
        case "EDIT_MEMBER":
          await apiFetch("PUT", `/members/${action.payload.id}`, action.payload);
          break;
        case "REMOVE_MEMBER":
          await apiFetch("DELETE", `/members/${action.id}`);
          break;

        case "ADD_PURCHASE":
          await apiFetch("POST", "/purchases", action.payload);
          break;
        case "EDIT_PURCHASE":
          await apiFetch("PUT", `/purchases/${action.payload.id}`, action.payload);
          break;
        case "REMOVE_PURCHASE":
          await apiFetch("DELETE", `/purchases/${action.id}`);
          break;

        case "UPDATE_INVENTORY_QTY":
          await apiFetch("PATCH", `/inventory/${action.id}/qty`, { quantity: action.quantity });
          break;
        case "EDIT_INVENTORY":
          await apiFetch("PUT", `/inventory/${action.payload.id}`, action.payload);
          break;
        case "REMOVE_INVENTORY":
          await apiFetch("DELETE", `/inventory/${action.id}`);
          break;
        case "TOGGLE_NEXT_LIST":
          await apiFetch("PATCH", `/inventory/${action.id}/toggle-next-list`);
          break;

        case "ADD_SHOPPING_ITEM":
          await apiFetch("POST", "/shopping", action.payload);
          break;
        case "EDIT_SHOPPING_ITEM":
          await apiFetch("PUT", `/shopping/${action.payload.id}`, action.payload);
          break;
        case "REMOVE_SHOPPING_ITEM":
          await apiFetch("DELETE", `/shopping/${action.id}`);
          break;
        case "TOGGLE_BOUGHT":
          await apiFetch("PATCH", `/shopping/${action.id}/toggle-bought`);
          break;
        case "FINALIZE_SHOPPING":
          await apiFetch("POST", "/shopping/finalize", {
            store: action.store,
            date: action.date,
            items: action.items,
            memberPayments: action.memberPayments ?? [],
          });
          break;

        case "ADD_BILL":
          await apiFetch("POST", "/bills", action.payload);
          break;
        case "ADD_BILLS_BATCH":
          await Promise.all(action.payloads.map((p) => apiFetch("POST", "/bills", p)));
          break;
        case "EDIT_BILL":
          await apiFetch("PUT", `/bills/${action.payload.id}`, action.payload);
          break;
        case "REMOVE_BILL":
          await apiFetch("DELETE", `/bills/${action.id}`);
          break;
        case "SET_BILL_STATUS":
          await apiFetch("PATCH", `/bills/${action.id}/status`, {
            status: action.status,
            memberPayments: action.memberPayments ?? [],
          });
          break;

        default:
          console.warn("Ação desconhecida:", action.type);
      }
      await reload();
    } catch (err) {
      console.error("Falha na ação:", action.type, err);
    }
  }, [reload]);

  return (
    <StoreContext.Provider value={{ state, loading, error, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
