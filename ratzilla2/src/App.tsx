import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import InfectionStation from "./pages/InfectionStation";
import Transmission from "./pages/Transmission";

export default function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<Transmission />} />
        <Route path="/infection" element={<InfectionStation />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
