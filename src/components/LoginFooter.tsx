import { useEffect, useState } from "react";
import { Building2, CalendarDays, Clock3 } from "lucide-react";

/** Rodapé com relógio ao vivo, no mesmo padrão usado na tela de login do Axion One. */
export default function LoginFooter() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(now);
  const formattedTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now);

  return (
    <footer className="login-footer">
      <div className="login-footer-row">
        <span className="login-footer-item" style={{ color: "var(--text-strong)" }}>
          <Building2 size={14} color="var(--accent)" /> Axion Group
        </span>
        <span className="login-footer-sep" />
        <span className="login-footer-item">
          <CalendarDays size={14} color="var(--accent-strong)" /> {formattedDate}
        </span>
        <span className="login-footer-sep" />
        <span className="login-footer-item" style={{ color: "var(--accent)", fontWeight: 700 }}>
          <Clock3 size={14} /> {formattedTime}
        </span>
      </div>
      <p style={{ margin: 0 }}>© {now.getFullYear()} Axion Group. Todos os direitos reservados.</p>
    </footer>
  );
}
