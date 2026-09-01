import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import MainLayout from "../../layouts/MainLayout";
import { listRecords, createRecord, updateRecord, deleteRecord, type PersistedRecord } from "../../services/persistence";
import { CONDICOES_PAGAMENTO, gerarParcelas } from "../../utils/condicaoPagamento";

export type ItemPedidoCompra = {
  produto: string;
  quantidade: number;
  precoAcordado: number;
  quantidadeRecebida: number;
};

export type PedidoCompra = {
  fornecedor: string;
  status: "Aberto" | "Parcial" | "Recebido" | "Cancelado";
  dataEmissao: string;
  observacoes: string;
  itens: ItemPedidoCompra[];
  condicaoPagamento: string;
  descontoTipo: "Nenhum" | "Percentual" | "Valor fixo";
  descontoValor: number;
  freteValor: number;
  freteQuemPaga: "CIF (fornecedor paga)" | "FOB (comprador paga)";
  prazoEntrega: string;
  contasGeradas?: boolean;
};

const emptyItem: ItemPedidoCompra = { produto: "", quantidade: 0, precoAcordado: 0, quantidadeRecebida: 0 };
const empty: PedidoCompra = {
  fornecedor: "",
  status: "Aberto",
  dataEmissao: new Date().toISOString().slice(0, 10),
  observacoes: "",
  itens: [{ ...emptyItem }],
  condicaoPagamento: "avista",
  descontoTipo: "Nenhum",
  descontoValor: 0,
  freteValor: 0,
  freteQuemPaga: "CIF (fornecedor paga)",
  prazoEntrega: "",
};

const statusColor: Record<string, string> = { Aberto: "#f59e0b", Parcial: "#38bdf8", Recebido: "#4ade80", Cancelado: "#f87171" };

/** Subtotal (itens), desconto aplicado e total final de um pedido de compra. */
export function calcularTotaisPedido(p: Pick<PedidoCompra, "itens" | "descontoTipo" | "descontoValor" | "freteValor">) {
  const subtotal = p.itens.reduce((s, it) => s + it.quantidade * it.precoAcordado, 0);
  const desconto = p.descontoTipo === "Percentual" ? subtotal * ((p.descontoValor || 0) / 100) : p.descontoTipo === "Valor fixo" ? p.descontoValor || 0 : 0;
  const total = Math.max(0, subtotal - desconto + (p.freteValor || 0));
  return { subtotal, desconto, total };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PedidosCompra() {
  const [pedidos, setPedidos] = useState<PersistedRecord<PedidoCompra>[]>([]);
  const [fornecedores, setFornecedores] = useState<PersistedRecord[]>([]);
  const [produtos, setProdutos] = useState<PersistedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PersistedRecord<PedidoCompra> | null>(null);
  const [form, setForm] = useState<PedidoCompra>(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [p, f, pr] = await Promise.all([
        listRecords<PedidoCompra>("pedidos-compra"),
        listRecords("fornecedores"),
        listRecords("produtos"),
      ]);
      setPedidos(p);
      setFornecedores(f);
      setProdutos(pr);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ ...empty, itens: [{ ...emptyItem }] });
    setShowForm(true);
  }

  function openEdit(p: PersistedRecord<PedidoCompra>) {
    setEditing(p);
    setForm({ ...empty, ...p.data });
    setShowForm(true);
  }

  function setItem(idx: number, patch: Partial<ItemPedidoCompra>) {
    setForm(f => ({ ...f, itens: f.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  }

  function addItem() {
    setForm(f => ({ ...f, itens: [...f.itens, { ...emptyItem }] }));
  }

  function removeItem(idx: number) {
    setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));
  }

  /** Gera as parcelas de Contas a Pagar vinculadas a este pedido, a partir da condição de pagamento. */
  async function gerarContasPagar(pedido: PedidoCompra) {
    const { total } = calcularTotaisPedido(pedido);
    if (total <= 0) return;
    const base = pedido.prazoEntrega || pedido.dataEmissao || new Date().toISOString().slice(0, 10);
    const parcelas = gerarParcelas(pedido.condicaoPagamento, total, base);
    const pedidoLabel = `${pedido.fornecedor} — ${new Date(pedido.dataEmissao).toLocaleDateString("pt-BR")} — ${fmt(total)}`;
    for (let i = 0; i < parcelas.length; i++) {
      const parc = parcelas[i];
      await createRecord("contas-pagar", {
        descricao: `Pedido de compra — ${pedido.fornecedor}`,
        fornecedor: pedido.fornecedor,
        valor: parc.valor,
        vencimento: parc.vencimento,
        status: "Pendente",
        pedidoCompra: pedidoLabel,
        parcela: parcelas.length > 1 ? `${i + 1}/${parcelas.length}` : "",
        formaPagamento: "",
        categoria: "Compra de mercadoria",
        dataPagamento: "",
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const itensValidos = form.itens.filter(it => it.produto && it.quantidade > 0);
      if (!form.fornecedor) throw new Error("Selecione o fornecedor.");
      if (itensValidos.length === 0) throw new Error("Adicione ao menos um item com produto e quantidade.");
      const payload = { ...form, itens: itensValidos };

      const viraRecebidoAgora = payload.status === "Recebido" && !payload.contasGeradas;
      if (viraRecebidoAgora) {
        await gerarContasPagar(payload);
        payload.contasGeradas = true;
      }

      if (editing) await updateRecord("pedidos-compra", editing.id, payload);
      else await createRecord("pedidos-compra", payload);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este pedido de compra?")) return;
    await deleteRecord("pedidos-compra", id);
    await load();
  }

  const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-input)", color: "var(--text-strong)", fontSize: 13.5, width: "100%" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };

  const { subtotal, desconto, total } = calcularTotaisPedido(form);

  return (
    <MainLayout>
      <div className="module-hero">
        <div>
          <span>Compras</span>
          <h1>Pedidos de Compra</h1>
          <p>Pedidos enviados a fornecedores, pra conferir com a nota fiscal no recebimento.</p>
        </div>
        <button onClick={openNew} className="btn btn-save">
          <Plus size={15} /> Novo pedido
        </button>
      </div>

      {error && !showForm && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div className="panel" style={{ padding: 0, overflow: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>FORNECEDOR</th>
              <th>DATA</th>
              <th>ITENS</th>
              <th>CONDIÇÃO</th>
              <th>TOTAL</th>
              <th>STATUS</th>
              <th style={{ width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
            {!loading && pedidos.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhum pedido de compra ainda.</td></tr>}
            {pedidos.map(p => {
              const totais = calcularTotaisPedido(p.data);
              const condLabel = CONDICOES_PAGAMENTO.find(c => c.value === p.data.condicaoPagamento)?.label ?? "—";
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-strong)" }}>{p.data.fornecedor}</td>
                  <td>{p.data.dataEmissao ? new Date(p.data.dataEmissao).toLocaleDateString("pt-BR") : "—"}</td>
                  <td>{p.data.itens?.length ?? 0} item(ns)</td>
                  <td>{condLabel}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(totais.total)}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: statusColor[p.data.status], background: `${statusColor[p.data.status]}18`, border: `1px solid ${statusColor[p.data.status]}44` }}>{p.data.status}</span>
                  </td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openEdit(p)} className="icon-btn"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(p.id)} className="icon-btn" style={{ color: "var(--danger)" }}><Trash2 size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <form onSubmit={handleSubmit} className="panel" style={{ width: 680, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>{editing ? "Editar" : "Novo"} pedido de compra</h2>
              <button type="button" onClick={() => setShowForm(false)} className="icon-btn"><X size={18} /></button>
            </div>

            {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}>{error}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Fornecedor</label>
                <select style={inp} required value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })}>
                  <option value="">Selecione...</option>
                  {fornecedores.map(f => <option key={f.id} value={String(f.data.nome)}>{String(f.data.nome)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Data de emissão</label>
                <input type="date" style={inp} value={form.dataEmissao} onChange={e => setForm({ ...form, dataEmissao: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as PedidoCompra["status"] })}>
                  <option value="Aberto">Aberto</option>
                  <option value="Parcial">Parcial</option>
                  <option value="Recebido">Recebido</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Condição de pagamento</label>
                <select style={inp} value={form.condicaoPagamento} onChange={e => setForm({ ...form, condicaoPagamento: e.target.value })}>
                  {CONDICOES_PAGAMENTO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Prazo de entrega</label>
                <input type="date" style={inp} value={form.prazoEntrega} onChange={e => setForm({ ...form, prazoEntrega: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Desconto negociado</label>
                <select style={inp} value={form.descontoTipo} onChange={e => setForm({ ...form, descontoTipo: e.target.value as PedidoCompra["descontoTipo"] })}>
                  <option value="Nenhum">Nenhum</option>
                  <option value="Percentual">Percentual (%)</option>
                  <option value="Valor fixo">Valor fixo (R$)</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Valor do desconto</label>
                <input type="number" step="0.01" min="0" style={inp} disabled={form.descontoTipo === "Nenhum"} value={form.descontoValor || ""} onChange={e => setForm({ ...form, descontoValor: Number(e.target.value) })} />
              </div>
              <div>
                <label style={lbl}>Frete (R$)</label>
                <input type="number" step="0.01" min="0" style={inp} value={form.freteValor || ""} onChange={e => setForm({ ...form, freteValor: Number(e.target.value) })} />
              </div>
            </div>

            <div>
              <label style={lbl}>Frete por conta de</label>
              <select style={inp} value={form.freteQuemPaga} onChange={e => setForm({ ...form, freteQuemPaga: e.target.value as PedidoCompra["freteQuemPaga"] })}>
                <option value="CIF (fornecedor paga)">CIF (fornecedor paga)</option>
                <option value="FOB (comprador paga)">FOB (comprador paga)</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={lbl}>Itens</label>
              {form.itens.map((it, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                  <select style={inp} value={it.produto} onChange={e => setItem(idx, { produto: e.target.value })}>
                    <option value="">Produto...</option>
                    {produtos.map(p => <option key={p.id} value={`${p.data.codigo} — ${p.data.nome}`}>{String(p.data.codigo)} — {String(p.data.nome)}</option>)}
                  </select>
                  <input type="number" step="0.01" min="0" style={inp} placeholder="Qtd" value={it.quantidade || ""} onChange={e => setItem(idx, { quantidade: Number(e.target.value) })} />
                  <input type="number" step="0.01" min="0" style={inp} placeholder="Preço acordado" value={it.precoAcordado || ""} onChange={e => setItem(idx, { precoAcordado: Number(e.target.value) })} />
                  <button type="button" onClick={() => removeItem(idx)} className="icon-btn" style={{ color: "var(--danger)" }}><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" onClick={addItem} className="btn" style={{ alignSelf: "flex-start", fontSize: 12.5 }}>
                <Plus size={13} /> Adicionar item
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--surface-input)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}><span>Subtotal itens</span><span>{fmt(subtotal)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}><span>Desconto</span><span>− {fmt(desconto)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}><span>Frete</span><span>+ {fmt(form.freteValor || 0)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "var(--text-strong)", fontSize: 15, borderTop: "1px solid var(--border-strong)", paddingTop: 6, marginTop: 2 }}><span>Total do pedido</span><span>{fmt(total)}</span></div>
            </div>

            <div>
              <label style={lbl}>Observações</label>
              <input style={inp} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>

            {form.status === "Recebido" && !form.contasGeradas && (
              <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>
                Ao salvar, as parcelas de Contas a Pagar serão geradas automaticamente conforme a condição de pagamento.
              </div>
            )}

            <button type="submit" disabled={saving} className="btn btn-save" style={{ justifyContent: "center", marginTop: 4 }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </form>
        </div>
      )}
    </MainLayout>
  );
}
