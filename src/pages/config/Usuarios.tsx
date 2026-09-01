import { useEffect, useState } from "react";
import { UserPlus, ShieldCheck, KeyRound, X } from "lucide-react";
import MainLayout from "../../layouts/MainLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { moduleGroups } from "../../data/modules";

type ProfileRow = { id: string; email: string | null; username: string | null; full_name: string | null; role: string; status: string; allowed_modules: string[] | null };

const SYNTHETIC_DOMAIN = "users.axionpaint.internal";
const isSyntheticEmail = (email: string | null) => Boolean(email?.endsWith(`@${SYNTHETIC_DOMAIN}`));

export default function Usuarios() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [modo, setModo] = useState<"convite" | "usuario">("convite");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("operador");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("id, email, username, full_name, role, status, allowed_modules").order("full_name");
    setUsers((data as ProfileRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError("");
    setSuccess("");
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { email: inviteEmail, fullName: inviteName, role: inviteRole },
    });
    if (error || (data as { error?: string })?.error) {
      setError((data as { error?: string })?.error ?? error?.message ?? "Erro ao convidar usuário.");
    } else {
      setSuccess(`Convite enviado para ${inviteEmail}.`);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("operador");
      setShowInvite(false);
      await load();
    }
    setInviting(false);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError("");
    setSuccess("");
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { username: newUsername, fullName: inviteName, password: newPassword, role: inviteRole, email: newEmail || undefined },
    });
    if (error || (data as { error?: string })?.error) {
      setError((data as { error?: string })?.error ?? error?.message ?? "Erro ao criar usuário.");
    } else {
      setSuccess(`Usuário "${newUsername}" criado. Repasse o usuário e a senha pra pessoa — ela pode trocar a senha depois.`);
      setNewUsername("");
      setNewPassword("");
      setNewEmail("");
      setInviteName("");
      setInviteRole("operador");
      setShowInvite(false);
      await load();
    }
    setInviting(false);
  }

  const [permUser, setPermUser] = useState<ProfileRow | null>(null);
  const [permTotal, setPermTotal] = useState(true);
  const [permAllowed, setPermAllowed] = useState<string[]>([]);
  const [permSaving, setPermSaving] = useState(false);

  function abrirPermissoes(u: ProfileRow) {
    setPermUser(u);
    setPermTotal(u.allowed_modules == null);
    setPermAllowed(u.allowed_modules ?? []);
  }

  function togglePermissao(path: string) {
    setPermAllowed(cur => (cur.includes(path) ? cur.filter(p => p !== path) : [...cur, path]));
  }

  async function salvarPermissoes() {
    if (!permUser) return;
    setPermSaving(true);
    await supabase.from("profiles").update({ allowed_modules: permTotal ? null : permAllowed }).eq("id", permUser.id);
    setPermSaving(false);
    setPermUser(null);
    await load();
  }

  async function updateRole(userId: string, role: string) {
    await supabase.from("profiles").update({ role }).eq("id", userId);
    await load();
  }

  async function updateStatus(userId: string, status: string) {
    await supabase.from("profiles").update({ status }).eq("id", userId);
    await load();
  }

  const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-input)", color: "var(--text-strong)", fontSize: 13.5, width: "100%" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };

  return (
    <MainLayout>
      <div className="module-hero">
        <div>
          <span>Configurações</span>
          <h1>Usuários</h1>
          <p>Usuários com acesso ao sistema.</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setModo("convite"); setError(""); setShowInvite(true); }} className="btn btn-save">
            <UserPlus size={15} /> Novo usuário
          </button>
        )}
      </div>

      {!isAdmin && (
        <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          Somente administradores podem convidar usuários ou alterar papéis e status.
        </div>
      )}
      {success && <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{success}</div>}

      <div className="panel" style={{ padding: 0, overflow: "auto" }}>
        <table className="data-table">
          <thead>
            <tr><th>NOME</th><th>USUÁRIO</th><th>E-MAIL</th><th>PAPEL</th><th>STATUS</th><th>TELAS</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
            {!loading && users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600, color: "var(--text-strong)" }}>{u.full_name || "—"}</td>
                <td>{u.username || "—"}</td>
                <td>{isSyntheticEmail(u.email) ? "—" : u.email}</td>
                <td>
                  {isAdmin && u.id !== profile?.id ? (
                    <select value={u.role} onChange={e => updateRole(u.id, e.target.value)} style={{ ...inp, padding: "5px 8px", width: "auto" }}>
                      <option value="operador">Operador</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      {u.role === "admin" && <ShieldCheck size={13} color="var(--accent)" />} {u.role === "admin" ? "Admin" : "Operador"}
                    </span>
                  )}
                </td>
                <td>
                  {isAdmin && u.id !== profile?.id ? (
                    <select value={u.status} onChange={e => updateStatus(u.id, e.target.value)} style={{ ...inp, padding: "5px 8px", width: "auto" }}>
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Bloqueado">Bloqueado</option>
                    </select>
                  ) : (
                    <span style={{ color: u.status === "Ativo" ? "#4ade80" : "var(--danger)" }}>{u.status}</span>
                  )}
                </td>
                <td>
                  {u.role === "admin" ? (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Total (admin)</span>
                  ) : isAdmin ? (
                    <button type="button" onClick={() => abrirPermissoes(u)} className="btn" style={{ padding: "5px 10px", fontSize: 12 }}>
                      <KeyRound size={13} /> {u.allowed_modules == null ? "Total" : `${u.allowed_modules.length} tela(s)`}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.allowed_modules == null ? "Total" : `${u.allowed_modules.length} tela(s)`}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <form onSubmit={modo === "convite" ? handleInvite : handleCreateUser} className="panel" style={{ width: 420, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>Novo usuário</h2>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => { setModo("convite"); setError(""); }} className="btn" style={{ flex: 1, justifyContent: "center", ...(modo === "convite" ? { borderColor: "var(--accent)", color: "var(--text-strong)" } : {}) }}>Convite por e-mail</button>
              <button type="button" onClick={() => { setModo("usuario"); setError(""); }} className="btn" style={{ flex: 1, justifyContent: "center", ...(modo === "usuario" ? { borderColor: "var(--accent)", color: "var(--text-strong)" } : {}) }}>Usuário sem e-mail</button>
            </div>

            <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
              {modo === "convite"
                ? "Um e-mail de convite será enviado. O novo usuário define a própria senha ao aceitar."
                : "Pra quem não tem e-mail corporativo (ex: equipe de balcão). Você define usuário e senha agora e repassa direto pra pessoa."}
            </p>

            {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}>{error}</div>}

            <div>
              <label style={lbl}>Nome</label>
              <input style={inp} value={inviteName} onChange={e => setInviteName(e.target.value)} />
            </div>

            {modo === "convite" ? (
              <div>
                <label style={lbl}>E-mail</label>
                <input type="email" required style={inp} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
              </div>
            ) : (
              <>
                <div>
                  <label style={lbl}>Nome de usuário</label>
                  <input required style={inp} placeholder="ex: joao.caixa" value={newUsername} onChange={e => setNewUsername(e.target.value.toLowerCase())} />
                </div>
                <div>
                  <label style={lbl}>Senha inicial</label>
                  <input type="text" required minLength={8} style={inp} placeholder="mínimo 8 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>E-mail (opcional)</label>
                  <input type="email" style={inp} placeholder="deixe em branco se não tiver" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                </div>
              </>
            )}

            <div>
              <label style={lbl}>Papel</label>
              <select style={inp} value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                <option value="operador">Operador</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setShowInvite(false)} className="btn" style={{ flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button type="submit" disabled={inviting} className="btn btn-save" style={{ flex: 1, justifyContent: "center" }}>
                {inviting ? "Salvando..." : modo === "convite" ? "Enviar convite" : "Criar usuário"}
              </button>
            </div>
          </form>
        </div>
      )}

      {permUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div className="panel" style={{ width: 480, maxWidth: "100%", maxHeight: "86vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>Telas de {permUser.full_name || permUser.username}</h2>
              <button type="button" onClick={() => setPermUser(null)} className="icon-btn"><X size={18} /></button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setPermTotal(true)} className="btn" style={{ flex: 1, justifyContent: "center", ...(permTotal ? { borderColor: "var(--accent)", color: "var(--text-strong)" } : {}) }}>Acesso total</button>
              <button type="button" onClick={() => setPermTotal(false)} className="btn" style={{ flex: 1, justifyContent: "center", ...(!permTotal ? { borderColor: "var(--accent)", color: "var(--text-strong)" } : {}) }}>Telas selecionadas</button>
            </div>

            {permTotal ? (
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Esse usuário vê e acessa todas as telas do sistema.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {moduleGroups.map(group => (
                  <div key={group.title}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{group.title}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const paths = group.children.map(m => m.path);
                          const todosMarcados = paths.every(p => permAllowed.includes(p));
                          setPermAllowed(cur => todosMarcados ? cur.filter(p => !paths.includes(p)) : [...new Set([...cur, ...paths])]);
                        }}
                        style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer", padding: 0 }}
                      >
                        {group.children.every(m => permAllowed.includes(m.path)) ? "Desmarcar todos" : "Marcar todos"}
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {group.children.map(m => (
                        <label key={m.path} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-strong)", cursor: "pointer" }}>
                          <input type="checkbox" checked={permAllowed.includes(m.path)} onChange={() => togglePermissao(m.path)} />
                          {m.title}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setPermUser(null)} className="btn" style={{ flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button type="button" onClick={salvarPermissoes} disabled={permSaving} className="btn btn-save" style={{ flex: 1, justifyContent: "center" }}>
                {permSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
