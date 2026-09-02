import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, KeyRound, ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import loginHero from "../assets/login-hero.webp";
import LoginFooter from "../components/LoginFooter";

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") setPronto(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (senha.length < 8) { setError("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (senha !== confirmarSenha) { setError("As senhas não coincidem."); return; }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: senha });
      if (updateError) throw updateError;
      setSucesso(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen" style={{ backgroundImage: `url(${loginHero})` }}>
      <div className="login-glow" />
      <form onSubmit={handleSubmit} className="login-card">
        <div className="login-lock">
          <LockKeyhole size={22} strokeWidth={1.7} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-strong)" }}>Nova senha</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 0" }}>
            {sucesso ? "" : pronto ? "Escolha uma nova senha pra sua conta." : "Confirmando o link de redefinição..."}
          </p>
        </div>

        {sucesso ? (
          <div style={{ fontSize: 13, color: "#4ade80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 8, padding: "9px 12px", textAlign: "center" }}>
            Senha redefinida! Levando você pro login...
          </div>
        ) : (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>Nova senha</span>
              <div className="login-field">
                <KeyRound size={16} />
                <input type="password" required minLength={8} placeholder="mínimo 8 caracteres" value={senha} onChange={e => setSenha(e.target.value)} disabled={!pronto} />
              </div>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>Confirmar nova senha</span>
              <div className="login-field">
                <KeyRound size={16} />
                <input type="password" required minLength={8} placeholder="digite de novo" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} disabled={!pronto} />
              </div>
            </label>

            {!pronto && (
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0, textAlign: "center" }}>
                Se essa mensagem não sumir, o link pode ter expirado — peça um novo em "Esqueci minha senha" na tela de login.
              </p>
            )}

            {error && (
              <div style={{ fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "9px 12px", textAlign: "center" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={!pronto || loading} className="btn-login">
              {loading ? "Salvando..." : "Redefinir senha"} <ArrowRight size={16} />
            </button>
          </>
        )}
      </form>

      <LoginFooter />
    </div>
  );
}
