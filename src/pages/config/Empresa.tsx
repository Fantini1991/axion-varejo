import { useEffect, useState } from "react";
import { Save, ImagePlus } from "lucide-react";
import MainLayout from "../../layouts/MainLayout";
import { useAuth } from "../../contexts/AuthContext";
import { getOrCreateSingleton, updateRecord, uploadEmpresaLogo, type PersistedRecord } from "../../services/persistence";
import { calcularAliquotaEfetivaSimples, type RegimeTributario } from "../../utils/simplesNacional";

type EmpresaData = {
  nome: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  regimeTributario: RegimeTributario;
  faturamento12Meses: number;
  logoUrl: string;
  corDestaquePdv: string;
  ie: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidadeIbge: string;
  cidadeNome: string;
  uf: string;
  cep: string;
};

const defaults: EmpresaData = {
  nome: "", cnpj: "", telefone: "", endereco: "", regimeTributario: "Simples Nacional", faturamento12Meses: 0,
  logoUrl: "", corDestaquePdv: "",
  ie: "", logradouro: "", numero: "", bairro: "", cidadeIbge: "", cidadeNome: "", uf: "", cep: "",
};

export default function Empresa() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [record, setRecord] = useState<PersistedRecord<EmpresaData> | null>(null);
  const [form, setForm] = useState<EmpresaData>(defaults);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadEmpresaLogo(file);
      setForm(f => ({ ...f, logoUrl: url }));
    } finally {
      setUploadingLogo(false);
    }
  }

  useEffect(() => {
    getOrCreateSingleton<EmpresaData>("empresa-config", defaults).then(r => {
      setRecord(r);
      setForm({ ...defaults, ...r.data });
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!record) return;
    setSaving(true);
    setSaved(false);
    await updateRecord("empresa-config", record.id, form);
    setSaving(false);
    setSaved(true);
  }

  const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-input)", color: "var(--text-strong)", fontSize: 13.5, width: "100%" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };

  const aliquotaSugerida = form.regimeTributario === "Simples Nacional" ? calcularAliquotaEfetivaSimples(form.faturamento12Meses) : null;

  return (
    <MainLayout>
      <div className="module-hero">
        <div>
          <span>Configurações</span>
          <h1>Empresa</h1>
          <p>Dados da empresa e parâmetros gerais.</p>
        </div>
      </div>

      {!isAdmin && (
        <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          Somente administradores podem editar os dados da empresa. Você pode visualizar.
        </div>
      )}

      <form onSubmit={handleSubmit} className="panel" style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={lbl}>Razão social / Nome fantasia</label>
          <input style={inp} disabled={!isAdmin} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={lbl}>CNPJ</label>
            <input style={inp} disabled={!isAdmin} value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Telefone</label>
            <input style={inp} disabled={!isAdmin} value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
          </div>
        </div>
        <div>
          <label style={lbl}>Endereço</label>
          <input style={inp} disabled={!isAdmin} value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Endereço fiscal (necessário pra NFC-e, quando configurada)</span>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Logradouro</label>
              <input style={inp} disabled={!isAdmin} value={form.logradouro} onChange={e => setForm({ ...form, logradouro: e.target.value })} placeholder="Rua/Av." />
            </div>
            <div>
              <label style={lbl}>Número</label>
              <input style={inp} disabled={!isAdmin} value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Bairro</label>
              <input style={inp} disabled={!isAdmin} value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>CEP</label>
              <input style={inp} disabled={!isAdmin} value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" />
            </div>
            <div>
              <label style={lbl}>UF</label>
              <input style={inp} disabled={!isAdmin} value={form.uf} maxLength={2} onChange={e => setForm({ ...form, uf: e.target.value.toUpperCase() })} placeholder="SP" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Cidade</label>
              <input style={inp} disabled={!isAdmin} value={form.cidadeNome} onChange={e => setForm({ ...form, cidadeNome: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>Código IBGE da cidade</label>
              <input style={inp} disabled={!isAdmin} value={form.cidadeIbge} onChange={e => setForm({ ...form, cidadeIbge: e.target.value })} placeholder="Ex: 3550308" />
            </div>
            <div>
              <label style={lbl}>Inscrição Estadual</label>
              <input style={inp} disabled={!isAdmin} value={form.ie} onChange={e => setForm({ ...form, ie: e.target.value })} />
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
            O código IBGE do seu município você encontra pesquisando "código IBGE + nome da cidade" — é o mesmo número usado em qualquer nota fiscal.
          </p>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Personalização do PDV</span>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 10, background: "var(--surface-input)", border: "1px solid var(--border-strong)", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
              {form.logoUrl
                ? <img src={form.logoUrl} alt="Logo da empresa" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <ImagePlus size={20} color="var(--text-muted)" />}
            </div>
            {isAdmin && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--accent)", cursor: "pointer" }}>
                {uploadingLogo ? "Enviando..." : form.logoUrl ? "Trocar logo" : "Adicionar logo"}
                <input type="file" accept="image/*" onChange={handleLogoChange} disabled={uploadingLogo} style={{ display: "none" }} />
              </label>
            )}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Cor de destaque</label>
              <input type="color" disabled={!isAdmin} value={form.corDestaquePdv || "#22d3ee"} onChange={e => setForm({ ...form, corDestaquePdv: e.target.value })}
                style={{ width: 36, height: 32, padding: 2, borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--surface-input)", cursor: isAdmin ? "pointer" : "default" }} />
              {form.corDestaquePdv && isAdmin && (
                <button type="button" onClick={() => setForm({ ...form, corDestaquePdv: "" })} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                  usar padrão
                </button>
              )}
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
            A logo e a cor aparecem na tela do PDV (venda de balcão) — o resto do sistema continua no visual padrão do Axion Varejo.
          </p>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Regime tributário</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Regime</label>
              <select style={inp} disabled={!isAdmin} value={form.regimeTributario} onChange={e => setForm({ ...form, regimeTributario: e.target.value as RegimeTributario })}>
                <option value="Simples Nacional">Simples Nacional</option>
                <option value="Lucro Presumido">Lucro Presumido</option>
                <option value="Lucro Real">Lucro Real</option>
              </select>
            </div>
            {form.regimeTributario === "Simples Nacional" && (
              <div>
                <label style={lbl}>Faturamento (últimos 12 meses)</label>
                <input type="number" step="0.01" style={inp} disabled={!isAdmin} value={form.faturamento12Meses || ""} onChange={e => setForm({ ...form, faturamento12Meses: Number(e.target.value) })} />
              </div>
            )}
          </div>

          {aliquotaSugerida !== null && (
            <div style={{ background: "var(--surface-input)", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "var(--text-muted)" }}>
              Alíquota efetiva do DAS (Anexo I — Comércio): <strong style={{ color: "var(--accent)" }}>{aliquotaSugerida.toFixed(2)}%</strong>.
              Usada como sugestão de imposto ao cadastrar produtos novos.
            </div>
          )}

          <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
            Alguns produtos (bebidas, cimento, tintas e outros itens sujeitos a substituição tributária) já vêm do fornecedor com o
            ICMS-ST recolhido — nesse caso o imposto da revenda já está embutido no preço de compra e não deve ser cobrado de novo na
            venda. Confira com seu contador quais produtos do seu mix se enquadram, e ajuste o imposto pra 0% direto no cadastro desses.
          </p>
        </div>

        {isAdmin && (
          <button type="submit" disabled={saving} className="btn btn-save" style={{ justifyContent: "center" }}>
            <Save size={15} /> {saving ? "Salvando..." : "Salvar"}
          </button>
        )}
        {saved && <div style={{ color: "#4ade80", fontSize: 13, textAlign: "center" }}>Salvo com sucesso.</div>}
      </form>
    </MainLayout>
  );
}
