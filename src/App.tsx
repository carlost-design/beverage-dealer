import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Navigate, Route, Routes } from "react-router";
import AppShell from "./components/AppShell";
import { PageLoading } from "./components/ui";
import { LanguageSync } from "./i18n";
import ClientDetail from "./pages/ClientDetail";
import Clients from "./pages/Clients";
import CloseDay from "./pages/CloseDay";
import DeliveryArrived from "./pages/DeliveryArrived";
import Help from "./pages/Help";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import NewOrder from "./pages/NewOrder";
import OrderDetail from "./pages/OrderDetail";
import Orders from "./pages/Orders";
import Products from "./pages/Products";
import ReceivePayment from "./pages/ReceivePayment";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { TourProvider } from "./tour/TourProvider";

export default function App() {
  return (
    <>
      <AuthLoading>
        <div className="p-8">
          <PageLoading />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <Login />
      </Unauthenticated>
      <Authenticated>
        <LanguageSync />
        <TourProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="reports" element={<Reports />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/new" element={<NewOrder />} />
            <Route path="orders/:orderId" element={<OrderDetail />} />
            <Route path="orders/:orderId/edit" element={<NewOrder />} />
            <Route path="payments/new" element={<ReceivePayment />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="inventory/close" element={<CloseDay />} />
            <Route path="inventory/delivery" element={<DeliveryArrived />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:clientId" element={<ClientDetail />} />
            <Route path="products" element={<Products />} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<Help />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </TourProvider>
      </Authenticated>
    </>
  );
}
