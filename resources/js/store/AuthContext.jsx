import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await apiFetch("GET", "/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (login, password) => {
    setUser(await apiFetch("POST", "/login", { login, password }));
  }, []);

  const register = useCallback(async (payload) => {
    setUser(await apiFetch("POST", "/register", payload));
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("POST", "/logout").catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
