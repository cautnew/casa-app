import { Routes, Route } from "react-router-dom";
import { StoreProvider } from "./store/StoreContext.jsx";
import { ToastProvider } from "./hooks/useToast.jsx";
import { Layout } from "./components/layout/Layout.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Members } from "./pages/Members.jsx";
import { Purchases } from "./pages/Purchases.jsx";
import { Inventory } from "./pages/Inventory.jsx";
import { ShoppingList } from "./pages/ShoppingList.jsx";
import { Prices } from "./pages/Prices.jsx";
import { Bills } from "./pages/Bills.jsx";
import { Analytics } from "./pages/Analytics.jsx";

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="integrantes" element={<Members />} />
            <Route path="compras" element={<Purchases />} />
            <Route path="inventario" element={<Inventory />} />
            <Route path="lista" element={<ShoppingList />} />
            <Route path="precos" element={<Prices />} />
            <Route path="contas" element={<Bills />} />
            <Route path="analises" element={<Analytics />} />
          </Route>
        </Routes>
      </ToastProvider>
    </StoreProvider>
  );
}
