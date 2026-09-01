import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import MainLayout from "../../layouts/MainLayout";
import { listRecords, getOrCreateSingleton, type PersistedRecord } from "../../services/persistence";
import QRCode from "qrcode";
import CupomImpresso, { useAutoPrintCupom, type CupomVenda, type EmpresaCupom, type ItemVendaCupom, type NfceCupom } from "../../components/CupomImpresso";

type Venda = {
  cliente: string;
  itens: ItemVendaCupom[];
  total: number;
  formaPagamento: string;
  tipoVenda?: "Normal" | "Troca";
  desconto?: number;
  nfce?: NfceCupom | null;
};

export default function HistoricoVendas() {
  const [vendas, setVendas] = useState<PersistedRecord<Venda>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [empresa, setEmpresa] = useState<EmpresaCupom>({});
  const [cupomReprint, setCupomReprint] = useState<CupomVenda | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  useAutoPrintCupom(cupomReprint);

  useEffect(() => {
    listRecords<Venda>("pdv-vendas").then(v => { setVendas(v); setLoading(false); });
    getOrCreateSingleton<EmpresaCupom>("empresa-config", {}).then(r => setEmpresa(r.data));
  }, []);

  async function reimprimirCupom(v: PersistedRecord<Venda>) {
    const desconto = v.data.desconto ?? 0;
    const total = Number(v.data.total ?? 0);
    let qrDataUrl = "";
    if (v.data.nfce?.ok && v.data.nfce.qrCodeUrl) {
      try { qrDataUrl = await QRCode.toDataURL(v.data.nfce.qrCodeUrl, { margin: 1, width: 160 }); } catch { qrDataUrl = ""; }
    }
    setQrCodeDataUrl(qrDataUrl);
    setCupomReprint({
      data: v.createdAt,
      itens: v.data.itens ?? [],
      subtotal: total + desconto,
      desconto,
      total,
      formaPagamento: v.data.formaPagamento,
      tipoVenda: v.data.tipoVenda === "Troca" ? "Troca" : "Normal",
      cliente: v.data.cliente,
      nfce: v.data.nfce ?? null,
    });
  }

  const filtradas = vendas.filter(v =>
    !busca || v.data.cliente?.toLowerCase().includes(busca.toLowerCase()) || v.data.formaPagamento?.toLowerCase().includes(busca.toLowerCase()),
  );

  const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-input)", color: "var(--text-strong)", fontSize: 13.5 };

  return (
    <MainLayout>
      <div className="module-hero">
        <div>
          <span>Vendas</span>
          <h1>Histórico de Vendas</h1>
          <p>Todas as vendas registradas no PDV.</p>
        </div>
        <input style={{ ...inp, width: 260 }} placeholder="Buscar por cliente ou pagamento..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div className="panel" style={{ padding: 0, overflow: "auto" }}>
        <table className="data-table">
          <thead><tr><th>CLIENTE</th><th>TIPO</th><th>ITENS</th><th>DESCONTO</th><th>TOTAL</th><th>PAGAMENTO</th><th>DATA</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
            {!loading && filtradas.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhuma venda registrada ainda.</td></tr>}
            {filtradas.map(v => (
              <tr key={v.id}>
                <td style={{ fontWeight: 600, color: "var(--text-strong)" }}>{v.data.cliente}</td>
                <td>
                  {v.data.tipoVenda === "Troca"
                    ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>Troca</span>
                    : <span style={{ color: "var(--text-muted)" }}>Venda</span>}
                </td>
                <td>{v.data.itens?.length ?? 0} item(ns)</td>
                <td>{v.data.desconto ? v.data.desconto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
                <td>{Number(v.data.total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                <td>{v.data.formaPagamento}</td>
                <td style={{ color: "var(--text-muted)" }}>{new Date(v.createdAt).toLocaleString("pt-BR")}</td>
                <td>
                  <button type="button" onClick={() => reimprimirCupom(v)} className="icon-btn" title="Reimprimir cupom">
                    <Printer size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cupomReprint && <CupomImpresso cupom={cupomReprint} empresa={empresa} qrCodeDataUrl={qrCodeDataUrl} />}
    </MainLayout>
  );
}
