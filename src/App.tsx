
import { HashRouter, Routes, Route } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout";

import { DashboardV2 as Dashboard } from "./pages/DashboardV2";
import { InventoryPage } from "./pages/InventoryPage";
import { StudentsPage } from "./pages/StudentsPage";
import { LoansPage } from "./pages/LoansPage";
import { PendingPage } from "./pages/PendingPage";
import { ReturnsPage } from "./pages/ReturnsPage";
import { IncidentsPage } from "./pages/IncidentsPage";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={<Dashboard />}
          />

          <Route
            path="/inventario"
            element={<InventoryPage />}
          />

          <Route
            path="/estudiantes"
            element={<StudentsPage />}
          />

          {/* PRÉSTAMOS: NUEVO DISEÑO */}
          <Route
            path="/prestamos"
            element={<LoansPage />}
          />

          <Route
            path="/devoluciones" element={<ReturnsPage />} />

          <Route
            path="/incidentes"
            element={<IncidentsPage />}
          />

          <Route
            path="/reportes"
            element={
              <PendingPage
                title="Reportes"
                subtitle="Historial, filtros y exportaciones"
              />
            }
          />

          <Route
            path="/configuracion"
            element={
              <PendingPage
                title="Configuración"
                subtitle="Preferencias de la aplicación"
              />
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
