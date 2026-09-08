import { useEffect, useState } from "react";
import { UserPlus, ShieldCheck, X, Pencil, Trash2 } from "lucide-react";
import MainLayout from "../../layouts/MainLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { moduleGroups, flatModules } from "../../data/modules";

type ProfileRow = { id: string; email: string | null; username: string | null; full_name: string | null; role: string; status: string; allowed_modules: string[] | null };

const SYNTHETIC_DOMAIN = "users.axionvarejo.internal";
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

  // ── Modal unificado: dados + permissões ─────────────────────────────────
  const [manageUser, setManageUser] = useState<ProfileRow | null>(null);
  const [manageTab, setManageTab] = useState<"dados" | "permissoes">("dados");
  const [mFullName, setMFullName] = useState("");
  const [mUsername, setMUsername] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [mPassword, setMPassword] = useState("");
  const [mRole, setMRole] = useState("operador");
  const [mStatus, setMStatus] = useState("Ativo");
  const [mPermTotal, setMPermTotal] = useState(true);
  const [mPermAllowed, setMPermAllowed] = useState<string[]>([]);
  const [mSaving, setMSaving] = useState(false);
  const [mError, setMError] = useState("");

  const isSelf = manageUser?.id === profile?.id;

  function abrirGerenciar(u: ProfileRow) {
    setManageUser(u);
    setManageTab("dados");
    setMFullName(u.full_name ?? "");
    setMUsername(u.username ?? "");
    setMEmail(isSyntheticEmail(u.email) ? "" : (u.email ?? ""));
    setMPassword("");
    setMRole(u.role);
    setMStatus(u.status);
    setMPermTotal(u.allowed_modules == null);
    setMPermAllowed(u.allowed_modules ?? []);
    setMError("");
  }

  function togglePermissao(path: string) {
    setMPermTotal(false);
    setMPermAllowed(cur => (cur.includes(path) ? cur.filter(p => p !== path) : [...cur, path]));
  }

  function aplicarPreset(paths: string[]) {
    setMPermTotal(false);
    setMPermAllowed(paths);
  }

  async function salvarGerenciar(e: React.FormEvent) {
    e.preventDefault();
    if (!manageUser) return;
    setMSaving(true);
    setMError("");

    const username = mUsername.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      setMError("Usuário inválido. Use de 3 a 32 letras minúsculas, números, ponto, hífen ou underscore.");
      setMSaving(false);
      return;
    }
    if (username !== (manageUser.username ?? "")) {
      const { data: existing } = await supabase.from("profiles").select("id").ilike("username", username).neq("id", manageUser.id).maybeSingle();
      if (existing) {
        setMError("Já existe um usuário com esse nome.");
        setMSaving(false);
        return;
      }
    }

    const patch: Record<string, unknown> = { full_name: mFullName.trim() || null, username };
    if (mEmail.trim()) patch.email = mEmail.trim().toLowerCase();
    if (!isSelf) {
      patch.role = mRole;
      patch.status = mStatus;
      patch.allowed_modules = mPermTotal ? null : mPermAllowed;
    }

    const { error: updateError } = await supabase.from("profiles").update(patch).eq("id", manageUser.id);
    if (updateError) {
      setMError(updateError.message);
      setMSaving(false);
      return;
    }

    if (mPassword) {
      if (mPassword.length < 8) {
        setMError("A nova senha precisa ter pelo menos 8 caracteres.");
        setMSaving(false);
        return;
      }
      const { data, error: pwError } = await supabase.functions.invoke("manage-user", {
        body: { action: "reset-password", userId: manageUser.id, newPassword: mPassword },
      });
      if (pwError || (data as { error?: string })?.error) {
        setMError((data as { error?: string })?.error ?? pwError?.message ?? "Erro ao redefinir senha.");
        setMSaving(false);
        return;
      }
    }

    setMSaving(false);
    setManageUser(null);
    await load();
  }

  async function excluirUsuario(u: ProfileRow) {
    if (!window.confirm(`Excluir "${u.full_name || u.username}"? Essa ação não pode ser desfeita.`)) return;
    setError("");
    const { data, error: delError } = await supabase.functions.invoke("manage-user", {
      body: { action: "delete", userId: u.id },
    });
    if (delError || (data as { error?: string })?.error) {
      setError((data as { error?: string })?.error ?? delError?.message ?? "Erro ao excluir usuário.");
    } else {
      setManageUser(null);
      await load();
    }
  }

  const inp: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface-input)", color: "var(--text-strong)", fontSize: 13.5, width: "100%" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };
  const telasSelecionadas = mPermTotal ? flatModules.length : mPermAllowed.length;

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
      {error && !showInvite && !manageUser && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div className="panel" style={{ padding: 0, overflow: "auto" }}>
        <table className="data-table">
          <thead>
            <tr><th>NOME</th><th>USUÁRIO</th><th>E-MAIL</th><th>PAPEL</th><th>STATUS</th><th>TELAS</th><th>AÇÕES</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
            {!loading && users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600, color: "var(--text-strong)" }}>{u.full_name || "—"}</td>
                <td>{u.username || "—"}</td>
                <td>{isSyntheticEmail(u.email) ? "—" : u.email}</td>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    {u.role === "admin" && <ShieldCheck size={13} color="var(--accent)" />} {u.role === "admin" ? "Admin" : "Operador"}
                  </span>
                </td>
                <td>
                  <span style={{ color: u.status === "Ativo" ? "#4ade80" : "var(--danger)" }}>{u.status}</span>
                </td>
                <td>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.allowed_modules == null ? "Total" : `${u.allowed_modules.length} tela(s)`}</span>
                </td>
                <td>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => abrirGerenciar(u)} className="icon-btn" title="Gerenciar usuário">
                        <Pencil size={14} />
                      </button>
                      {u.id !== profile?.id && (
                        <button type="button" onClick={() => excluirUsuario(u)} className="icon-btn" title="Excluir usuário" style={{ color: "var(--danger)" }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
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

      {manageUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <form onSubmit={salvarGerenciar} className="panel" style={{ width: 560, maxWidth: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", gap: 0, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px 0" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
                {manageUser.full_name || manageUser.username}
              </h2>
              <button type="button" onClick={() => setManageUser(null)} className="icon-btn"><X size={18} /></button>
            </div>

            <div style={{ display: "flex", gap: 4, padding: "14px 20px 0", borderBottom: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => setManageTab("dados")}
                style={{ background: "none", border: "none", borderBottom: manageTab === "dados" ? "2px solid var(--accent)" : "2px solid transparent", color: manageTab === "dados" ? "var(--text-strong)" : "var(--text-muted)", fontWeight: 700, fontSize: 13, padding: "0 4px 10px", cursor: "pointer" }}
              >
                Dados do usuário
              </button>
              {!isSelf && (
                <button
                  type="button"
                  onClick={() => setManageTab("permissoes")}
                  style={{ background: "none", border: "none", borderBottom: manageTab === "permissoes" ? "2px solid var(--accent)" : "2px solid transparent", color: manageTab === "permissoes" ? "var(--text-strong)" : "var(--text-muted)", fontWeight: 700, fontSize: 13, padding: "0 4px 10px", cursor: "pointer", marginLeft: 18 }}
                >
                  Permissões de acesso
                </button>
              )}
            </div>

            <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              {mError && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5", padding: "9px 12px", borderRadius: 8, fontSize: 13 }}>{mError}</div>}

              {manageTab === "dados" && (
                <>
                  <div>
                    <label style={lbl}>Nome</label>
                    <input style={inp} value={mFullName} onChange={e => setMFullName(e.target.value)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl}>Usuário / login</label>
                      <input required style={inp} value={mUsername} onChange={e => setMUsername(e.target.value.toLowerCase())} />
                    </div>
                    <div>
                      <label style={lbl}>Status</label>
                      {isSelf ? (
                        <div style={{ ...inp, display: "flex", alignItems: "center", color: "var(--text-muted)" }}>{mStatus}</div>
                      ) : (
                        <select style={inp} value={mStatus} onChange={e => setMStatus(e.target.value)}>
                          <option value="Ativo">Ativo</option>
                          <option value="Inativo">Inativo</option>
                          <option value="Bloqueado">Bloqueado</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>E-mail (opcional)</label>
                    <input type="email" style={inp} placeholder="deixe em branco se não tiver" value={mEmail} onChange={e => setMEmail(e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>Nova senha (opcional)</label>
                    <input type="text" style={inp} placeholder="deixe em branco pra manter a atual" value={mPassword} onChange={e => setMPassword(e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>Papel</label>
                    {isSelf ? (
                      <div style={{ ...inp, display: "flex", alignItems: "center", color: "var(--text-muted)" }}>{mRole === "admin" ? "Admin" : "Operador"}</div>
                    ) : (
                      <select style={inp} value={mRole} onChange={e => setMRole(e.target.value)}>
                        <option value="operador">Operador</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </div>
                </>
              )}

              {manageTab === "permissoes" && !isSelf && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                      <strong className="mono" style={{ color: "var(--text-strong)" }}>{telasSelecionadas}</strong> tela(s) selecionada(s)
                    </span>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button type="button" onClick={() => { setMPermTotal(true); setMPermAllowed([]); }} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", padding: 0 }}>Marcar tudo</button>
                      <button type="button" onClick={() => { setMPermTotal(false); setMPermAllowed([]); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", padding: 0 }}>Limpar tudo</button>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Perfil rápido (preenche permissões)</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => { setMPermTotal(true); setMPermAllowed([]); }} className="btn" style={{ padding: "5px 10px", fontSize: 12 }}>Administrador</button>
                      {moduleGroups.map(group => (
                        <button key={group.title} type="button" onClick={() => aplicarPreset(group.children.map(m => m.path))} className="btn" style={{ padding: "5px 10px", fontSize: 12 }}>
                          {group.title.charAt(0) + group.title.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {moduleGroups.map(group => (
                      <div key={group.title}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{group.title}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const paths = group.children.map(m => m.path);
                              const todosMarcados = paths.every(p => mPermTotal || mPermAllowed.includes(p));
                              const base = mPermTotal ? flatModules.map(m => m.path) : mPermAllowed;
                              setMPermTotal(false);
                              setMPermAllowed(todosMarcados ? base.filter(p => !paths.includes(p)) : [...new Set([...base, ...paths])]);
                            }}
                            style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer", padding: 0 }}
                          >
                            {group.children.every(m => mPermTotal || mPermAllowed.includes(m.path)) ? "Desmarcar todos" : "Marcar todos"}
                          </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {group.children.map(m => (
                            <label key={m.path} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-strong)", cursor: "pointer" }}>
                              <input type="checkbox" checked={mPermTotal || mPermAllowed.includes(m.path)} onChange={() => togglePermissao(m.path)} />
                              <span>
                                {m.title}
                                <span style={{ display: "block", fontSize: 11, color: "var(--text-faint, var(--text-muted))", opacity: 0.7 }}>{m.path}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, padding: 20, borderTop: "1px solid var(--border)" }}>
              {!isSelf && (
                <button type="button" onClick={() => excluirUsuario(manageUser)} className="btn" style={{ color: "var(--danger)", borderColor: "rgba(248,113,113,0.3)" }}>
                  <Trash2 size={14} /> Excluir
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button type="button" onClick={() => setManageUser(null)} className="btn">Cancelar</button>
              <button type="submit" disabled={mSaving} className="btn btn-save">
                {mSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </MainLayout>
  );
}
