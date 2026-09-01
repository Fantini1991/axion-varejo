export type NFeItem = {
  codigoFornecedor: string;
  descricao: string;
  ncm: string;
  quantidade: number;
  valorUnitario: number;
  lote?: string;
  validade?: string;
};

export type NFeParsed = {
  numeroNota: string;
  dataEmissao: string;
  fornecedorCnpj: string;
  fornecedorNome: string;
  itens: NFeItem[];
};

function text(el: Element | null | undefined, tag: string): string {
  return el?.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
}

function number(el: Element | null | undefined, tag: string): number {
  const raw = text(el, tag);
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Extrai fornecedor, número da nota e itens de um XML de NF-e (modelo 55, padrão SEFAZ). */
export function parseNFeXml(xmlText: string): NFeParsed {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = doc.getElementsByTagName("parsererror")[0];
  if (parserError) throw new Error("Arquivo XML inválido ou corrompido.");

  const infNFe = doc.getElementsByTagName("infNFe")[0];
  if (!infNFe) throw new Error("Este arquivo não parece ser uma NF-e válida (tag infNFe não encontrada).");

  const emit = infNFe.getElementsByTagName("emit")[0];
  const ide = infNFe.getElementsByTagName("ide")[0];
  const detNodes = Array.from(infNFe.getElementsByTagName("det"));

  const itens: NFeItem[] = detNodes.map(det => {
    const prod = det.getElementsByTagName("prod")[0];
    const rastro = prod?.getElementsByTagName("rastro")[0];
    return {
      codigoFornecedor: text(prod, "cProd"),
      descricao: text(prod, "xProd"),
      ncm: text(prod, "NCM"),
      quantidade: number(prod, "qCom"),
      valorUnitario: number(prod, "vUnCom"),
      lote: rastro ? text(rastro, "nLote") : "",
      validade: rastro ? text(rastro, "dVal") : "",
    };
  });

  if (itens.length === 0) throw new Error("Nenhum item encontrado nesta nota.");

  return {
    numeroNota: text(ide, "nNF"),
    dataEmissao: text(ide, "dhEmi").slice(0, 10) || new Date().toISOString().slice(0, 10),
    fornecedorCnpj: text(emit, "CNPJ"),
    fornecedorNome: text(emit, "xNome"),
    itens,
  };
}

export function normalizarCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}
