import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Profile = { id: string; tenant_id: string; full_name: string | null; role: string; status: string; allowed_modules: string[] | null };

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  mfaPending: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  completeMfa: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    const p = data as Profile | null;
    if (p && p.status !== "Ativo") {
      // Usuário inativo ou bloqueado: encerra a sessão imediatamente.
      await supabase.auth.signOut();
      setProfile(null);
      return;
    }
    setProfile(p);
  }

  async function evaluateSession(newSession: Session | null) {
    setSession(newSession);
    if (!newSession) {
      setProfile(null);
      setMfaPending(false);
      return;
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      // Login por senha ok, mas o desafio de 2FA ainda não foi concluído nesta sessão.
      setMfaPending(true);
      setProfile(null);
      return;
    }
    setMfaPending(false);
    await loadProfile(newSession.user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      evaluateSession(data.session).finally(() => setLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      evaluateSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  /** Chamado pela tela de login depois que o desafio de TOTP é verificado com sucesso. */
  async function completeMfa() {
    const { data } = await supabase.auth.getSession();
    await evaluateSession(data.session);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, mfaPending, signIn, signOut, completeMfa }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
