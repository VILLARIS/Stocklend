import { Package } from "lucide-react";

function App() {
  return (
    <div className="flex h-screen items-center justify-center bg-page">
      <div className="text-center space-y-4">
        <Package className="mx-auto h-16 w-16 text-brand" />
        <h1 className="text-3xl font-semibold text-text">StockLend</h1>
        <p className="text-text-secondary">Tauri + React + Tailwind CSS funcionando correctamente.</p>
      </div>
    </div>
  );
}

export default App;
