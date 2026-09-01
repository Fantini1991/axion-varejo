import { useState } from "react";
import { Check, Palette, AlertTriangle, RotateCcw } from "lucide-react";
import MainLayout from "../../layouts/MainLayout";
import {
  TONALIDADES, DENSIDADES, getTonalidade, getDensidade, definirAparencia,
  getAccentColor, definirCorDestaque, restaurarCorPadrao, avaliarContraste, ACCENT_PADRAO,
  type Tonalidade, type Densidade,
} from "../../utils/aparencia";

const PRESETS = ["#22d3ee", "#38bdf8", "#4ade80", "#facc15", "#fb923c", "#f472b6", "#a78bfa"];

export default function Aparencia() {
  const [tone, setTone] = useState<Tonalidade>(getTonalidade());
  const [density, setDensity] = useState<Densidade>(getDensidade());
  const [accent, setAccent] = useState(getAccentColor());
  const [salvo, setSalvo] = useState(false);

  function aplicar(t: Tonalidade, d: Densidade) {
    setTone(t);
    setDensity(d);
    definirAparencia(t, d);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  function aplicarCor(cor: string) {
    setAccent(cor);
    definirCorDestaque(cor);
  }

  function resetarCor() {
    setAccent(ACCENT_PADRAO);
    restaurarCorPadrao();
  }

  const contraste = avaliarContraste(accent);

  const optionCard = (active: boolean): React.CSSProperties => ({
    display: "flex", flexDirection: "column", gap: 4, textAlign: "left", cursor: "pointer", padding: "12px 14px", borderRadius: 10,
    border: "1px solid " + (active ? "var(--accent)" : "var(--border-strong)"),
    background: active ? "color-mix(in srgb, var(--accent) 12%, var(--surface-input))" : "var(--surface-input)",
  });

  return (
    <MainLayout>
      <div className="module-hero">
        <div>
          <span>Configurações</span>
          <h1>Aparência</h1>
          <p>Ajuste a cor, a tonalidade e a densidade de informação das telas do sistema. Vale pra este navegador/computador.</p>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Palette size={20} color="var(--text-muted)" />
          <h2 style={{ margin: 0, fontSize: 15, color: "var(--text-strong)" }}>Cor do sistema</h2>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map(cor => (
            <button
              key={cor}
              type="button"
              onClick={() => aplicarCor(cor)}
              title={cor}
              style={{
                width: 34, height: 34, borderRadius: "50%", background: cor, cursor: "pointer",
                border: accent.toLowerCase() === cor ? "3px solid var(--text-strong)" : "1px solid var(--border-strong)",
                display: "grid", placeItems: "center",
              }}
            >
              {accent.toLowerCase() === cor && <Check size={14} color="#0f172a" />}
            </button>
          ))}
          <label style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", border: "1px solid var(--border-strong)", cursor: "pointer", position: "relative" }}>
            <input type="color" value={accent} onChange={e => aplicarCor(e.target.value)} style={{ position: "absolute", inset: -4, cursor: "pointer", border: "none", padding: 0 }} />
          </label>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="text" value={accent} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setAccent(e.target.value); }}
            onBlur={() => { if (/^#[0-9a-fA-F]{6}$/.test(accent)) aplicarCor(accent); else setAccent(getAccentColor()); }}
            style={{ padding: "8px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-input)", color: "var(--text-strong)", fontSize: 13, fontFamily: "monospace", width: 110 }}
          />
          <button type="button" onClick={resetarCor} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            <RotateCcw size={13} /> Restaurar padrão
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--surface-input)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Contraste (WCAG)</span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
            <span style={{ color: "var(--text-muted)" }}>Texto em cima de botões coloridos</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, color: contraste.botaoOk ? "#4ade80" : "#f87171" }}>
              {contraste.comTextoDoBotao.toFixed(1)}:1 {contraste.botaoOk ? <Check size={13} /> : <AlertTriangle size={13} />}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
            <span style={{ color: "var(--text-muted)" }}>Visibilidade sobre o fundo escuro</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, color: contraste.fundoOk ? "#4ade80" : "#f87171" }}>
              {contraste.comFundo.toFixed(1)}:1 {contraste.fundoOk ? <Check size={13} /> : <AlertTriangle size={13} />}
            </span>
          </div>
          {(!contraste.botaoOk || !contraste.fundoOk) && (
            <p style={{ fontSize: 11.5, color: "#f59e0b", margin: "4px 0 0" }}>
              Essa cor está abaixo do recomendado pela WCAG — pode ficar difícil de ler pra algumas pessoas. Ainda assim foi aplicada, se preferir manter.
            </p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <Palette size={20} color="var(--text-muted)" />
          <h2 style={{ margin: 0, fontSize: 15, color: "var(--text-strong)" }}>Tonalidade e contraste</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {TONALIDADES.map(t => (
            <button key={t.value} type="button" style={optionCard(tone === t.value)} onClick={() => aplicar(t.value, density)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 13.5, color: "var(--text-strong)" }}>{t.label}</strong>
                {tone === t.value && <Check size={15} color="var(--accent)" />}
              </div>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.descricao}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15, color: "var(--text-strong)" }}>Densidade das informações</h2>
          {DENSIDADES.map(d => (
            <button key={d.value} type="button" style={optionCard(density === d.value)} onClick={() => aplicar(tone, d.value)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 13.5, color: "var(--text-strong)" }}>{d.label}</strong>
                {density === d.value && <Check size={15} color="var(--accent)" />}
              </div>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.descricao}</span>
            </button>
          ))}
        </div>

        {salvo && (
          <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}>
            Aparência aplicada.
          </div>
        )}

        <div className="panel" style={{ padding: 14, background: "var(--surface-input)" }}>
          <button type="button" className="btn btn-save" style={{ marginBottom: 10 }}>Botão de exemplo</button>
          <table className="data-table">
            <thead><tr><th>PRODUTO</th><th>SALDO</th><th>STATUS</th></tr></thead>
            <tbody>
              <tr><td>TN-001 — Tinta Acrílica Premium</td><td>128</td><td>OK</td></tr>
              <tr><td>TN-014 — Verniz Marítimo</td><td>6</td><td>Baixo</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, marginBottom: 0 }}>Pré-visualização — reflete a cor, tonalidade e densidade escolhidas acima.</p>
        </div>
      </div>
    </MainLayout>
  );
}
