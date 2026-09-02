export type Tonalidade = "padrao" | "suave" | "alto-contraste";
export type Densidade = "confortavel" | "compacta";

const TONE_KEY = "axion-varejo-tone";
const DENSITY_KEY = "axion-varejo-density";
const ACCENT_KEY = "axion-varejo-accent";

export const ACCENT_PADRAO = "#14ccc0";
const ACCENT_TEXT = "#0f172a"; // cor do texto sobre o accent (botões primários)
const PAGE_BG = "#050816"; // fundo geral, o accent precisa se destacar sobre isso

export const TONALIDADES: { value: Tonalidade; label: string; descricao: string }[] = [
  { value: "padrao", label: "Padrão", descricao: "Escuro com contraste equilibrado — o visual atual do sistema." },
  { value: "suave", label: "Suave", descricao: "Bordas e textos secundários mais discretos, menos contraste visual." },
  { value: "alto-contraste", label: "Alto contraste", descricao: "Bordas e textos mais fortes, pra facilitar a leitura em telas ou ambientes difíceis." },
];

export const DENSIDADES: { value: Densidade; label: string; descricao: string }[] = [
  { value: "confortavel", label: "Confortável", descricao: "Espaçamento padrão nas tabelas e painéis." },
  { value: "compacta", label: "Compacta", descricao: "Menos espaço entre linhas — mostra mais informação por tela." },
];

export function getTonalidade(): Tonalidade {
  const v = localStorage.getItem(TONE_KEY);
  return v === "suave" || v === "alto-contraste" ? v : "padrao";
}

export function getDensidade(): Densidade {
  return localStorage.getItem(DENSITY_KEY) === "compacta" ? "compacta" : "confortavel";
}

export function getAccentColor(): string {
  const v = localStorage.getItem(ACCENT_KEY);
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : ACCENT_PADRAO;
}

// ── Contraste (WCAG) ─────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminancia(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function razaoContraste(hexA: string, hexB: string): number {
  const lA = luminancia(hexA);
  const lB = luminancia(hexB);
  const [clara, escura] = lA > lB ? [lA, lB] : [lB, lA];
  return (clara + 0.05) / (escura + 0.05);
}

export type ContrasteInfo = {
  comTextoDoBotao: number; // accent vs. texto escrito em cima dele (botão primário)
  comFundo: number; // accent vs. fundo da página (legibilidade como borda/ícone)
  botaoOk: boolean; // >= 4.5:1 (WCAG AA texto normal)
  fundoOk: boolean; // >= 3:1 (WCAG AA elementos de interface)
};

export function avaliarContraste(accent: string): ContrasteInfo {
  const comTextoDoBotao = razaoContraste(accent, ACCENT_TEXT);
  const comFundo = razaoContraste(accent, PAGE_BG);
  return { comTextoDoBotao, comFundo, botaoOk: comTextoDoBotao >= 4.5, fundoOk: comFundo >= 3 };
}

/** Escurece uma cor hex em `percent` (0-100) — usado pra derivar --accent-strong (hover). */
export function escurecer(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 - percent / 100;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return "#" + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, "0")).join("");
}

function aplicarAccent(color: string) {
  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty("--accent-strong", escurecer(color, 20));
}

/** Aplica a aparência salva (chamado uma vez, na inicialização do app). */
export function aplicarAparenciaSalva() {
  document.documentElement.setAttribute("data-tone", getTonalidade());
  document.documentElement.setAttribute("data-density", getDensidade());
  const accent = localStorage.getItem(ACCENT_KEY);
  if (accent && /^#[0-9a-fA-F]{6}$/.test(accent)) aplicarAccent(accent);
}

/** Salva e aplica imediatamente uma nova tonalidade/densidade. */
export function definirAparencia(tone: Tonalidade, density: Densidade) {
  localStorage.setItem(TONE_KEY, tone);
  localStorage.setItem(DENSITY_KEY, density);
  document.documentElement.setAttribute("data-tone", tone);
  document.documentElement.setAttribute("data-density", density);
}

/** Salva e aplica imediatamente uma nova cor de destaque do sistema. */
export function definirCorDestaque(color: string) {
  localStorage.setItem(ACCENT_KEY, color);
  aplicarAccent(color);
}

/** Remove a cor personalizada e volta pro padrão do sistema. */
export function restaurarCorPadrao() {
  localStorage.removeItem(ACCENT_KEY);
  document.documentElement.style.removeProperty("--accent");
  document.documentElement.style.removeProperty("--accent-strong");
}
