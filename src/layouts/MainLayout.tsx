import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Home, Package, Users, Truck, Boxes, ShoppingBag, ShoppingCart, Wallet, Landmark, Receipt, Building2, UserCog, History, Sliders, BarChart3, Menu, ChevronsLeft, ChevronsRight, type LucideIcon } from "lucide-react";
import { moduleGroups, podeAcessarModulo } from "../data/modules";
import { useAuth } from "../contexts/AuthContext";

const iconByTitle: Record<string, LucideIcon> = {
  "Produtos": Package,
  "Clientes": Users,
  "Fornecedores": Truck,
  "Movimentações e Saldo": Boxes,
  "PDV — Venda de Balcão": ShoppingBag,
  "Histórico de Vendas": History,
  "Pedidos de Compra": ShoppingCart,
  "Contas a Receber": Wallet,
  "Contas a Pagar": Landmark,
  "Despesas": Receipt,
  "Empresa": Building2,
  "Aparência": Sliders,
  "BI — Painel Executivo": BarChart3,
  "Usuários": UserCog,
};

const SIDEBAR_COLLAPSED_KEY = "axion-varejo-sidebar-collapsed";

export default function MainLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth > 860);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 861px)");
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Só recolhe de verdade em telas largas — no celular o menu é uma gaveta, sempre com texto.
  const collapsedEfetivo = collapsed && isDesktop;

  function toggleCollapsed() {
    setCollapsed(c => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, c ? "0" : "1");
      return !c;
    });
  }

  return (
    <div className="app-shell" style={{ "--sidebar-width": collapsedEfetivo ? "68px" : "260px" } as React.CSSProperties}>
      <div className="mobile-topbar">
        <button onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={18} /></button>
        <strong style={{ color: "var(--text-strong)", fontSize: 14 }}>AXION VAREJO</strong>
      </div>

      {mobileOpen && <div className="sidebar-overlay mobile-open" onClick={() => setMobileOpen(false)} />}

      <aside className={[mobileOpen ? "sidebar mobile-open" : "sidebar", collapsedEfetivo ? "collapsed" : ""].join(" ").trim()}>
        <button type="button" onClick={toggleCollapsed} className="sidebar-collapse-btn" title={collapsed ? "Expandir menu" : "Recolher menu"}>
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>

        <div className="brand">
          <div className="brand-mark">AV</div>
          {!collapsedEfetivo && (
            <div>
              <strong>AXION VAREJO</strong>
              <span>Mercado &amp; Material de Construção</span>
            </div>
          )}
        </div>

        <Link to="/" className={pathname === "/" ? "nav-item active" : "nav-item"} title={collapsedEfetivo ? "Início" : undefined}>
          <span className="nav-icon"><Home size={15} /></span>
          {!collapsedEfetivo && "Início"}
        </Link>

        <div className="nav-list">
          {moduleGroups.map(group => {
            const visiveis = group.children.filter(m => podeAcessarModulo(profile?.role, profile?.allowed_modules, m.path));
            if (visiveis.length === 0) return null;
            return (
              <div key={group.title}>
                {!collapsedEfetivo && <div className="nav-group-title">{group.title}</div>}
                {visiveis.map(m => {
                  const Icon = iconByTitle[m.title] ?? Package;
                  const active = pathname === m.path;
                  return (
                    <Link key={m.path} to={m.path} className={active ? "nav-item active" : "nav-item"} title={collapsedEfetivo ? m.title : undefined}>
                      <span className="nav-icon"><Icon size={15} /></span>
                      {!collapsedEfetivo && m.title}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="sidebar-footer">
          {!collapsedEfetivo && <span>{profile?.full_name ?? "Usuário"}</span>}
          <button onClick={signOut} title="Sair"><LogOut size={14} /></button>
        </div>
      </aside>

      <div className="workspace">
        <main>
          <div className="content-area">{children}</div>
        </main>
      </div>
    </div>
  );
}
