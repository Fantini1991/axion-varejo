export type Modulo = {
  title: string;
  path: string;
  description: string;
};

export type ModuloGroup = {
  title: string;
  color: string;
  children: Modulo[];
};

export const moduleGroups: ModuloGroup[] = [
  {
    title: "CADASTROS",
    color: "#38bdf8",
    children: [
      { title: "Produtos", path: "/cadastros/produtos", description: "Itens comercializados, com código, categoria, unidade e preço." },
      { title: "Clientes", path: "/cadastros/clientes", description: "Consumidor final e clientes recorrentes." },
      { title: "Fornecedores", path: "/cadastros/fornecedores", description: "Fornecedores de origem dos produtos." },
    ],
  },
  {
    title: "ESTOQUE",
    color: "#8b5cf6",
    children: [
      { title: "Movimentações e Saldo", path: "/estoque/movimentacoes", description: "Entradas, saídas, ajustes, saldo atual e controle de lote/validade." },
    ],
  },
  {
    title: "VENDAS",
    color: "#ec4899",
    children: [
      { title: "PDV — Venda de Balcão", path: "/loja/pdv", description: "Registro de venda direta ao consumidor final." },
      { title: "Histórico de Vendas", path: "/loja/vendas", description: "Todas as vendas registradas no PDV." },
    ],
  },
  {
    title: "COMPRAS",
    color: "#06b6d4",
    children: [
      { title: "Pedidos de Compra", path: "/compras/pedidos", description: "Pedidos enviados a fornecedores, pra conferir com a nota fiscal no recebimento." },
    ],
  },
  {
    title: "FINANCEIRO",
    color: "#22c55e",
    children: [
      { title: "Contas a Receber", path: "/financeiro/contas-receber", description: "Valores a receber de clientes." },
      { title: "Contas a Pagar", path: "/financeiro/contas-pagar", description: "Valores a pagar a fornecedores." },
      { title: "Despesas", path: "/financeiro/despesas", description: "Custos fixos e variáveis da operação — aluguel, salários, energia, marketing e outras contas." },
    ],
  },
  {
    title: "RELATÓRIOS",
    color: "#38bdf8",
    children: [
      { title: "BI — Painel Executivo", path: "/relatorios/bi", description: "Vendas, financeiro e estoque num só lugar." },
    ],
  },
  {
    title: "CONFIGURAÇÕES",
    color: "#64748b",
    children: [
      { title: "Empresa", path: "/config/empresa", description: "Dados da empresa e parâmetros gerais." },
      { title: "Aparência", path: "/config/aparencia", description: "Cor, tonalidade e densidade das informações nas telas do sistema." },
      { title: "Usuários", path: "/config/usuarios", description: "Usuários com acesso ao sistema." },
    ],
  },
];

export const flatModules: Modulo[] = moduleGroups.flatMap(g => g.children);

export const findModuleByPath = (path: string) => flatModules.find(m => m.path === path);

/** Admins sempre têm acesso total. `allowed_modules` nulo = acesso a tudo (padrão, compatível com usuários já existentes). */
export function podeAcessarModulo(role: string | undefined, allowedModules: string[] | null | undefined, path: string): boolean {
  if (role === "admin") return true;
  if (allowedModules == null) return true;
  return allowedModules.includes(path);
}
