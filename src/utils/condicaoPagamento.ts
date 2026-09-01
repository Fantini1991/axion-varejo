export const CONDICOES_PAGAMENTO = [
  { value: "avista", label: "À vista", dias: [0] },
  { value: "30", label: "30 dias", dias: [30] },
  { value: "45", label: "45 dias", dias: [45] },
  { value: "60", label: "60 dias", dias: [60] },
  { value: "3060", label: "30/60 dias", dias: [30, 60] },
  { value: "306090", label: "30/60/90 dias", dias: [30, 60, 90] },
] as const;

export type CondicaoPagamentoValue = (typeof CONDICOES_PAGAMENTO)[number]["value"];

/** Gera as parcelas (valor + vencimento) a partir da condição de pagamento e uma data base. */
export function gerarParcelas(condicao: string, valorTotal: number, dataBase: string): { valor: number; vencimento: string }[] {
  const cfg = CONDICOES_PAGAMENTO.find(c => c.value === condicao) ?? CONDICOES_PAGAMENTO[0];
  const valorParcela = Number((valorTotal / cfg.dias.length).toFixed(2));
  const base = new Date(dataBase);
  return cfg.dias.map((dias, idx) => {
    const venc = new Date(base);
    venc.setDate(venc.getDate() + dias);
    // Ajusta a última parcela pra compensar arredondamento.
    const isUltima = idx === cfg.dias.length - 1;
    const valor = isUltima ? Number((valorTotal - valorParcela * (cfg.dias.length - 1)).toFixed(2)) : valorParcela;
    return { valor, vencimento: venc.toISOString().slice(0, 10) };
  });
}
