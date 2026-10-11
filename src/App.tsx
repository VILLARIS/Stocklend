import { HashRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { InventoryPage } from "./pages/InventoryPage";
import { PendingPage } from "./pages/PendingPage";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventario" element={<InventoryPage />} />
          <Route path="/estudiantes" element={<PendingPage title="Estudiantes" subtitle="Directorio de estudiantes y sus préstamos" />} />
          <Route path="/prestamos" element={<PendingPage title="Préstamos" subtitle="Registro de entregas a estudiantes" />} />
          <Route path="/devoluciones" element={<PendingPage title="Devoluciones" subtitle="Registro de devoluciones de equipos" />} />
          <Route path="/incidentes" element={<PendingPage title="Incidentes" subtitle="Control de daños, pérdidas y alertas" />} />
          <Route path="/reportes" element={<PendingPage title="Reportes" subtitle="Historial, filtros y exportaciones" />} />
          <Route path="/configuracion" element={<PendingPage title="Configuración" subtitle="Preferencias de la aplicación" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;