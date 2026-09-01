import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Upload, AlertTriangle, CheckCircle2, PackageSearch, ArrowLeftRight, PackagePlus } from "lucide-react";
import MainLayout from "../../layouts/MainLayout";
import { listRecords, createRecord, updateRecord, deleteRecord, type PersistedRecord } from "../../services/persistence";
import { parseNFeXml, normalizarCnpj, type NFeParsed, type NFeItem } from "../../utils/nfeParser";
import { simularFifo, formatDataBR, type LoteInfo } from "../../utils/estoqueFifo";
import type { PedidoCompra } from "../compras/PedidosCompra";

type Movimentacao = {
  produto: string;
  tipo: "Entrada" | "Saída" | "Ajuste";
  quantidade: number;
  motivo: string;
  custoUnitario?: number;
  fornecedor?: string;
  numeroNota?: string;
  lote?: string;
  validade?: string;
};

const empty: Movimentacao = { produto: "", tipo: "Entrada", quantidade: 0, motivo: "" };

type ImportRow = {
  nfeItem: NFeItem;
  produto: string;
  ultimoCusto: number | null;
  pedidoId: string | null;
  pedidoItemIdx: number | null;
  pedidoQuantidade: number | null;
  pedidoPreco: number | null;
  lote: string;
  validade: string;
};

type Saldo = { produto: string; entradas: number; saidas: number; saldo: number };

function calcularSaldos(rows: PersistedRecord<Movimentacao>[]): Saldo[] {
  const map = new Map<string, { entradas: number; saidas: number }>();
  for (const r of rows) {
    const produto = String(r.data.produto ?? "—");
    const tipo = String(r.data.tipo ?? "");
    const qtd = Number(r.data.quantidade ?? 0);
    const atual = map.get(produto) ?? { entradas: 0, saidas: 0 };
    if (tipo === "Saída") atual.saidas += qtd;
    else atual.entradas += qtd; // Entrada e Ajuste positivo somam ao saldo
    map.set(produto, atual);
  }
  return Array.from(map.entries())
    .map(([produto, v]) => ({ produto, entradas: v.entradas, saidas: v.saidas, saldo: v.entradas - v.saidas }))
    .sort((a, b) => a.produto.localeCompare(b.produto));
}

export default function Movimentacoes() {
  const [view, setView] = useState<"movimentacoes" | "saldo">("movimentacoes");
  const [rows, setRows] = useState<PersistedRecord<Movimentacao>[]>([]);
  const [produtos, setProdutos] = useState<PersistedRecord[]>([]);
  const [fornecedores, setFornecedores] = useState<PersistedRecord[]>([]);
  const [pedidos, setPedidos] = useState<PersistedRecord<PedidoCompra>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const saldos = useMemo(() => calcularSaldos(rows), [rows]);
  const { lotes, custoSaidas } = useMemo(() => simularFifo(rows), [rows]);

  const [editing, setEditing] = useState<PersistedRecord<Movimentacao> | null>(null);
  const [form, setForm] = useState<Movimentacao>(empty);
  const [showForm, setShowForm] = useState(false);
  const [recebimentoMode, setRecebimentoMode] = useState(false);
  const [showRecebimentoChooser, setShowRecebimentoChooser] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [parsed, setParsed] = useState<NFeParsed | null>(null);
  const [fornecedorId, setFornecedorId] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [mv, pr, fo, pc] = await Promise.all([
        listRecords<Movimentacao>("estoque-movimentacoes"),
        listRecords("produtos"),
        listRecords("fornecedores"),
        listRecords<PedidoCompra>("pedidos-compra"),
      ]);
      setRows(mv);
      setProdutos(pr);
      setFornecedores(fo);
      setPedidos(pc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function produtoLabel(p: PersistedRecord): string {
    return `${p.data.codigo} — ${p.data.nome}`;
  }

  function ultimoCustoDoProduto(produto: string): number | null {
    const entradas = rows
      .filter(r => r.data.produto === produto && r.data.tipo === "Entrada" && typeof r.data.custoUnitario === "number")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return entradas[0]?.data.custoUnitario ?? null;
  }

  function acharPedidoAberto(fornecedorNome: string, produto: string) {
    for (const p of pedidos) {
      if (p.data.status !== "Aberto" && p.data.status !== "Parcial") continue;
      if (p.data.fornecedor !== fornecedorNome) continue;
      const idx = (p.data.itens ?? []).findIndex(it => it.produto === produto && it.quantidadeRecebida < it.quantidade);
      if (idx >= 0) {
        const item = p.data.itens[idx];
        return { pedidoId: p.id, pedidoItemIdx: idx, pedidoQuantidade: item.quantidade, pedidoPreco: item.precoAcordado };
      }
    }
    return { pedidoId: null, pedidoItemIdx: null, pedidoQuantidade: null, pedidoPreco: null };
  }

  // ── Movimentação manual ──────────────────────────────────────────────────

  function openNew() {
    setEditing(null);
    setForm(empty);
    setRecebimentoMode(false);
    setShowForm(true);
  }

  function openRecebimento() {
    setShowRecebimentoChooser(true);
  }

  function openRecebimentoManual() {
    setShowRecebimentoChooser(false);
    setEditing(null);
    setForm({ ...empty, tipo: "Entrada" });
    setRecebimentoMode(true);
    setShowForm(true);
  }

  function openEdit(r: PersistedRecord<Movimentacao>) {
    setEditing(r);
    setForm({ ...empty, ...r.data });
    setRecebimentoMode(false);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!form.produto) throw new Error("Selecione o produto.");
      if (editing) await updateRecord("estoque-movimentacoes", editing.id, form);
      else await createRecord("estoque-movimentacoes", form);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta movimentação?")) return;
    await deleteRecord("estoque-movimentacoes", id);
    await load();
  }

  // ── Importação de NF-e (XML) ─────────────────────────────────────────────

  function openImport() {
    setShowRecebimentoChooser(false);
    setParsed(null);
    setImportRows([]);
    setFornecedorId("");
    setImportError("");
    setShowImport(true);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    try {
      const text = await file.text();
      const nfe = parseNFeXml(text);
      setParsed(nfe);

      const cnpjNota = normalizarCnpj(nfe.fornecedorCnpj);
      const matched = fornecedores.find(f => normalizarCnpj(String(f.data.cnpj ?? "")) === cnpjNota && cnpjNota);
      setFornecedorId(matched?.id ?? "");

      const mapeamento = (matched?.data.mapeamentoProdutos ?? {}) as Record<string, string>;
      const fornecedorNome = matched ? String(matched.data.nome) : "";

      const built: ImportRow[] = nfe.itens.map(item => {
        const produto = mapeamento[item.codigoFornecedor] ?? "";
        const pedido = produto ? acharPedidoAberto(fornecedorNome, produto) : { pedidoId: null, pedidoItemIdx: null, pedidoQuantidade: null, pedidoPreco: null };
        return {
          nfeItem: item,
          produto,
          ultimoCusto: produto ? ultimoCustoDoProduto(produto) : null,
          lote: item.lote ?? "",
          validade: item.validade ?? "",
          ...pedido,
        };
      });
      setImportRows(built);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Erro ao ler o XML.");
    }
  }

  function updateImportRowProduto(idx: number, produto: string) {
    setImportRows(rowsState => rowsState.map((r, i) => {
      if (i !== idx) return r;
      const fornecedorNome = fornecedores.find(f => f.id === fornecedorId)?.data.nome as string | undefined;
      const pedido = produto && fornecedorNome ? acharPedidoAberto(fornecedorNome, produto) : { pedidoId: null, pedidoItemIdx: null, pedidoQuantidade: null, pedidoPreco: null };
      return { ...r, produto, ultimoCusto: produto ? ultimoCustoDoProduto(produto) : null, ...pedido };
    }));
  }

  function updateImportRowLote(idx: number, patch: Partial<Pick<ImportRow, "lote" | "validade">>) {
    setImportRows(rowsState => rowsState.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function confirmarImportacao() {
    if (!parsed) return;
    const fornecedorRec = fornecedores.find(f => f.id === fornecedorId);
    if (!fornecedorRec) { setImportError("Selecione o fornecedor desta nota."); return; }

    const validas = importRows.filter(r => r.produto);
    if (validas.length === 0) { setImportError("Associe ao menos um item a um produto do cadastro."); return; }

    setImporting(true);
    setImportError("");
    try {
      const fornecedorNome = String(fornecedorRec.data.nome);
      const novoMapeamento: Record<string, string> = { ...(fornecedorRec.data.mapeamentoProdutos as Record<string, string> ?? {}) };
      const pedidosParaAtualizar = new Map<string, PedidoCompra>();

      for (const row of validas) {
        await createRecord("estoque-movimentacoes", {
          produto: row.produto,
          tipo: "Entrada",
          quantidade: row.nfeItem.quantidade,
          motivo: `NF-e ${parsed.numeroNota} — ${fornecedorNome}`,
          custoUnitario: row.nfeItem.valorUnitario,
          fornecedor: fornecedorNome,
          numeroNota: parsed.numeroNota,
          lote: row.lote || undefined,
          validade: row.validade || undefined,
        } satisfies Movimentacao);

        if (!novoMapeamento[row.nfeItem.codigoFornecedor]) {
          novoMapeamento[row.nfeItem.codigoFornecedor] = row.produto;
        }

        const produtoRec = produtos.find(p => produtoLabel(p) === row.produto);
        if (produtoRec) {
          await updateRecord("produtos", produtoRec.id, { ...produtoRec.data, custoCompra: row.nfeItem.valorUnitario });
        }

        if (row.pedidoId && row.pedidoItemIdx !== null) {
          const pedidoAtual = pedidosParaAtualizar.get(row.pedidoId)
            ?? { ...pedidos.find(p => p.id === row.pedidoId)!.data, itens: [...pedidos.find(p => p.id === row.pedidoId)!.data.itens] };
          const item = pedidoAtual.itens[row.pedidoItemIdx];
          pedidoAtual.itens[row.pedidoItemIdx] = { ...item, quantidadeRecebida: item.quantidadeRecebida + row.nfeItem.quantidade };
          pedidoAtual.status = pedidoAtual.itens.every(it => it.quantidadeRecebida >= it.quantidade) ? "Recebido" : "Parcial";
          pedidosParaAtualizar.set(row.pedidoId, pedidoAtual);
        }
      }

      // Atualiza o de-para de produtos e o CNPJ do fornecedor (se ainda não tinha).
      const fornecedorPatch: Record<string, unknown> = { ...fornecedorRec.data, mapeamentoProdutos: novoMapeamento };
      if (!fornecedorRec.data.cnpj && parsed.fornecedorCnpj) fornecedorPatch.cnpj = parsed.fornecedorCnpj;
      await updateRecord("fornecedores", fornecedorRec.id, fornecedorPatch);

      for (const [pedidoId, data] of pedidosParaAtualizar) {
        await updateRecord("pedidos-compra", pedidoId, data);
      }

      setShowImport(false);
      await load();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Erro ao confirmar importação.");
    } finally {
      setImporting(false);
    }
  }

  const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-input)", color: "var(--text-strong)", fontSize: 13.5, width: "100%" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
    border: "1px solid " + (active ? "var(--accent)" : "var(--border-strong)"),
    background: active ? "color-mix(in srgb, var(--accent) 16%, var(--surface-input))" : "var(--surface-input)",
    color: active ? "var(--text-strong)" : "var(--text-muted)",
  });

  const loteStatusColor: Record<LoteInfo["status"], string> = { vencido: "#f87171", "vence-em-breve": "#f59e0b", ok: "#4ade80" };
  const loteStatusLabel: Record<LoteInfo["status"], string> = { vencido: "Vencido", "vence-em-breve": "Vence em breve", ok: "OK" };

  return (
    <MainLayout>
      <div className="module-hero">
        <div>
          <span>Estoque</span>
          <h1>Movimentações e Saldo</h1>
          <p>Entradas, saídas, ajustes, saldo atual e controle de lote/validade — tudo na mesma tela.</p>
        </div>
        {view === "movimentacoes" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={openRecebimento} className="btn btn-save">
              <PackagePlus size={15} /> Registrar recebimento
            </button>
            <button onClick={openNew} className="btn">
              <Plus size={15} /> Outra movimentação
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={tabBtn(view === "movimentacoes")} onClick={() => setView("movimentacoes")}>
          <ArrowLeftRight size={14} /> Movimentações
        </button>
        <button style={tabBtn(view === "saldo")} onClick={() => setView("saldo")}>
          <PackageSearch size={14} /> Saldo e validade
        </button>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {view === "movimentacoes" ? (
        <div className="panel" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>PRODUTO</th>
                <th>TIPO</th>
                <th>QUANTIDADE</th>
                <th>CUSTO UNIT.</th>
                <th>LOTE</th>
                <th>VALIDADE</th>
                <th>MOTIVO</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhuma movimentação ainda.</td></tr>}
              {rows.map(r => {
                const consumo = r.data.tipo === "Saída" ? custoSaidas.get(r.id) : null;
                const custo = r.data.tipo === "Entrada" ? r.data.custoUnitario : consumo?.custoMedio;
                const lote = r.data.tipo === "Entrada" ? r.data.lote : consumo?.lotes.filter(l => l !== "(sem lote)").join(", ");
                const validade = r.data.tipo === "Entrada" ? r.data.validade : consumo?.validades[0];
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-strong)" }}>{r.data.produto}</td>
                    <td>{r.data.tipo}</td>
                    <td>{r.data.quantidade}</td>
                    <td title={r.data.tipo === "Saída" && custo != null ? "Custo médio ponderado dos lotes debitados (FEFO)" : undefined}>
                      {custo != null ? Number(custo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                    </td>
                    <td title={r.data.tipo === "Saída" && lote ? "Lote(s) de onde essa saída foi debitada (FEFO)" : undefined}>{lote || "—"}</td>
                    <td>{validade ? formatDataBR(validade) : "—"}</td>
                    <td>{r.data.motivo || "—"}</td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEdit(r)} className="icon-btn"><Pencil size={15} /></button>
                      <button onClick={() => handleDelete(r.id)} className="icon-btn" style={{ color: "var(--danger)" }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="panel" style={{ padding: 0, overflow: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>PRODUTO</th>
                  <th>ENTRADAS</th>
                  <th>SAÍDAS</th>
                  <th>SALDO ATUAL</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
                {!loading && saldos.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhuma movimentação registrada ainda.</td></tr>}
                {saldos.map(s => (
                  <tr key={s.produto}>
                    <td style={{ fontWeight: 600, color: "var(--text-strong)" }}>{s.produto}</td>
                    <td style={{ color: "#4ade80" }}>+{s.entradas}</td>
                    <td style={{ color: "#f87171" }}>-{s.saidas}</td>
                    <td style={{ fontWeight: 700, color: s.saldo < 0 ? "var(--danger)" : "var(--text-strong)" }}>{s.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", marginBottom: 10 }}>Lotes e validade (FEFO)</h2>
            <div className="panel" style={{ padding: 0, overflow: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PRODUTO</th>
                    <th>LOTE</th>
                    <th>RECEBIDA</th>
                    <th>SALDO NO LOTE</th>
                    <th>VALIDADE</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && lotes.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhum lote com saldo em estoque no momento.</td></tr>}
                  {lotes.map((l, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: "var(--text-strong)" }}>{l.produto}</td>
                      <td>{l.lote}</td>
                      <td style={{ color: "var(--text-muted)" }}>{l.recebida}</td>
                      <td style={{ fontWeight: 700, color: "var(--text-strong)" }}>{l.restante}</td>
                      <td>{formatDataBR(l.validade)}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: loteStatusColor[l.status], background: `${loteStatusColor[l.status]}18`, border: `1px solid ${loteStatusColor[l.status]}44` }}>
                          {loteStatusLabel[l.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>
              Controle FEFO (vence primeiro, sai primeiro): cada saída é debitada automaticamente do lote com validade mais próxima. "Saldo no lote" já reflete essas baixas — lotes zerados somem da lista. Entradas sem lote/validade informados são consumidas por último, na ordem em que entraram.
            </p>
          </div>
        </div>
      )}

      {showRecebimentoChooser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div className="panel" style={{ width: 380, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>Registrar recebimento</h2>
              <button type="button" onClick={() => setShowRecebimentoChooser(false)} className="icon-btn"><X size={18} /></button>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Como você quer registrar essa entrada de mercadoria?</p>
            <button type="button" onClick={openImport} className="btn" style={{ justifyContent: "flex-start", padding: "14px 16px", gap: 12 }}>
              <Upload size={18} />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span style={{ fontWeight: 700 }}>Importar XML da NF-e</span>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 400 }}>Preenche produto, custo, lote e validade a partir da nota</span>
              </span>
            </button>
            <button type="button" onClick={openRecebimentoManual} className="btn" style={{ justifyContent: "flex-start", padding: "14px 16px", gap: 12 }}>
              <PackagePlus size={18} />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span style={{ fontWeight: 700 }}>Preencher manualmente</span>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 400 }}>Pra recebimento sem NF-e (compra avulsa, amostra, etc.)</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <form onSubmit={handleSubmit} className="panel" style={{ width: 440, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
                {recebimentoMode ? "Registrar recebimento" : editing ? "Editar movimentação" : "Nova movimentação"}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="icon-btn"><X size={18} /></button>
            </div>
            {recebimentoMode && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                Registre a entrada de mercadoria com custo, lote e validade — essa é a origem que alimenta o controle FEFO e o custo das vendas.
              </p>
            )}
            {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}>{error}</div>}
            <div>
              <label style={lbl}>Produto</label>
              <select style={inp} required value={form.produto} onChange={e => setForm({ ...form, produto: e.target.value })}>
                <option value="">Selecione...</option>
                {produtos.map(p => <option key={p.id} value={produtoLabel(p)}>{produtoLabel(p)}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: recebimentoMode ? "1fr" : "1fr 1fr", gap: 12 }}>
              {!recebimentoMode && (
                <div>
                  <label style={lbl}>Tipo</label>
                  <select style={inp} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as Movimentacao["tipo"] })}>
                    <option value="Entrada">Entrada</option>
                    <option value="Saída">Saída</option>
                    <option value="Ajuste">Ajuste</option>
                  </select>
                </div>
              )}
              <div>
                <label style={lbl}>Quantidade</label>
                <input type="number" step="0.01" required style={inp} value={form.quantidade || ""} onChange={e => setForm({ ...form, quantidade: Number(e.target.value) })} />
              </div>
            </div>
            {form.tipo === "Entrada" && (
              <>
                {recebimentoMode && (
                  <div>
                    <label style={lbl}>Fornecedor (opcional)</label>
                    <select style={inp} value={form.fornecedor ?? ""} onChange={e => setForm({ ...form, fornecedor: e.target.value || undefined })}>
                      <option value="">Selecione...</option>
                      {fornecedores.map(f => <option key={f.id} value={String(f.data.nome)}>{String(f.data.nome)}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={lbl}>Custo unitário (opcional)</label>
                  <input type="number" step="0.01" style={inp} value={form.custoUnitario ?? ""} onChange={e => setForm({ ...form, custoUnitario: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Lote (opcional)</label>
                    <input style={inp} value={form.lote ?? ""} onChange={e => setForm({ ...form, lote: e.target.value || undefined })} />
                  </div>
                  <div>
                    <label style={lbl}>Validade (opcional)</label>
                    <input type="date" style={inp} value={form.validade ?? ""} onChange={e => setForm({ ...form, validade: e.target.value || undefined })} />
                  </div>
                </div>
              </>
            )}
            <div>
              <label style={lbl}>Motivo / observação</label>
              <input style={inp} value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} placeholder={recebimentoMode ? "Ex: Nota nº 1234, compra avulsa..." : undefined} />
            </div>
            <button type="submit" disabled={saving} className="btn btn-save" style={{ justifyContent: "center", marginTop: 4 }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </form>
        </div>
      )}

      {showImport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div className="panel" style={{ width: 760, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>Importar NF-e (XML)</h2>
              <button type="button" onClick={() => setShowImport(false)} className="icon-btn"><X size={18} /></button>
            </div>

            {importError && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}>{importError}</div>}

            {!parsed && (
              <label style={{ border: "1px dashed var(--border-strong)", borderRadius: 10, padding: "32px 20px", textAlign: "center", cursor: "pointer", color: "var(--text-muted)", fontSize: 13.5 }}>
                Clique para selecionar o arquivo XML da nota fiscal
                <input type="file" accept=".xml" onChange={handleFileSelected} style={{ display: "none" }} />
              </label>
            )}

            {parsed && (
              <>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12.5, color: "var(--text-muted)" }}>
                  <span>Nota <strong style={{ color: "var(--text-strong)" }}>Nº {parsed.numeroNota}</strong></span>
                  <span>Emitida em <strong style={{ color: "var(--text-strong)" }}>{new Date(parsed.dataEmissao).toLocaleDateString("pt-BR")}</strong></span>
                  <span>Fornecedor na nota: <strong style={{ color: "var(--text-strong)" }}>{parsed.fornecedorNome}</strong> ({parsed.fornecedorCnpj})</span>
                </div>

                <div>
                  <label style={lbl}>Fornecedor no cadastro</label>
                  <select style={inp} value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{String(f.data.nome)}</option>)}
                  </select>
                  {!fornecedorId && <p style={{ fontSize: 11.5, color: "#f59e0b", marginTop: 4 }}>Nenhum fornecedor com esse CNPJ encontrado — selecione manualmente.</p>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {importRows.map((row, idx) => {
                    const variacao = row.ultimoCusto ? ((row.nfeItem.valorUnitario - row.ultimoCusto) / row.ultimoCusto) * 100 : null;
                    const divergePedido = row.pedidoId != null && (
                      Math.abs(row.nfeItem.quantidade - (row.pedidoQuantidade ?? 0)) > 0.01
                      || Math.abs(row.nfeItem.valorUnitario - (row.pedidoPreco ?? 0)) / (row.pedidoPreco || 1) > 0.02
                    );
                    return (
                      <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, color: "var(--text-strong)" }}>{row.nfeItem.descricao} <span style={{ color: "var(--text-muted)" }}>(cód. fornecedor: {row.nfeItem.codigoFornecedor})</span></span>
                          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{row.nfeItem.quantidade}x · {row.nfeItem.valorUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                        <select style={inp} value={row.produto} onChange={e => updateImportRowProduto(idx, e.target.value)}>
                          <option value="">Associar a um produto do cadastro...</option>
                          {produtos.map(p => <option key={p.id} value={produtoLabel(p)}>{produtoLabel(p)}</option>)}
                        </select>
                        {row.produto && (
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
                            {row.ultimoCusto != null ? (
                              <span style={{ color: variacao && Math.abs(variacao) > 5 ? "#f59e0b" : "var(--text-muted)" }}>
                                Último custo: {row.ultimoCusto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                {variacao != null && ` (${variacao > 0 ? "+" : ""}${variacao.toFixed(1)}%)`}
                              </span>
                            ) : <span style={{ color: "var(--text-muted)" }}>Sem histórico de custo</span>}
                            {row.pedidoId ? (
                              <span style={{ display: "flex", alignItems: "center", gap: 4, color: divergePedido ? "#f59e0b" : "#4ade80" }}>
                                {divergePedido ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                                Pedido: {row.pedidoQuantidade}x a {row.pedidoPreco?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                {divergePedido && " — diverge da nota"}
                              </span>
                            ) : <span style={{ color: "var(--text-muted)" }}>Sem pedido de compra em aberto pra esse item</span>}
                          </div>
                        )}
                        {row.produto && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <input style={inp} placeholder="Lote (opcional)" value={row.lote} onChange={e => updateImportRowLote(idx, { lote: e.target.value })} />
                            <input type="date" style={inp} placeholder="Validade (opcional)" value={row.validade} onChange={e => updateImportRowLote(idx, { validade: e.target.value })} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button type="button" disabled={importing} onClick={confirmarImportacao} className="btn btn-save" style={{ justifyContent: "center" }}>
                  {importing ? "Importando..." : "Confirmar importação"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
