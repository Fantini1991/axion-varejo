import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, User, KeyRound, ArrowRight, Smartphone, Mail, MessageCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import loginHero from "../assets/login-hero.webp";
import LoginFooter from "../components/LoginFooter";

const SUPORTE_WHATSAPP = "5511964468588";

/** Resolve o identificador digitado (e-mail ou usuário) pro e-mail real usado no login. */
async function resolveLoginEmail(identifier: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("resolve-login", { body: { identifier } });
    if (error) return null;
    const result = data as { ok?: boolean; email?: string };
    return result.ok && result.email ? result.email : null;
  } catch {
    return null;
  }
}

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

type Step = "password" | "totp-setup" | "totp-verify" | "esqueci-senha";

export default function Login() {
  const { signIn, completeMfa } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  // Estado do fluxo de 2FA
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");

  // Estado do fluxo "esqueci minha senha"
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetEnviado, setResetEnviado] = useState(false);

  function abrirEsqueciSenha() {
    setResetEmail(identifier.includes("@") ? identifier : "");
    setResetError("");
    setResetEnviado(false);
    setStep("esqueci-senha");
  }

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setResetError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      setResetEnviado(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Erro ao enviar o link de redefinição.");
    } finally {
      setResetLoading(false);
    }
  }

  async function startMfaFlow() {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;

    const existing = factors.totp[0];
    if (existing) {
      // Usuário já tem 2FA configurado: pede o código.
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: existing.id });
      if (challengeError) throw challengeError;
      setFactorId(existing.id);
      setChallengeId(challenge.id);
      setStep("totp-verify");
    } else {
      // Primeiro acesso: obrigatório configurar o autenticador.
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Axion Varejo" });
      if (enrollError) throw enrollError;
      setFactorId(enrolled.id);
      setQrCode(enrolled.totp.qr_code);
      setSecret(enrolled.totp.secret);
      setStep("totp-setup");
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();

    if (lockedUntil && Date.now() < lockedUntil) {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      setError(`Muitas tentativas. Aguarde ${remaining}s para tentar novamente.`);
      return;
    }

    setLoading(true);
    setError("");

    const resolvedEmail = await resolveLoginEmail(identifier.trim());
    const { error } = resolvedEmail
      ? await signIn(resolvedEmail, password)
      : { error: "Invalid login credentials" };

    if (error) {
      const attempts = failedAttempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCK_MS);
        setFailedAttempts(0);
        setError("Muitas tentativas incorretas. Conta bloqueada por 5 minutos.");
      } else {
        setFailedAttempts(attempts);
        setError(error);
      }
      setLoading(false);
      return;
    }

    setFailedAttempts(0);
    setLockedUntil(null);
    try {
      await startMfaFlow();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar verificação em duas etapas.");
    }
    setLoading(false);
  }

  async function handleTotpSetup(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: totpCode });
      if (verifyError) throw verifyError;
      await completeMfa();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código incorreto. Verifique o app e tente novamente.");
    }
    setLoading(false);
  }

  async function handleTotpVerify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId, code: totpCode });
      if (verifyError) throw verifyError;
      await completeMfa();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código incorreto ou expirado.");
    }
    setLoading(false);
  }

  return (
    <div className="login-screen" style={{ backgroundImage: `url(${loginHero})` }}>
      <div className="login-glow" />

      {step === "password" && (
        <form onSubmit={handlePasswordSubmit} className="login-card">
          <div className="login-lock">
            <LockKeyhole size={22} strokeWidth={1.7} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-strong)" }}>Bem-vindo de volta</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 0" }}>Acesse sua conta para continuar</p>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>Usuário ou e-mail</span>
            <div className="login-field">
              <User size={16} />
              <input type="text" required autoComplete="username" placeholder="usuario ou seu@empresa.com" value={identifier} onChange={e => setIdentifier(e.target.value)} />
            </div>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>Senha</span>
            <div className="login-field">
              <KeyRound size={16} />
              <input type="password" required placeholder="Digite sua senha" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </label>

          <button type="button" onClick={abrirEsqueciSenha} style={{ alignSelf: "flex-end", fontSize: 12.5, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: -6 }}>
            Esqueci minha senha
          </button>

          {error && (
            <div style={{ fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "9px 12px", textAlign: "center" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || Boolean(lockedUntil && Date.now() < lockedUntil)} className="btn-login">
            {loading ? "Entrando..." : "Entrar no sistema"} <ArrowRight size={16} />
          </button>
        </form>
      )}

      {step === "totp-setup" && (
        <form onSubmit={handleTotpSetup} className="login-card">
          <div className="login-lock">
            <Smartphone size={22} strokeWidth={1.7} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-strong)" }}>Configurar autenticação 2FA</div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0 0" }}>
              Escaneie com Google Authenticator ou similar. Esse passo é obrigatório no primeiro acesso.
            </p>
          </div>

          {qrCode && (
            <img src={qrCode} alt="QR Code 2FA" style={{ width: 176, height: 176, margin: "0 auto", borderRadius: 12, background: "#fff", padding: 8 }} />
          )}

          {secret && (
            <div style={{ background: "var(--surface-input)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "var(--text-muted)", textAlign: "center", wordBreak: "break-all" }}>
              Código manual: <code style={{ color: "var(--accent)", letterSpacing: 1 }}>{secret}</code>
            </div>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>Código de 6 dígitos</span>
            <div className="login-field">
              <input
                autoFocus value={totpCode} maxLength={6} inputMode="numeric" placeholder="000000"
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{ textAlign: "center", fontSize: 20, letterSpacing: 6, fontFamily: "monospace" }}
              />
            </div>
          </label>

          {error && (
            <div style={{ fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "9px 12px", textAlign: "center" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || totpCode.length !== 6} className="btn-login">
            {loading ? "Verificando..." : "Ativar 2FA e entrar"} <ArrowRight size={16} />
          </button>
        </form>
      )}

      {step === "totp-verify" && (
        <form onSubmit={handleTotpVerify} className="login-card">
          <div className="login-lock">
            <Smartphone size={22} strokeWidth={1.7} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-strong)" }}>Verificação em duas etapas</div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0 0" }}>Digite o código do seu app autenticador</p>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>Código de 6 dígitos</span>
            <div className="login-field">
              <input
                autoFocus value={totpCode} maxLength={6} inputMode="numeric" placeholder="000000"
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{ textAlign: "center", fontSize: 20, letterSpacing: 6, fontFamily: "monospace" }}
              />
            </div>
          </label>

          {error && (
            <div style={{ fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "9px 12px", textAlign: "center" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || totpCode.length !== 6} className="btn-login">
            {loading ? "Verificando..." : "Confirmar e entrar"} <ArrowRight size={16} />
          </button>
        </form>
      )}

      {step === "esqueci-senha" && (
        <form onSubmit={handleResetSubmit} className="login-card">
          <div className="login-lock">
            <Mail size={22} strokeWidth={1.7} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-strong)" }}>Redefinir senha</div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0 0" }}>
              {resetEnviado
                ? "Se esse e-mail estiver cadastrado, você vai receber um link de redefinição em instantes."
                : "Informe o e-mail cadastrado na sua conta pra receber um link de redefinição."}
            </p>
          </div>

          {!resetEnviado && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>E-mail cadastrado</span>
              <div className="login-field">
                <Mail size={16} />
                <input type="email" required autoFocus placeholder="seu@empresa.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
              </div>
            </label>
          )}

          {resetError && (
            <div style={{ fontSize: 13, color: "#fca5a5", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "9px 12px", textAlign: "center" }}>
              {resetError}
            </div>
          )}

          {!resetEnviado && (
            <button type="submit" disabled={resetLoading} className="btn-login">
              {resetLoading ? "Enviando..." : "Enviar link de redefinição"} <ArrowRight size={16} />
            </button>
          )}

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0, textAlign: "center" }}>
              Faz login só com nome de usuário (sem e-mail)? Fale com o suporte pelo WhatsApp:
            </p>
            <a
              href={`https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent("Olá! Preciso redefinir minha senha do Axion Varejo.")}`}
              target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(74,222,128,0.35)", background: "rgba(74,222,128,0.08)", color: "#4ade80", fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}
            >
              <MessageCircle size={16} /> Suporte via WhatsApp
            </a>
          </div>

          <button type="button" onClick={() => setStep("password")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <ArrowLeft size={13} /> Voltar ao login
          </button>
        </form>
      )}

      <LoginFooter />
    </div>
  );
}
