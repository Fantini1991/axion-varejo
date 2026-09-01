import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Package, Wallet, Landmark, AlertTriangle, DollarSign, Receipt } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import { listRecords, type PersistedRecord } from "../services/persistence";
import { simularFifo, type MovimentacaoEstoque } from "../utils/estoqueFifo";

type Venda = { total: number; itens: { produto: string; quantidade: number; precoUnit: number }[]; createdAtStr?: string };
type ContaPagar = { valor: number; status: string };
type ContaReceber = { valor: number; status: string };
type Produto = { codigo: string; nome: string; custoCompra?: number; percentualImposto?: number };
type Despesa = { categoria: string; valor: number; data: string };

const PERIODOS = [7, 15, 30, 60, 90];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function BarChart({ data, color }: { data: { label: string; valor: number }[]; color: string }) {
  const max = Math.max(1, ...data.map(d => d.valor));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140, padding: "0 4px", overflowX: "auto" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: "1 0 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${d.label}: ${fmt(d.valor)}`}>
          <div style={{ width: "100%", height: Math.max(2, (d.valor / max) * 120), background: `color-mix(in srgb, ${color} 70%, transparent)`, borderRadius: "3px 3px 0 0" }} />
          <span style={{ fontSize: 9, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function BI() {
  const [vendas, setVendas] = useState<PersistedRecord<Venda>[]>([]);
  const [contasPagar, setContasPagar] = useState<PersistedRecord<ContaPagar>[]>([]);
  const [contasReceber, setContasReceber] = useState<PersistedRecord<ContaReceber>[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<PersistedRecord<MovimentacaoEstoque>[]>([]);
  const [produtos, setProdutos] = useState<PersistedRecord<Produto>[]>([]);
  const [despesas, setDespesas] = useState<PersistedRecord<Despesa>[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoDias, setPeriodoDias] = useState(30);

  useEffect(() => {
    Promise.all([
      listRecords<Venda>("pdv-vendas"),
      listRecords<ContaPagar>("contas-pagar"),
      listRecords<ContaReceber>("contas-receber"),
      listRecords<MovimentacaoEstoque>("estoque-movimentacoes"),
      listRecords<Produto>("produtos"),
      listRecords<Despesa>("despesas"),
    ]).then(([v, cp, cr, mv, pr, ds]) => {
      setVendas(v);
      setContasPagar(cp);
      setContasReceber(cr);
      setMovimentacoes(mv);
      setProdutos(pr);
      setDespesas(ds);
      setLoading(false);
    });
  }, []);

  const dataCorte = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodoDias);
    return d.toISOString().slice(0, 10);
  }, [periodoDias]);

  const vendasPorDia = useMemo(() => {
    const map = new Map<string, number>();
    const hoje = new Date();
    for (let i = periodoDias - 1; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const v of vendas) {
      const dia = v.createdAt.slice(0, 10);
      if (map.has(dia)) map.set(dia, (map.get(dia) ?? 0) + v.data.total);
    }
    return Array.from(map.entries()).map(([dia, valor]) => ({ label: dia.slice(8, 10), valor }));
  }, [vendas, periodoDias]);

  const vendasNoPeriodo = useMemo(() => vendas.filter(v => v.createdAt.slice(0, 10) >= dataCorte), [vendas, dataCorte]);

  const produtosMaisVendidos = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vendasNoPeriodo) {
      for (const item of v.data.itens ?? []) {
        map.set(item.produto, (map.get(item.produto) ?? 0) + item.quantidade * item.precoUnit);
      }
    }
    return Array.from(map.entries()).map(([produto, valor]) => ({ produto, valor })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [vendasNoPeriodo]);

  const totalVendasPeriodo = vendasPorDia.reduce((s, d) => s + d.valor, 0);
  const totalReceber = contasReceber.filter(c => c.data.status !== "Pago").reduce((s, c) => s + c.data.valor, 0);
  const totalPagar = contasPagar.filter(c => c.data.status !== "Pago").reduce((s, c) => s + c.data.valor, 0);

  // Código do produto (parte antes do " — " no label "codigo — nome") — usado como chave estável pra
  // achar o produto de uma venda/movimentação antiga, já que o "nome" pode ter sido editado depois
  // (o label completo guardado na venda/movimentação fica com o nome de quando ela foi feita).
  const codigoDoLabel = (label: string) => label.split(" — ")[0]?.trim() ?? label;

  // Custo real das saídas de estoque no período, calculado por FEFO a partir das entradas registradas
  // (mesmo motor usado em Movimentações) — cai pro custoCompra cadastrado no produto só quando não há
  // entrada com custo pra debitar (produto vendido sem nunca ter passado por um recebimento no sistema).
  const custoProdutosVendidosPeriodo = useMemo(() => {
    const custoPorCodigo = new Map<string, number>();
    for (const p of produtos) custoPorCodigo.set(p.data.codigo, Number(p.data.custoCompra ?? 0));
    const { custoSaidas } = simularFifo(movimentacoes);
    let total = 0;
    for (const m of movimentacoes) {
      if (m.data.tipo !== "Saída") continue;
      if (m.createdAt.slice(0, 10) < dataCorte) continue;
      const consumo = custoSaidas.get(m.id);
      const custoUnitario = consumo?.custoMedio ?? custoPorCodigo.get(codigoDoLabel(m.data.produto)) ?? 0;
      total += custoUnitario * m.data.quantidade;
    }
    return total;
  }, [movimentacoes, produtos, dataCorte]);

  const despesasPeriodo = useMemo(
    () => despesas.filter(d => d.data.data >= dataCorte).reduce((s, d) => s + Number(d.data.valor ?? 0), 0),
    [despesas, dataCorte],
  );

  // Imposto embutido no preço de cada produto vendido (mesmo % cadastrado em Produtos, usado no cálculo
  // de margem lá) — sem descontar isso, o "lucro" fica inflado pela fatia que na verdade é imposto a recolher.
  const impostoProdutosVendidosPeriodo = useMemo(() => {
    const impostoPorCodigo = new Map<string, number>();
    for (const p of produtos) impostoPorCodigo.set(p.data.codigo, Number(p.data.percentualImposto ?? 0));
    let total = 0;
    for (const v of vendasNoPeriodo) {
      for (const item of v.data.itens ?? []) {
        const imposto = impostoPorCodigo.get(codigoDoLabel(item.produto)) ?? 0;
        total += item.quantidade * item.precoUnit * (imposto / 100);
      }
    }
    return total;
  }, [vendasNoPeriodo, produtos]);

  const lucroPeriodo = totalVendasPeriodo - custoProdutosVendidosPeriodo - impostoProdutosVendidosPeriodo - despesasPeriodo;

  const despesasPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of despesas) {
      if (d.data.data < dataCorte) continue;
      map.set(d.data.categoria, (map.get(d.data.categoria) ?? 0) + Number(d.data.valor ?? 0));
    }
    return Array.from(map.entries()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [despesas, dataCorte]);

  const saldoEstoque = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movimentacoes) {
      const atual = map.get(m.data.produto) ?? 0;
      map.set(m.data.produto, atual + (m.data.tipo === "Saída" ? -m.data.quantidade : m.data.quantidade));
    }
    return Array.from(map.entries()).map(([produto, saldo]) => ({ produto, saldo })).filter(p => p.saldo < 10).sort((a, b) => a.saldo - b.saldo);
  }, [movimentacoes]);

  const card: React.CSSProperties = { padding: "18px 20px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" };
  const periodoBtn = (active: boolean): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    border: "1px solid " + (active ? "var(--accent)" : "var(--border-strong)"),
    background: active ? "color-mix(in srgb, var(--accent) 16%, var(--surface-input))" : "var(--surface-input)",
    color: active ? "var(--text-strong)" : "var(--text-muted)",
  });

  return (
    <MainLayout>
      <div className="module-hero">
        <div>
          <span>Relatórios</span>
          <h1>BI — Painel Executivo</h1>
          <p>Vendas, financeiro e estoque num só lugar.</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Período</span>
        {PERIODOS.map(p => (
          <button key={p} style={periodoBtn(periodoDias === p)} onClick={() => setPeriodoDias(p)}>{p} dias</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#4ade80", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}><TrendingUp size={14} /> Vendas ({periodoDias} dias)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-strong)", marginTop: 6 }}>{fmt(totalVendasPeriodo)}</div>
            </div>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#38bdf8", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}><Wallet size={14} /> A receber (pendente)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-strong)", marginTop: 6 }}>{fmt(totalReceber)}</div>
            </div>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f87171", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}><Landmark size={14} /> A pagar (pendente)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-strong)", marginTop: 6 }}>{fmt(totalPagar)}</div>
            </div>
            <div style={card} title="Vendas do período − custo real dos produtos vendidos (FEFO) − imposto de cada produto (cadastro) − despesas do período">
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: lucroPeriodo >= 0 ? "#4ade80" : "var(--danger)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}><DollarSign size={14} /> Lucro ({periodoDias} dias)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: lucroPeriodo >= 0 ? "var(--text-strong)" : "var(--danger)", marginTop: 6 }}>{fmt(lucroPeriodo)}</div>
            </div>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fb923c", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}><Receipt size={14} /> Despesas ({periodoDias} dias)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-strong)", marginTop: 6 }}>{fmt(despesasPeriodo)}</div>
            </div>
          </div>

          <div className="panel">
            <h2 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-strong)" }}>Vendas por dia — últimos {periodoDias} dias</h2>
            <BarChart data={vendasPorDia} color="#38bdf8" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            <div className="panel">
              <h2 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-strong)", display: "flex", alignItems: "center", gap: 8 }}><Package size={16} /> Produtos mais vendidos</h2>
              {produtosMaisVendidos.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Sem vendas registradas no período.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {produtosMaisVendidos.map(p => (
                    <div key={p.produto} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                      <span style={{ color: "var(--text-strong)" }}>{p.produto}</span>
                      <span style={{ fontWeight: 700, color: "#4ade80" }}>{fmt(p.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <h2 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-strong)", display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle size={16} color="#f59e0b" /> Estoque baixo (&lt; 10 un.)</h2>
              {saldoEstoque.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Nenhum produto com saldo baixo.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {saldoEstoque.map(p => (
                    <div key={p.produto} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                      <span style={{ color: "var(--text-strong)" }}>{p.produto}</span>
                      <span style={{ fontWeight: 700, color: p.saldo < 0 ? "var(--danger)" : "#f59e0b" }}>{p.saldo}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <h2 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-strong)", display: "flex", alignItems: "center", gap: 8 }}><Receipt size={16} color="#fb923c" /> Despesas por categoria — {periodoDias} dias</h2>
              {despesasPorCategoria.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Nenhuma despesa registrada no período.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {despesasPorCategoria.map(d => (
                    <div key={d.categoria} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                      <span style={{ color: "var(--text-strong)" }}>{d.categoria}</span>
                      <span style={{ fontWeight: 700, color: "#fb923c" }}>{fmt(d.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
