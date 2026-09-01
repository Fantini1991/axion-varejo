import { useEffect, useRef, useState } from "react";
import { ShoppingBag, Trash2, Camera, ScanLine, Printer } from "lucide-react";
import QRCode from "qrcode";
import MainLayout from "../../layouts/MainLayout";
import { listRecords, createRecord, getOrCreateSingleton, type PersistedRecord } from "../../services/persistence";
import BarcodeScanner from "../../components/BarcodeScanner";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import CupomImpresso, { useAutoPrintCupom, type CupomVenda, type EmpresaCupom, type NfceCupom } from "../../components/CupomImpresso";

type Produto = { codigo: string; nome: string; precoVenda: number; codigoBarras?: string };
type ItemVenda = { produto: string; quantidade: number; precoUnit: number };
type Campanha = { nome: string; ativo: boolean; alvo: "cliente" | "vendedor"; escopo: "geral" | "produtos"; produtos?: string[]; pontosPorReal: number };

export default function Pdv() {
  const { profile } = useAuth();
  const [produtos, setProdutos] = useState<PersistedRecord<Produto>[]>([]);
  const [carrinho, setCarrinho] = useState<ItemVenda[]>([]);
  const [produtoSel, setProdutoSel] = useState("");
  const [qtd, setQtd] = useState(1);
  const [cliente, setCliente] = useState("");
  const [indicador, setIndicador] = useState("");
  const [campanhasAtivas, setCampanhasAtivas] = useState<Campanha[]>([]);
  const [clientesLista, setClientesLista] = useState<PersistedRecord[]>([]);
  const [formaPagamento, setFormaPagamento] = useState("Dinheiro");
  const [tipoVenda, setTipoVenda] = useState<"Normal" | "Troca">("Normal");
  const [descontoTipo, setDescontoTipo] = useState<"percentual" | "valor">("percentual");
  const [descontoValor, setDescontoValor] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [bipagem, setBipagem] = useState("");
  const [bipagemMsg, setBipagemMsg] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [corDestaque, setCorDestaque] = useState("");
  const [fiscalConfigurado, setFiscalConfigurado] = useState(false);
  const [nfceResultado, setNfceResultado] = useState<NfceCupom | null>(null);
  const [emitindoNfce, setEmitindoNfce] = useState(false);
  const [empresa, setEmpresa] = useState<EmpresaCupom>({});
  const [cupom, setCupom] = useState<CupomVenda | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const bipagemRef = useRef<HTMLInputElement>(null);

  async function load() {
    const p = await listRecords<Produto>("produtos");
    setProdutos(p);
  }

  useEffect(() => {
    load();
    getOrCreateSingleton<EmpresaCupom & { logoUrl?: string; corDestaquePdv?: string }>("empresa-config", {}).then(r => {
      setLogoUrl(r.data.logoUrl ?? "");
      setCorDestaque(r.data.corDestaquePdv ?? "");
      setEmpresa(r.data);
    });
    supabase.functions.invoke("fiscal-config", { method: "GET" }).then(({ data }) => {
      setFiscalConfigurado(Boolean((data as { configurado?: boolean })?.configurado));
    });
    listRecords<Campanha>("campanhas-fidelidade").then(rows => {
      setCampanhasAtivas(rows.filter(r => r.data.ativo).map(r => r.data));
    });
    listRecords("clientes").then(setClientesLista);
  }, []);
  useEffect(() => { bipagemRef.current?.focus(); }, [produtos]);

  // Atalhos de teclado estilo PDV de mercado — F2 bipar, F4 remover último, F8 finalizar, F9 cancelar.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") { e.preventDefault(); bipagemRef.current?.focus(); }
      else if (e.key === "F4") { e.preventDefault(); setCarrinho(c => c.slice(0, -1)); }
      else if (e.key === "F8") { e.preventDefault(); document.getElementById("btn-finalizar-venda")?.click(); }
      else if (e.key === "F9") { e.preventDefault(); if (confirm("Cancelar a venda em andamento?")) { setCarrinho([]); setCliente(""); } }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function addItem() {
    const p = produtos.find(x => x.data.codigo === produtoSel);
    if (!p || qtd <= 0) return;
    setCarrinho(c => [...c, { produto: `${p.data.codigo} — ${p.data.nome}`, quantidade: qtd, precoUnit: p.data.precoVenda }]);
    setProdutoSel("");
    setQtd(1);
  }

  function adicionarPorCodigoBarras(codigo: string) {
    const limpo = codigo.trim();
    if (!limpo) return;
    const p = produtos.find(x => x.data.codigoBarras && x.data.codigoBarras === limpo);
    if (!p) {
      setBipagemMsg(`Nenhum produto com o código de barras "${limpo}".`);
      return;
    }
    const label = `${p.data.codigo} — ${p.data.nome}`;
    setCarrinho(c => {
      const idx = c.findIndex(i => i.produto === label);
      if (idx >= 0) {
        const next = [...c];
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + 1 };
        return next;
      }
      return [...c, { produto: label, quantidade: 1, precoUnit: p.data.precoVenda }];
    });
    setBipagemMsg(`Adicionado: ${p.data.nome}`);
  }

  function handleBipagemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    adicionarPorCodigoBarras(bipagem);
    setBipagem("");
  }

  function handleCameraResult(codigo: string) {
    setShowScanner(false);
    adicionarPorCodigoBarras(codigo);
  }

  function removeItem(i: number) {
    setCarrinho(c => c.filter((_, idx) => idx !== i));
  }

  const subtotal = carrinho.reduce((sum, i) => sum + i.quantidade * i.precoUnit, 0);
  const descontoAplicado = descontoTipo === "percentual" ? subtotal * (descontoValor / 100) : descontoValor;
  const total = Math.max(0, subtotal - descontoAplicado);

  useAutoPrintCupom(cupom);

  async function finalizarVenda() {
    if (carrinho.length === 0) return;
    setSaving(true);
    setError("");
    setNfceResultado(null);
    setCupom(null);
    setQrCodeDataUrl("");
    let nfceResult: NfceCupom | null = null;
    try {
      if (fiscalConfigurado && tipoVenda !== "Troca") {
        setEmitindoNfce(true);
        try {
          const { data, error: fnError } = await supabase.functions.invoke("nfce-emitir", {
            body: { itens: carrinho, formaPagamento, total },
          });
          const result = data as { ok?: boolean; error?: string; erro?: string; xMotivo?: string; chave?: string; qrCodeUrl?: string };
          if (fnError || result?.error) {
            nfceResult = { ok: false, mensagem: result?.error ?? fnError?.message ?? "Erro ao emitir NFC-e." };
          } else if (!result?.ok) {
            nfceResult = { ok: false, mensagem: result?.erro ?? result?.xMotivo ?? "A SEFAZ rejeitou a nota." };
          } else {
            nfceResult = { ok: true, chave: result.chave, qrCodeUrl: result.qrCodeUrl, mensagem: "NFC-e emitida com sucesso." };
          }
          setNfceResultado(nfceResult);
        } finally {
          setEmitindoNfce(false);
        }
      }

      await createRecord("pdv-vendas", {
        cliente: cliente || "Consumidor final", itens: carrinho, total, formaPagamento,
        tipoVenda, desconto: descontoAplicado, nfce: nfceResult,
      });
      for (const item of carrinho) {
        await createRecord("estoque-movimentacoes", { produto: item.produto, tipo: "Saída", quantidade: item.quantidade, motivo: tipoVenda === "Troca" ? "Troca PDV" : "Venda PDV" });
      }

      if (tipoVenda !== "Troca") {
        for (const campanha of campanhasAtivas) {
          const parceiro = campanha.alvo === "vendedor" ? (profile?.full_name || "Vendedor") : indicador;
          if (!parceiro) continue; // campanha de cliente sem indicador selecionado nessa venda — não gera ponto
          const valorElegivel = campanha.escopo === "geral"
            ? total
            : carrinho.filter(i => campanha.produtos?.includes(i.produto)).reduce((s, i) => s + i.quantidade * i.precoUnit, 0);
          const pontos = Math.floor(valorElegivel * campanha.pontosPorReal);
          if (pontos > 0) {
            await createRecord("pontos-fidelidade", {
              parceiro, tipo: "Ganho", pontos, alvo: campanha.alvo,
              motivo: `Venda PDV — ${campanha.nome}`, data: new Date().toISOString(),
            });
          }
        }
      }

      let qrDataUrl = "";
      if (nfceResult?.ok && nfceResult.qrCodeUrl) {
        try { qrDataUrl = await QRCode.toDataURL(nfceResult.qrCodeUrl, { margin: 1, width: 160 }); } catch { qrDataUrl = ""; }
      }
      setQrCodeDataUrl(qrDataUrl);
      setCupom({
        data: new Date().toISOString(),
        itens: carrinho,
        subtotal,
        desconto: descontoAplicado,
        total,
        formaPagamento,
        tipoVenda,
        cliente: cliente || "Consumidor final",
        nfce: nfceResult,
      });

      setCarrinho([]);
      setCliente("");
      setIndicador("");
      setDescontoValor(0);
      setTipoVenda("Normal");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar venda.");
    } finally {
      setSaving(false);
    }
  }

  function imprimirCupom() {
    window.print();
  }

  const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-input)", color: "var(--text-strong)", fontSize: 13.5 };

  return (
    <MainLayout>
      <div style={corDestaque ? ({ "--accent": corDestaque, "--accent-strong": corDestaque } as React.CSSProperties) : undefined}>
      <div className="module-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {logoUrl && <img src={logoUrl} alt="Logo da empresa" style={{ height: 44, objectFit: "contain" }} />}
          <div>
            <span>Vendas</span>
            <h1>PDV — Venda de Balcão</h1>
            <p>Registro de venda direta ao consumidor final.</p>
          </div>
        </div>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 12, alignSelf: "start" }}>
          <h2 style={{ margin: 0, fontSize: 15, color: "var(--text-strong)" }}>Fechamento</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>CLIENTE (opcional)</label>
              <input style={{ ...inp, width: "100%" }} value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Consumidor final" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>TIPO DE VENDA</label>
              <select style={{ ...inp, width: "100%" }} value={tipoVenda} onChange={e => setTipoVenda(e.target.value as "Normal" | "Troca")}>
                <option value="Normal">Venda normal</option>
                <option value="Troca">Troca</option>
              </select>
            </div>
          </div>
          {campanhasAtivas.some(c => c.alvo === "cliente") && tipoVenda !== "Troca" && (
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>INDICADO POR (opcional — ganha pontos de fidelidade)</label>
              <select style={{ ...inp, width: "100%" }} value={indicador} onChange={e => setIndicador(e.target.value)}>
                <option value="">Nenhum</option>
                {clientesLista.map(c => <option key={c.id} value={String(c.data.nome)}>{String(c.data.nome)}</option>)}
              </select>
            </div>
          )}
          {tipoVenda === "Troca" && (
            <p style={{ fontSize: 11, color: "#f59e0b", margin: 0, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, padding: "6px 10px" }}>
              Marcada como troca — não emite NFC-e automaticamente. Fica identificada no Histórico de Vendas.
            </p>
          )}
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>FORMA DE PAGAMENTO</label>
            <select style={{ ...inp, width: "100%" }} value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}>
              <option>Dinheiro</option>
              <option>Cartão de Débito</option>
              <option>Cartão de Crédito</option>
              <option>Pix</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>DESCONTO (opcional)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select style={{ ...inp, width: 90 }} value={descontoTipo} onChange={e => setDescontoTipo(e.target.value as "percentual" | "valor")}>
                <option value="percentual">%</option>
                <option value="valor">R$</option>
              </select>
              <input type="number" min={0} step="0.01" style={{ ...inp, flex: 1 }} value={descontoValor || ""} onChange={e => setDescontoValor(Number(e.target.value))} placeholder="0" />
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            {descontoAplicado > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted)", marginBottom: 4 }}>
                <span>Subtotal</span><span>{subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
            )}
            {descontoAplicado > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#f59e0b", marginBottom: 4 }}>
                <span>Desconto</span><span>-{descontoAplicado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
            )}
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--accent)", textAlign: "right" }}>
              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
          {fiscalConfigurado
            ? <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, textAlign: "center" }}>Emite NFC-e automaticamente ao finalizar.</p>
            : <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, textAlign: "center" }}>Sem certificado fiscal configurado — venda registrada sem NFC-e.</p>}

          {nfceResultado && (
            <div style={{
              border: "1px solid", borderColor: nfceResultado.ok ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)",
              background: nfceResultado.ok ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)",
              borderRadius: 8, padding: "10px 12px", fontSize: 12.5,
            }}>
              <div style={{ fontWeight: 700, color: nfceResultado.ok ? "#4ade80" : "var(--danger)" }}>{nfceResultado.mensagem}</div>
              {nfceResultado.chave && <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all" }}>{nfceResultado.chave}</div>}
              {nfceResultado.qrCodeUrl && (
                <a href={nfceResultado.qrCodeUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 6, color: "var(--accent)", fontSize: 12 }}>
                  Ver comprovante da NFC-e →
                </a>
              )}
            </div>
          )}

          {cupom && (
            <button type="button" onClick={imprimirCupom} className="btn" style={{ width: "100%", justifyContent: "center" }}>
              <Printer size={15} /> Imprimir cupom
            </button>
          )}
        </div>

        <div className="panel">
          <div className="panel-header"><h2 style={{ margin: 0, fontSize: 15, color: "var(--text-strong)" }}>Adicionar item</h2></div>

          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <ScanLine size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--accent)" }} />
              <input
                ref={bipagemRef}
                style={{ ...inp, width: "100%", paddingLeft: 34 }}
                value={bipagem}
                onChange={e => { setBipagem(e.target.value); setBipagemMsg(""); }}
                onKeyDown={handleBipagemKeyDown}
                placeholder="Bipe o código de barras..."
              />
            </div>
            <button onClick={() => setShowScanner(true)} className="btn" type="button">
              <Camera size={15} /> Câmera
            </button>
          </div>
          {bipagemMsg && <div style={{ fontSize: 12, color: bipagemMsg.startsWith("Nenhum") ? "var(--danger)" : "#4ade80", marginBottom: 12 }}>{bipagemMsg}</div>}

          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <select style={{ ...inp, flex: 1, minWidth: 200 }} value={produtoSel} onChange={e => setProdutoSel(e.target.value)}>
              <option value="">Ou selecione manualmente...</option>
              {produtos.map(p => <option key={p.id} value={p.data.codigo}>{p.data.codigo} — {p.data.nome} ({Number(p.data.precoVenda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})</option>)}
            </select>
            <input type="number" min={1} style={{ ...inp, width: 80 }} value={qtd} onChange={e => setQtd(Number(e.target.value))} />
            <button onClick={addItem} className="btn btn-save" type="button">Adicionar</button>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "auto" }}>
            <table className="data-table" style={{ fontSize: 12.5 }}>
              <thead><tr><th style={{ padding: "6px 10px" }}>#</th><th style={{ padding: "6px 10px" }}>PRODUTO</th><th style={{ padding: "6px 10px" }}>QTD</th><th style={{ padding: "6px 10px" }}>UNIT.</th><th style={{ padding: "6px 10px" }}>SUBTOTAL</th><th style={{ padding: "6px 10px", width: 32 }} /></tr></thead>
              <tbody>
                {carrinho.length === 0 && <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: "var(--text-muted)" }}>Carrinho vazio. Bipe um produto ou aperte F2.</td></tr>}
                {carrinho.map((item, i) => (
                  <tr key={i} style={{ background: i % 2 === 1 ? "color-mix(in srgb, var(--surface-input) 55%, transparent)" : undefined }}>
                    <td style={{ padding: "4px 10px", color: "var(--text-muted)", fontFamily: "monospace" }}>{i + 1}</td>
                    <td style={{ padding: "4px 10px" }}>{item.produto}</td>
                    <td style={{ padding: "4px 10px", fontFamily: "monospace" }}>{item.quantidade}</td>
                    <td style={{ padding: "4px 10px", fontFamily: "monospace" }}>{item.precoUnit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td style={{ padding: "4px 10px", fontFamily: "monospace", fontWeight: 700, color: "var(--text-strong)" }}>{(item.quantidade * item.precoUnit).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td style={{ padding: "4px 6px" }}><button onClick={() => removeItem(i)} className="icon-btn" style={{ color: "var(--danger)" }}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 16 }}>
        <button type="button" onClick={() => bipagemRef.current?.focus()}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: "#2563eb", color: "#fff", fontWeight: 700 }}>
          <span style={{ fontSize: 11, opacity: 0.85 }}>F2</span>
          <span style={{ fontSize: 12.5 }}>Bipar item</span>
        </button>
        <button type="button" onClick={() => setCarrinho(c => c.slice(0, -1))} disabled={carrinho.length === 0}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: "#ea580c", color: "#fff", fontWeight: 700, opacity: carrinho.length === 0 ? 0.5 : 1 }}>
          <span style={{ fontSize: 11, opacity: 0.85 }}>F4</span>
          <span style={{ fontSize: 12.5 }}>Remover último</span>
        </button>
        <button type="button" onClick={() => { if (confirm("Cancelar a venda em andamento?")) { setCarrinho([]); setCliente(""); } }} disabled={carrinho.length === 0}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: "#dc2626", color: "#fff", fontWeight: 700, opacity: carrinho.length === 0 ? 0.5 : 1 }}>
          <span style={{ fontSize: 11, opacity: 0.85 }}>F9</span>
          <span style={{ fontSize: 12.5 }}>Cancelar venda</span>
        </button>
        <button id="btn-finalizar-venda" type="button" onClick={finalizarVenda} disabled={saving || carrinho.length === 0}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: "#16a34a", color: "#fff", fontWeight: 800, fontSize: 14, opacity: (saving || carrinho.length === 0) ? 0.6 : 1 }}>
          <ShoppingBag size={16} />
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.85 }}>F8</span>
            <span>{saving ? (emitindoNfce ? "Emitindo NFC-e..." : "Registrando...") : "Finalizar venda"}</span>
          </span>
        </button>
      </div>

      </div>

      {showScanner && <BarcodeScanner onResult={handleCameraResult} onClose={() => setShowScanner(false)} />}

      {cupom && <CupomImpresso cupom={cupom} empresa={empresa} qrCodeDataUrl={qrCodeDataUrl} />}
    </MainLayout>
  );
}
