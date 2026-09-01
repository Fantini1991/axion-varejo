import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import { moduleGroups, podeAcessarModulo } from "../data/modules";
import { useAuth } from "../contexts/AuthContext";

type DayForecast = { date: string; label: string; icon: string; max: number; min: number };
type WeatherData = { temp: number; desc: string; icon: string; city: string; humidity: number; wind: number; forecast: DayForecast[] };

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function wIcon(code: number) {
  return code === 0 ? "☀️" : code <= 3 ? "⛅" : code <= 48 ? "☁️" : code <= 67 ? "🌧️" : code <= 77 ? "❄️" : code <= 82 ? "🌦️" : "⛈️";
}
function wDesc(code: number) {
  return code === 0 ? "Céu limpo" : code <= 3 ? "Parcialmente nublado" : code <= 48 ? "Nublado" : code <= 67 ? "Chuva" : code <= 77 ? "Neve" : code <= 82 ? "Chuva forte" : "Tempestade";
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function Dashboard() {
  const { profile } = useAuth();
  const displayName = profile?.full_name || "por aqui";
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const [res, geo] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=6`),
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`),
          ]);
          const data = await res.json() as {
            current: { temperature_2m: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number };
            daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
          };
          const geoData = await geo.json() as { address: { city?: string; town?: string; village?: string; county?: string } };
          const city = geoData.address.city ?? geoData.address.town ?? geoData.address.village ?? geoData.address.county ?? "—";
          const code = data.current.weather_code;
          const forecast: DayForecast[] = data.daily.time.slice(1, 6).map((date, i) => {
            const d = new Date(date + "T12:00:00");
            return { date, label: DAY_LABELS[d.getDay()], icon: wIcon(data.daily.weather_code[i + 1]), max: Math.round(data.daily.temperature_2m_max[i + 1]), min: Math.round(data.daily.temperature_2m_min[i + 1]) };
          });
          setWeather({ temp: Math.round(data.current.temperature_2m), desc: wDesc(code), icon: wIcon(code), city, humidity: data.current.relative_humidity_2m, wind: Math.round(data.current.wind_speed_10m), forecast });
        } catch { /* silencia erro de rede */ }
      },
      () => { /* usuário negou geolocalização */ }
    );
  }, []);

  return (
    <MainLayout>
      <div className="module-hero" style={{ alignItems: "center" }}>
        <div>
          <span>Axion Varejo</span>
          <h1>{saudacao()}, {displayName}</h1>
          <p>Acesso rápido aos módulos do sistema.</p>
        </div>

        {weather && (
          <div style={{ borderRadius: 14, background: "var(--surface-input)", border: "1px solid var(--border-strong)", overflow: "hidden", minWidth: 300 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 36, lineHeight: 1 }}>{weather.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1 }}>{weather.temp}°C</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{weather.desc}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                  {weather.city} · {weather.humidity}% umid. · {weather.wind} km/h
                </div>
              </div>
            </div>
            {weather.forecast.length > 0 && (
              <div style={{ display: "flex", padding: "8px 10px", gap: 2 }}>
                {weather.forecast.map(day => (
                  <div key={day.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 4px", borderRadius: 8 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>{day.label}</span>
                    <span style={{ fontSize: 18 }}>{day.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-strong)" }}>{day.max}°</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{day.min}°</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card-grid">
        {moduleGroups.flatMap(g => g.children).filter(m => podeAcessarModulo(profile?.role, profile?.allowed_modules, m.path)).map(m => (
          <Link key={m.path} to={m.path} className="info-card">
            <strong>{m.title}</strong>
            <p>{m.description}</p>
          </Link>
        ))}
      </div>
    </MainLayout>
  );
}
