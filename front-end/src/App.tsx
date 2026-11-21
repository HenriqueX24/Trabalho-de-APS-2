import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Comprar } from './pages/Comprar';
import { Eventos } from './pages/Eventos';
import { Inicio } from './pages/Inicio';
import { MeusPedidos } from './pages/MeusPedidos';
import { OrgEventos } from './pages/OrgEventos';
import { OrgVendidos } from './pages/OrgVendidos';
import { Portaria } from './pages/Portaria';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        {/* Participante */}
        <Route path="eventos" element={<Eventos />} />
        <Route path="eventos/:id/comprar" element={<Comprar />} />
        <Route path="meus-pedidos" element={<MeusPedidos />} />
        {/* Organizador */}
        <Route path="organizador" element={<Navigate to="/organizador/eventos" replace />} />
        <Route path="organizador/eventos" element={<OrgEventos />} />
        <Route path="organizador/vendidos" element={<OrgVendidos />} />
        {/* Operador de portaria */}
        <Route path="portaria" element={<Portaria />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
