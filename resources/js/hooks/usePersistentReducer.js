import { useReducer, useEffect } from "react";

/**
 * useReducer com persistência automática em localStorage.
 * Carrega o estado salvo na inicialização; se não houver, usa o init().
 */
export function usePersistentReducer(reducer, key, init) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignora dados corrompidos e cai no estado inicial */
    }
    return init();
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* armazenamento indisponível (modo privado etc.) */
    }
  }, [state, key]);

  return [state, dispatch];
}
