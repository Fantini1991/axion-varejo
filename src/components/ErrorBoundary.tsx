import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info });
    console.error("[ErrorBoundary] Erro capturado:", {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
  }

  private buildReport(): string {
    const { error, errorInfo } = this.state;
    return [
      `URL: ${window.location.href}`,
      `Data/Hora: ${new Date().toLocaleString("pt-BR")}`,
      `Erro: ${error?.message ?? "desconhecido"}`,
      `Stack: ${error?.stack ?? ""}`,
      `Componente: ${errorInfo?.componentStack ?? ""}`,
    ].join("\n");
  }

  private handleCopy = () => {
    void navigator.clipboard.writeText(this.buildReport());
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#050816", padding: 32,
      }}>
        <div style={{
          maxWidth: 560, width: "100%", background: "rgba(239,68,68,0.07)",
          border: "1px solid rgba(239,68,68,0.3)", borderRadius: 16, padding: "32px 36px",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>
            Algo deu errado
          </h1>
          <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20, lineHeight: 1.6 }}>
            Um erro inesperado ocorreu nesta página. As suas alterações anteriores não foram perdidas.
          </p>

          <div style={{
            background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "12px 14px",
            marginBottom: 20, fontFamily: "monospace", fontSize: 12,
            color: "#f87171", maxHeight: 120, overflow: "auto",
            whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}>
            {this.state.error?.message ?? "Erro desconhecido"}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: "9px 20px", borderRadius: 8, border: "none",
                background: "#22d3ee", color: "#0f172a", fontWeight: 700,
                fontSize: 13, cursor: "pointer",
              }}
            >
              🔄 Recarregar página
            </button>
            <button
              onClick={this.handleCopy}
              style={{
                padding: "9px 20px", borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.4)",
                background: "transparent", color: "#ef4444",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}
            >
              📋 Copiar detalhes do erro
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              style={{
                padding: "9px 20px", borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.3)",
                background: "transparent", color: "#94a3b8",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}
            >
              🏠 Voltar ao início
            </button>
          </div>

          <p style={{ fontSize: 11, color: "#64748b", marginTop: 20 }}>
            Se o problema persistir, copie os detalhes e envie para o suporte técnico.
          </p>
        </div>
      </div>
    );
  }
}
