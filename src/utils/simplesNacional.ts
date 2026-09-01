/** Tabela do Simples Nacional — Anexo I (Comércio/Revenda de mercadorias). Valores vigentes desde a LC 155/2016. */
const ANEXO_I = [
  { ate: 180_000, aliquota: 0.04, deducao: 0 },
  { ate: 360_000, aliquota: 0.073, deducao: 5_940 },
  { ate: 720_000, aliquota: 0.095, deducao: 13_860 },
  { ate: 1_800_000, aliquota: 0.107, deducao: 22_500 },
  { ate: 3_600_000, aliquota: 0.143, deducao: 87_300 },
  { ate: 4_800_000, aliquota: 0.19, deducao: 378_000 },
];

/** Alíquota efetiva do DAS (Simples Nacional, comércio) para um faturamento bruto dos últimos 12 meses. */
export function calcularAliquotaEfetivaSimples(faturamento12Meses: number): number {
  if (faturamento12Meses <= 0) return 0;
  const faixa = ANEXO_I.find(f => faturamento12Meses <= f.ate) ?? ANEXO_I[ANEXO_I.length - 1];
  const efetiva = (faturamento12Meses * faixa.aliquota - faixa.deducao) / faturamento12Meses;
  return Math.max(0, Number((efetiva * 100).toFixed(2)));
}

export type RegimeTributario = "Simples Nacional" | "Lucro Presumido" | "Lucro Real";
