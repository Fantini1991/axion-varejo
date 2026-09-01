import { useEffect } from "react";

export type ItemVendaCupom = { produto: string; quantidade: number; precoUnit: number };
export type EmpresaCupom = { nome?: string; cnpj?: string; telefone?: string; logradouro?: string; numero?: string; bairro?: string; cidadeNome?: string; uf?: string; cep?: string };
export type NfceCupom = { ok: boolean; chave?: string; qrCodeUrl?: string; mensagem: string };
export type CupomVenda = {
  data: string;
  itens: ItemVendaCupom[];
  subtotal: number;
  desconto: number;
  total: number;
  formaPagamento: string;
  tipoVenda: "Normal" | "Troca";
  cliente: string;
  nfce: NfceCupom | null;
};

/**
 * Dispara `window.print()` toda vez que um novo objeto de cupom é definido (nova venda finalizada,
 * ou reimpressão pedida no Histórico) — assim que ele, e o QR code se houver, já estiverem no DOM.
 * `cupom` deve ser um objeto novo a cada chamada de set-state (mesmo reimprimindo a mesma venda),
 * pra que o efeito dispare de novo — não usar o mesmo objeto entre chamadas.
 */
export function useAutoPrintCupom(cupom: CupomVenda | null) {
  useEffect(() => {
    if (cupom) {
      const t = setTimeout(() => window.print(), 150);
      return () => clearTimeout(t);
    }
  }, [cupom]);
}

export default function CupomImpresso({ cupom, empresa, qrCodeDataUrl }: { cupom: CupomVenda; empresa: EmpresaCupom; qrCodeDataUrl: string }) {
  return (
    <div className="cupom-print">
      <div style={{ textAlign: "center" }}>
        <strong>{empresa.nome || "—"}</strong><br />
        {empresa.cnpj && <>CNPJ: {empresa.cnpj}<br /></>}
        {(empresa.logradouro || empresa.numero) && <>{empresa.logradouro}{empresa.numero ? `, ${empresa.numero}` : ""}<br /></>}
        {(empresa.bairro || empresa.cidadeNome || empresa.uf) && <>{[empresa.bairro, empresa.cidadeNome && empresa.uf ? `${empresa.cidadeNome}/${empresa.uf}` : empresa.cidadeNome].filter(Boolean).join(" — ")}<br /></>}
        {empresa.telefone && <>Tel: {empresa.telefone}<br /></>}
      </div>
      <hr />
      <div style={{ textAlign: "center", fontWeight: 700 }}>
        {cupom.nfce?.ok ? "DOCUMENTO AUXILIAR DA NFC-e" : "CUPOM NÃO FISCAL"}
      </div>
      <div>{new Date(cupom.data).toLocaleString("pt-BR")}</div>
      <div>Cliente: {cupom.cliente}</div>
      {cupom.tipoVenda === "Troca" && <div>*** TROCA ***</div>}
      <hr />
      {cupom.itens.map((item, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <div>{item.produto}</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{item.quantidade} x {item.precoUnit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            <span>{(item.quantidade * item.precoUnit).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
          </div>
        </div>
      ))}
      <hr />
      {cupom.desconto > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{cupom.subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Desconto</span><span>-{cupom.desconto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
        </>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}>
        <span>TOTAL</span><span>{cupom.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
      </div>
      <div>Forma de pagamento: {cupom.formaPagamento}</div>
      <hr />
      {cupom.nfce?.ok ? (
        <div style={{ textAlign: "center" }}>
          {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="QR Code da NFC-e" style={{ width: 120, height: 120 }} />}
          {cupom.nfce.chave && <div style={{ wordBreak: "break-all", fontSize: 9, marginTop: 4 }}>Chave de acesso: {cupom.nfce.chave}</div>}
          <div style={{ fontSize: 9, marginTop: 2 }}>Consulte pela Chave de Acesso no site da Sefaz</div>
        </div>
      ) : (
        <div style={{ textAlign: "center", fontSize: 10 }}>Este documento não tem valor fiscal.</div>
      )}
    </div>
  );
}
