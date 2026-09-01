import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Receipt, CheckCircle2 } from "lucide-react";
import MainLayout from "../../layouts/MainLayout";
import { listRecords, createRecord, updateRecord, deleteRecord, type PersistedRecord } from "../../services/persistence";

export type Despesa = {
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  recorrente: boolean;
  status: "Pendente" | "Pago";
};

const CATEGORIAS = ["Aluguel", "Salários/Folha", "Energia", "Água", "Internet/Telefone", "Marketing", "Manutenção", "Impostos e taxas", "Transporte/Frete", "Contabilidade", "Outros"];

const empty: Despesa = { categoria: "Outros", descricao: "", valor: 0, data: new Date().toISOString().slice(0, 10), recorrente: false, status: "Pendente" };

const CATEGORIA_COR: Record<string, string> = {
  "Aluguel": "#38bdf8", "Salários/Folha": "#a78bfa", "Energia": "#facc15", "Água": "#22d3ee",
  "Internet/Telefone": "#fb923c", "Marketing": "#f472b6", "Manutenção": "#94a3b8",
  "Impostos e taxas": "#f87171", "Transporte/Frete": "#4ade80", "Contabilidade": "#818cf8", "Outros": "#94a3b8",
};

/** Interpreta "AAAA-MM-DD" como data local, evitando o deslocamento de um dia que `new Date(iso)` causa em fusos negativos. */
function parseDataLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function Despesas() {
  const [despesas, setDespesas] = useState<PersistedRecord<Despesa>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const [editing, setEditing] = useState<PersistedRecord<Despesa> | null>(null);
  const [form, setForm] = useState<Despesa>(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setDespesas(await listRecords<Despesa>("despesas"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar despesas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  }

  function openEdit(d: PersistedRecord<Despesa>) {
    setEditing(d);
    setForm({ ...empty, ...d.data });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!form.descricao) throw new Error("Descreva a despesa.");
      if (editing) await updateRecord("despesas", editing.id, form);
      else await createRecord("despesas", form);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta despesa?")) return;
    await deleteRecord("despesas", id);
    await load();
  }

  async function marcarPaga(d: PersistedRecord<Despesa>) {
    await updateRecord("despesas", d.id, { ...d.data, status: "Pago" });
    await load();
  }

  const filtradas = useMemo(
    () => (filtroCategoria ? despesas.filter(d => d.data.categoria === filtroCategoria) : despesas).sort((a, b) => b.data.data.localeCompare(a.data.data)),
    [despesas, filtroCategoria],
  );

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const doMes = despesas.filter(d => { const dt = parseDataLocal(d.data.data); return dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual; });
  const totalMes = doMes.reduce((s, d) => s + Number(d.data.valor || 0), 0);
  const totalPendente = despesas.filter(d => d.data.status === "Pendente").reduce((s, d) => s + Number(d.data.valor || 0), 0);
  const totalRecorrente = despesas.filter(d => d.data.recorrente).reduce((s, d) => s + Number(d.data.valor || 0), 0);

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of doMes) map.set(d.data.categoria, (map.get(d.data.categoria) ?? 0) + Number(d.data.valor || 0));
    return Array.from(map.entries()).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
  }, [doMes]);

  const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-input)", color: "var(--text-strong)", fontSize: 13.5, width: "100%" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };
  const card: React.CSSProperties = { padding: "16px 18px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" };

  return (
    <MainLayout>
      <div className="module-hero">
        <div>
          <span>Financeiro</span>
          <h1>Despesas</h1>
          <p>Custos fixos e variáveis da operação — aluguel, salários, energia, marketing e outras contas do dia a dia.</p>
        </div>
        <button onClick={openNew} className="btn btn-save">
          <Plus size={15} /> Nova despesa
        </button>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Despesas do mês</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", marginTop: 6 }}>{totalMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>Pendentes</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", marginTop: 6 }}>{totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase" }}>Fixas recorrentes</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", marginTop: 6 }}>{totalRecorrente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
        </div>
      </div>

      {porCategoria.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-strong)" }}>Por categoria — este mês</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {porCategoria.map(c => (
              <div key={c.categoria} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: CATEGORIA_COR[c.categoria] ?? "#94a3b8", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12.5, color: "var(--text-strong)" }}>{c.categoria}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)" }}>{c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={() => setFiltroCategoria("")}
          style={{ padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid " + (filtroCategoria === "" ? "var(--accent)" : "var(--border-strong)"), background: filtroCategoria === "" ? "color-mix(in srgb, var(--accent) 16%, var(--surface-input))" : "var(--surface-input)", color: "var(--text-strong)" }}
        >
          Todas
        </button>
        {CATEGORIAS.map(c => (
          <button
            key={c}
            onClick={() => setFiltroCategoria(c)}
            style={{ padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid " + (filtroCategoria === c ? "var(--accent)" : "var(--border-strong)"), background: filtroCategoria === c ? "color-mix(in srgb, var(--accent) 16%, var(--surface-input))" : "var(--surface-input)", color: "var(--text-strong)" }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="panel" style={{ padding: 0, overflow: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>CATEGORIA</th>
              <th>DESCRIÇÃO</th>
              <th>VALOR</th>
              <th>DATA</th>
              <th>RECORRENTE</th>
              <th>STATUS</th>
              <th style={{ width: 100 }} />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
            {!loading && filtradas.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhuma despesa cadastrada ainda.</td></tr>}
            {filtradas.map(d => (
              <tr key={d.id}>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: CATEGORIA_COR[d.data.categoria] ?? "#94a3b8" }} />
                    {d.data.categoria}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: "var(--text-strong)" }}>{d.data.descricao}</td>
                <td style={{ fontFamily: "monospace" }}>{Number(d.data.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                <td>{formatDataBR(d.data.data)}</td>
                <td>{d.data.recorrente ? "Sim" : "—"}</td>
                <td>
                  {d.data.status === "Pago" ? (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: "#4ade80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)" }}>Pago</span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>Pendente</span>
                  )}
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  {d.data.status === "Pendente" && (
                    <button onClick={() => marcarPaga(d)} className="icon-btn" title="Marcar como paga" style={{ color: "#4ade80" }}><CheckCircle2 size={15} /></button>
                  )}
                  <button onClick={() => openEdit(d)} className="icon-btn"><Pencil size={15} /></button>
                  <button onClick={() => handleDelete(d.id)} className="icon-btn" style={{ color: "var(--danger)" }}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <form onSubmit={handleSubmit} className="panel" style={{ width: 420, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Receipt size={18} color="var(--accent)" /> {editing ? "Editar" : "Nova"} despesa
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="icon-btn"><X size={18} /></button>
            </div>
            {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}>{error}</div>}
            <div>
              <label style={lbl}>Categoria</label>
              <select style={inp} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Descrição</label>
              <input required style={inp} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Aluguel do galpão — agosto" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Valor</label>
                <input type="number" step="0.01" min="0" required style={inp} value={form.valor || ""} onChange={e => setForm({ ...form, valor: Number(e.target.value) })} />
              </div>
              <div>
                <label style={lbl}>Data</label>
                <input type="date" required style={inp} value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Status</label>
                <select style={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Despesa["status"] })}>
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-strong)", cursor: "pointer", marginTop: 20 }}>
                <input type="checkbox" checked={form.recorrente} onChange={e => setForm({ ...form, recorrente: e.target.checked })} />
                Despesa fixa recorrente
              </label>
            </div>
            <button type="submit" disabled={saving} className="btn btn-save" style={{ justifyContent: "center", marginTop: 4 }}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </form>
        </div>
      )}
    </MainLayout>
  );
}
