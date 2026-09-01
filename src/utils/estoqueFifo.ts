import type { PersistedRecord } from "../services/persistence";

export type MovimentacaoEstoque = {
  produto: string;
  tipo: "Entrada" | "Saída" | "Ajuste";
  quantidade: number;
  custoUnitario?: number;
  lote?: string;
  validade?: string;
};

export type LoteInfo = { produto: string; lote: string; validade: string; recebida: number; restante: number; status: "vencido" | "vence-em-breve" | "ok" };
export type ConsumoSaida = { custoMedio: number | null; lotes: string[]; validades: string[] };

type LoteFila = { lote: string; validade: string; recebida: number; restante: number; createdAt: string; custoUnitario: number | null };

/** Interpreta "AAAA-MM-DD" como data local (meia-noite no fuso do navegador), evitando o deslocamento de um dia que `new Date(iso)` causa em fusos negativos (UTC parseado, depois exibido local). */
export function parseDataLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Formata "AAAA-MM-DD" como DD/MM/AAAA sem passar por Date — imune a fuso horário. */
export function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Debita as saídas contra os lotes de cada produto seguindo FEFO (First-Expired-First-Out):
 * lotes com validade mais próxima são consumidos primeiro; lotes sem validade informada
 * só entram na fila depois de todos os lotes datados, na ordem em que entraram (mas ainda
 * contribuem custo, mesmo sem lote/validade cadastrados).
 * Retorna os lotes com saldo restante e, por saída, o custo médio ponderado e os lotes/validades
 * de onde ela foi debitada — assim uma venda "herda" o custo real da entrada que a originou,
 * em vez de depender do campo `custoCompra` (às vezes desatualizado) do cadastro do produto.
 */
export function simularFifo(rows: PersistedRecord<MovimentacaoEstoque>[]): { lotes: LoteInfo[]; custoSaidas: Map<string, ConsumoSaida> } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const porProduto = new Map<string, PersistedRecord<MovimentacaoEstoque>[]>();
  for (const r of rows) {
    if (!r.data.produto) continue;
    const lista = porProduto.get(r.data.produto) ?? [];
    lista.push(r);
    porProduto.set(r.data.produto, lista);
  }

  const resultado: LoteInfo[] = [];
  const custoSaidas = new Map<string, ConsumoSaida>();

  for (const [produto, movs] of porProduto) {
    const comValidade: LoteFila[] = [];
    const semValidade: LoteFila[] = [];

    for (const m of movs) {
      if (m.data.tipo !== "Entrada") continue;
      const item: LoteFila = {
        lote: m.data.lote || "(sem lote)", validade: m.data.validade ?? "",
        recebida: m.data.quantidade, restante: m.data.quantidade, createdAt: m.createdAt,
        custoUnitario: typeof m.data.custoUnitario === "number" ? m.data.custoUnitario : null,
      };
      if (m.data.validade) comValidade.push(item);
      else semValidade.push(item);
    }
    comValidade.sort((a, b) => a.validade.localeCompare(b.validade) || a.createdAt.localeCompare(b.createdAt));
    semValidade.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const fila = [...comValidade, ...semValidade];

    const saidas = movs.filter(m => m.data.tipo === "Saída").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const s of saidas) {
      let aBaixar = s.data.quantidade;
      let custoTotal = 0;
      let qtdComCusto = 0;
      const lotesUsados = new Set<string>();
      const validadesUsadas = new Set<string>();
      for (const item of fila) {
        if (aBaixar <= 0) break;
        if (item.restante <= 0) continue;
        const consumo = Math.min(item.restante, aBaixar);
        item.restante -= consumo;
        aBaixar -= consumo;
        lotesUsados.add(item.lote);
        if (item.validade) validadesUsadas.add(item.validade);
        if (item.custoUnitario != null) {
          custoTotal += item.custoUnitario * consumo;
          qtdComCusto += consumo;
        }
      }
      // Se sobrar aBaixar > 0, a saída excede o que está registrado como entrada pra esse produto — não há como atribuir custo/lote à parte que sobra.
      custoSaidas.set(s.id, {
        custoMedio: qtdComCusto > 0 ? custoTotal / qtdComCusto : null,
        lotes: Array.from(lotesUsados),
        validades: Array.from(validadesUsadas).sort(),
      });
    }

    for (const item of comValidade) {
      if (item.restante <= 0) continue;
      const validadeDate = parseDataLocal(item.validade);
      const dias = Math.round((validadeDate.getTime() - hoje.getTime()) / 86400000);
      const status: LoteInfo["status"] = dias < 0 ? "vencido" : dias <= 30 ? "vence-em-breve" : "ok";
      resultado.push({ produto, lote: item.lote, validade: item.validade, recebida: item.recebida, restante: item.restante, status });
    }
  }

  return { lotes: resultado.sort((a, b) => a.validade.localeCompare(b.validade)), custoSaidas };
}
