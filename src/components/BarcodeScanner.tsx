import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, X } from "lucide-react";

/** Leitor de código de barras via câmera (Code128, EAN-13, UPC, etc). Mesmo padrão usado no Axion One. */
export default function BarcodeScanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "scanning" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const readerRef = useRef<import("@zxing/browser").BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices.length) { setErrorMsg("Nenhuma câmera encontrada."); setStatus("error"); return; }

        const cam = devices.find(d => /back|rear|trás|ambiente/i.test(d.label)) ?? devices[devices.length - 1];

        if (!active || !videoRef.current) return;
        setStatus("scanning");

        await reader.decodeFromVideoDevice(cam.deviceId, videoRef.current, (result, err) => {
          if (!active) return;
          if (result) onResult(result.getText());
          void err;
        });
      } catch (e) {
        if (!active) return;
        setErrorMsg(String(e));
        setStatus("error");
      }
    }

    void start();

    return () => {
      active = false;
      try { (readerRef.current as { reset?: () => void })?.reset?.(); } catch { /* ignore */ }
    };
  }, [onResult]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 16, padding: 24, width: "min(480px, 92vw)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, color: "var(--text-strong)" }}>Leitura de código de barras</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Aponte a câmera para o código de barras do produto</p>
          </div>
          <button onClick={onClose} type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
        </div>

        {status === "loading" && (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            <Camera size={32} style={{ marginRight: 10, opacity: 0.5 }} /> Iniciando câmera...
          </div>
        )}
        {status === "error" && (
          <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--danger)" }}>
            <CameraOff size={40} />
            <p style={{ fontSize: 13, textAlign: "center" }}>{errorMsg || "Erro ao acessar a câmera."}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Verifique as permissões de câmera no navegador.</p>
          </div>
        )}

        <video
          ref={videoRef}
          style={{ width: "100%", borderRadius: 10, display: status === "scanning" ? "block" : "none", background: "#000" }}
          autoPlay playsInline muted
        />

        {status === "scanning" && (
          <div style={{ marginTop: 12, padding: "8px 14px", background: "color-mix(in srgb, var(--accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", borderRadius: 8, fontSize: 12, color: "var(--accent)", textAlign: "center" }}>
            Câmera ativa — posicione o código de barras no centro da imagem
          </div>
        )}
      </div>
    </div>
  );
}
