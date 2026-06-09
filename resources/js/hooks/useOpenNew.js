import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

/**
 * Lê ?new=1 da URL para abrir automaticamente um modal de criação
 * (usado pelos atalhos do dashboard). Retorna [openNew, clearOpen].
 */
export function useOpenNew() {
  const [params, setParams] = useSearchParams();
  const openNew = params.get("new") === "1";
  const clearOpen = useCallback(() => {
    if (params.get("new")) {
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);
  return [openNew, clearOpen];
}
