import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { podeAcessarModulo } from "./data/modules";
import Login from "./pages/Login";
import RedefinirSenha from "./pages/RedefinirSenha";
import Dashboard from "./pages/Dashboard";
import Produtos from "./pages/cadastros/Produtos";
import Clientes from "./pages/cadastros/Clientes";
import Fornecedores from "./pages/cadastros/Fornecedores";
import Movimentacoes from "./pages/estoque/Movimentacoes";
import Pdv from "./pages/loja/Pdv";
import HistoricoVendas from "./pages/loja/HistoricoVendas";
import PedidosCompra from "./pages/compras/PedidosCompra";
import ContasReceber from "./pages/financeiro/ContasReceber";
import ContasPagar from "./pages/financeiro/ContasPagar";
import Despesas from "./pages/financeiro/Despesas";
import Empresa from "./pages/config/Empresa";
import BI from "./pages/BI";
import Aparencia from "./pages/config/Aparencia";
import Usuarios from "./pages/config/Usuarios";

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading, mfaPending, profile } = useAuth();
  const { pathname } = useLocation();
  if (loading) return null;
  if (!session || mfaPending) return <Navigate to="/login" replace />;
  if (pathname !== "/" && !podeAcessarModulo(profile?.role, profile?.allowed_modules, pathname)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />

      <Route path="/cadastros/produtos" element={<Protected><Produtos /></Protected>} />
      <Route path="/cadastros/clientes" element={<Protected><Clientes /></Protected>} />
      <Route path="/cadastros/fornecedores" element={<Protected><Fornecedores /></Protected>} />

      <Route path="/estoque/movimentacoes" element={<Protected><Movimentacoes /></Protected>} />

      <Route path="/loja/pdv" element={<Protected><Pdv /></Protected>} />
      <Route path="/loja/vendas" element={<Protected><HistoricoVendas /></Protected>} />

      <Route path="/compras/pedidos" element={<Protected><PedidosCompra /></Protected>} />

      <Route path="/financeiro/contas-receber" element={<Protected><ContasReceber /></Protected>} />
      <Route path="/financeiro/contas-pagar" element={<Protected><ContasPagar /></Protected>} />
      <Route path="/financeiro/despesas" element={<Protected><Despesas /></Protected>} />

      <Route path="/relatorios/bi" element={<Protected><BI /></Protected>} />

      <Route path="/config/empresa" element={<Protected><Empresa /></Protected>} />
      <Route path="/config/aparencia" element={<Protected><Aparencia /></Protected>} />
      <Route path="/config/usuarios" element={<Protected><Usuarios /></Protected>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
