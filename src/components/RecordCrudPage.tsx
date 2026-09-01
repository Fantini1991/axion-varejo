import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../contexts/AuthContext";
import { listRecords, createRecord, updateRecord, deleteRecord, type EntityName, type PersistedRecord } from "../services/persistence";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea" | "date";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  span2?: boolean;
};

type Props = {
  entity: EntityName;
  breadcrumb: string;
  title: string;
  description: string;
  fields: FieldDef[];
  columns: string[];
  formatCell?: (key: string, value: unknown, data: Record<string, unknown>) => string;
};

export default function RecordCrudPage({ entity, breadcrumb, title, description, fields, columns, formatCell }: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const emptyForm = Object.fromEntries(fields.map(f => [f.key, f.type === "number" ? 0 : ""]));

  const [rows, setRows] = useState<PersistedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PersistedRecord | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listRecords(entity);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [entity]);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(r: PersistedRecord) {
    setEditing(r);
    setForm(r.data);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      for (const f of fields) {
        if (f.required && !String(form[f.key] ?? "").trim()) {
          throw new Error(`Preencha o campo "${f.label}".`);
        }
      }
      if (editing) await updateRecord(entity, editing.id, form);
      else await createRecord(entity, form);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!isAdmin) return;
    if (!confirm("Excluir este registro?")) return;
    try {
      await deleteRecord(entity, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-input)", color: "var(--text-strong)", fontSize: 13.5, width: "100%" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };

  return (
    <MainLayout>
      <div className="module-hero">
        <div>
          <span>{breadcrumb}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button onClick={openNew} className="btn btn-save">
          <Plus size={15} /> Novo
        </button>
      </div>

      {error && !showForm && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div className="panel" style={{ padding: 0, overflow: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(c => <th key={c}>{fields.find(f => f.key === c)?.label.toUpperCase() ?? c.toUpperCase()}</th>)}
              {isAdmin && <th style={{ width: 70 }} />}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={columns.length + 1} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={columns.length + 1} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhum registro ainda.</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                {columns.map(c => (
                  <td key={c}>{formatCell ? formatCell(c, r.data[c], r.data) : String(r.data[c] ?? "—")}</td>
                ))}
                {isAdmin && (
                  <td style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openEdit(r)} className="icon-btn"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(r.id)} className="icon-btn" style={{ color: "var(--danger)" }}><Trash2 size={15} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <form onSubmit={handleSubmit} className="panel" style={{ width: 460, maxWidth: "100%", maxHeight: "86vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>{editing ? "Editar" : "Novo"} — {title}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="icon-btn"><X size={18} /></button>
            </div>

            {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}>{error}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {fields.map(f => (
                <div key={f.key} style={{ gridColumn: f.span2 ? "1 / -1" : undefined }}>
                  <label style={lbl}>{f.label}{f.required && " *"}</label>
                  {f.type === "select" ? (
                    <select style={inp} required={f.required} value={String(form[f.key] ?? "")} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
                      <option value="">Selecione...</option>
                      {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} required={f.required} placeholder={f.placeholder} value={String(form[f.key] ?? "")} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                  ) : (
                    <input
                      type={f.type}
                      step={f.type === "number" ? "0.01" : undefined}
                      style={inp}
                      required={f.required}
                      placeholder={f.placeholder}
                      value={String(form[f.key] ?? "")}
                      onChange={e => setForm({ ...form, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                    />
                  )}
                </div>
              ))}
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
