import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, ImagePlus, Camera } from "lucide-react";
import MainLayout from "../../layouts/MainLayout";
import { listRecords, createRecord, updateRecord, deleteRecord, uploadProdutoFoto, getOrCreateSingleton, type PersistedRecord } from "../../services/persistence";
import { calcularAliquotaEfetivaSimples, type RegimeTributario } from "../../utils/simplesNacional";
import BarcodeScanner from "../../components/BarcodeScanner";

type Produto = {
  codigo: string;
  nome: string;
  descricao: string;
  marca: string;
  categoria: string;
  unidade: string;
  codigoBarras: string;
  fotoUrl: string;
  custoCompra: number;
  percentualImposto: number;
  margemDesejada: number;
  precoVenda: number;
};

const empty: Produto = {
  codigo: "", nome: "", descricao: "", marca: "", categoria: "", unidade: "UN", codigoBarras: "", fotoUrl: "",
  custoCompra: 0, percentualImposto: 0, margemDesejada: 0, precoVenda: 0,
};

const UNIDADES = ["UN", "KG", "L", "M", "M²", "SACO", "CX", "PCT"];

/** Preço tal que o custo represente (1 - imposto% - margem%) do preço final — mesma fórmula usada no Axion One. */
function calcularPrecoVenda(custo: number, imposto: number, margem: number): number {
  const deducoes = (imposto + margem) / 100;
  if (deducoes >= 1 || deducoes < 0) return 0;
  return custo / (1 - deducoes);
}

function calcularLucro(precoVenda: number, custo: number, imposto: number) {
  const valorImposto = precoVenda * (imposto / 100);
  const lucroValor = precoVenda - custo - valorImposto;
  const lucroPercentual = precoVenda > 0 ? (lucroValor / precoVenda) * 100 : 0;
  return { lucroValor, lucroPercentual };
}

export default function Produtos() {
  const [produtos, setProdutos] = useState<PersistedRecord<Produto>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PersistedRecord<Produto> | null>(null);
  const [form, setForm] = useState<Produto>(empty);
  const [showForm, setShowForm] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [precoManual, setPrecoManual] = useState(false);
  const [aliquotaSugerida, setAliquotaSugerida] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const rows = await listRecords<Produto>("produtos");
      setProdutos(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar produtos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    getOrCreateSingleton<{ regimeTributario?: RegimeTributario; faturamento12Meses?: number }>("empresa-config", {}).then(r => {
      if (r.data.regimeTributario === "Simples Nacional" && r.data.faturamento12Meses) {
        setAliquotaSugerida(calcularAliquotaEfetivaSimples(r.data.faturamento12Meses));
      }
    });
  }, []);

  function openNew() {
    setEditing(null);
    setForm({ ...empty, percentualImposto: aliquotaSugerida });
    setPrecoManual(false);
    setShowForm(true);
  }

  function openEdit(p: PersistedRecord<Produto>) {
    setEditing(p);
    setForm({ ...empty, ...p.data });
    setPrecoManual(true);
    setShowForm(true);
  }

  function updateCalculo(patch: Partial<Produto>) {
    setForm(f => {
      const next = { ...f, ...patch };
      if (!precoManual) {
        next.precoVenda = Number(calcularPrecoVenda(next.custoCompra, next.percentualImposto, next.margemDesejada).toFixed(2));
      }
      return next;
    });
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    setError("");
    try {
      const url = await uploadProdutoFoto(file);
      setForm(f => ({ ...f, fotoUrl: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar foto.");
    } finally {
      setUploadingFoto(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) await updateRecord("produtos", editing.id, form);
      else await createRecord("produtos", form);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar produto.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este produto?")) return;
    await deleteRecord("produtos", id);
    await load();
  }

  const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-input)", color: "var(--text-strong)", fontSize: 13.5, width: "100%" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };

  const { lucroValor, lucroPercentual } = calcularLucro(form.precoVenda, form.custoCompra, form.percentualImposto);

  return (
    <MainLayout>
      <div className="module-hero">
        <div>
          <span>Cadastros</span>
          <h1>Produtos</h1>
          <p>Itens comercializados.</p>
        </div>
        <button onClick={openNew} className="btn btn-save">
          <Plus size={15} /> Novo produto
        </button>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div className="panel" style={{ padding: 0, overflow: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 48 }} />
              <th>CÓDIGO</th>
              <th>NOME</th>
              <th>MARCA</th>
              <th>CATEGORIA</th>
              <th>UNIDADE</th>
              <th>PREÇO</th>
              <th style={{ width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
            {!loading && produtos.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhum produto cadastrado ainda.</td></tr>}
            {produtos.map(p => (
              <tr key={p.id}>
                <td>
                  {p.data.fotoUrl
                    ? <img src={p.data.fotoUrl} alt={p.data.nome} style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
                    : <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--surface-input)" }} />}
                </td>
                <td style={{ fontFamily: "monospace", color: "var(--accent)" }}>{p.data.codigo}</td>
                <td style={{ fontWeight: 600, color: "var(--text-strong)" }}>{p.data.nome}</td>
                <td>{p.data.marca}</td>
                <td>{p.data.categoria}</td>
                <td>{p.data.unidade}</td>
                <td>{Number(p.data.precoVenda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(p)} className="icon-btn"><Pencil size={15} /></button>
                  <button onClick={() => handleDelete(p.id)} className="icon-btn" style={{ color: "var(--danger)" }}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto", padding: "24px 0" }}>
          <form onSubmit={handleSubmit} className="panel" style={{ width: 460, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>{editing ? "Editar produto" : "Novo produto"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="icon-btn"><X size={18} /></button>
            </div>

            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: 10, background: "var(--surface-input)", border: "1px solid var(--border-strong)", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
                {form.fotoUrl
                  ? <img src={form.fotoUrl} alt="Foto do produto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <ImagePlus size={22} color="var(--text-muted)" />}
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--accent)", cursor: "pointer" }}>
                {uploadingFoto ? "Enviando..." : form.fotoUrl ? "Trocar foto" : "Adicionar foto"}
                <input type="file" accept="image/*" onChange={handleFotoChange} disabled={uploadingFoto} style={{ display: "none" }} />
              </label>
            </div>

            <div>
              <label style={lbl}>Código</label>
              <input required style={inp} value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>Código de barras (EAN)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={inp} value={form.codigoBarras} onChange={e => setForm({ ...form, codigoBarras: e.target.value })} placeholder="Bipe ou digite o código" />
                <button type="button" onClick={() => setShowScanner(true)} className="icon-btn" title="Ler pela câmera" style={{ flexShrink: 0, border: "1px solid var(--border-strong)", borderRadius: 8, padding: "0 12px" }}>
                  <Camera size={16} />
                </button>
              </div>
            </div>
            <div>
              <label style={lbl}>Nome</label>
              <input required style={inp} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome curto do produto" />
            </div>
            <div>
              <label style={lbl}>Descrição (opcional)</label>
              <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição completa — pode colar um texto longo aqui" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Marca</label>
                <input style={inp} value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Categoria</label>
                <input style={inp} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
              </div>
            </div>
            <div>
              <label style={lbl}>Unidade</label>
              <select style={inp} value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Precificação</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={lbl}>Custo de compra</label>
                  <input type="number" step="0.01" min="0" style={inp} value={form.custoCompra} onChange={e => updateCalculo({ custoCompra: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={lbl}>Imposto (%) {aliquotaSugerida > 0 && <span style={{ color: "var(--accent)", textTransform: "none", fontWeight: 400 }}>· sugerido {aliquotaSugerida.toFixed(2)}%</span>}</label>
                  <input type="number" step="0.01" min="0" max="99" style={inp} value={form.percentualImposto} onChange={e => updateCalculo({ percentualImposto: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={lbl}>Margem desejada (%)</label>
                  <input type="number" step="0.01" min="0" max="99" style={inp} value={form.margemDesejada} onChange={e => updateCalculo({ margemDesejada: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <label style={lbl}>Preço de venda {!precoManual && <span style={{ color: "var(--accent)", textTransform: "none" }}>(calculado automaticamente)</span>}</label>
                <input
                  type="number" step="0.01" required style={inp} value={form.precoVenda}
                  onChange={e => { setPrecoManual(true); setForm({ ...form, precoVenda: Number(e.target.value) }); }}
                />
                {precoManual && (
                  <button type="button" onClick={() => { setPrecoManual(false); updateCalculo({}); }}
                    style={{ marginTop: 6, fontSize: 11.5, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    Recalcular automaticamente
                  </button>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-input)", borderRadius: 8, padding: "10px 14px" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Lucro estimado</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: lucroValor >= 0 ? "#4ade80" : "var(--danger)" }}>
                  {lucroValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ({lucroPercentual.toFixed(1)}%)
                </span>
              </div>
            </div>

            <button type="submit" className="btn btn-save" style={{ justifyContent: "center", marginTop: 4 }}>
              Salvar
            </button>
          </form>
        </div>
      )}

      {showScanner && (
        <BarcodeScanner
          onResult={code => { setForm(f => ({ ...f, codigoBarras: code })); setShowScanner(false); }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </MainLayout>
  );
}
