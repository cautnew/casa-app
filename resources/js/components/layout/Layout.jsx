import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { MobileTopBar } from "./MobileTopBar.jsx";
import { MobileDrawer } from "./MobileDrawer.jsx";
import { useStore } from "../../store/StoreContext.jsx";

/** Casca da aplicação: sidebar fixa (desktop) + top bar + drawer (mobile). */
export function Layout() {
  const { loading, error } = useStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-8 text-center">
        <div>
          <p className="text-lg font-semibold text-rose-600">Não foi possível conectar ao servidor</p>
          <p className="mt-1 text-sm text-stone-500">Verifique se o backend Laravel está em execução na porta 8000.</p>
          <code className="mt-3 block rounded-xl bg-stone-100 px-4 py-2 text-xs text-stone-600">{error.message}</code>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-stone-900 border-t-transparent" />
          <p className="mt-3 text-sm text-stone-500">Carregando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-stone-50 text-stone-900">
      {/* ── Desktop: sidebar fixa lateral ──────────────────────────────── */}
      <Sidebar />

      {/* ── Mobile: top bar fixa + gaveta lateral ──────────────────────── */}
      <MobileTopBar onOpen={() => setDrawerOpen(true)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ── Conteúdo principal ─────────────────────────────────────────── */}
      {/* pt-16 no mobile compensa a top bar fixa (h-14 = 56px + 8px folga) */}
      <main className="flex-1 px-4 pb-10 pt-16 sm:px-8 lg:pt-6">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
