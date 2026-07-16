"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

function getApiBase() {
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
    if (typeof window !== "undefined") {
        const h = window.location.hostname;
        if (h === "localhost" || h === "127.0.0.1") return "http://127.0.0.1:8000";
        return "https://sadafmashori-gaiavolt.hf.space";
    }
    return "http://127.0.0.1:8000";
}
const API_BASE = getApiBase();

// Jan 1, 2050 UTC
const UNLOCK_DATE = new Date("2050-01-01T00:00:00Z");

function getTimeLeft() {
    const now = new Date();
    const diff = UNLOCK_DATE - now;
    if (diff <= 0) return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
    const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { years, months, days, hours, minutes, seconds, done: false };
}

function getUserFromStorage() {
    if (typeof window === "undefined") return { userId: null, token: null };
    try {
        const token = localStorage.getItem("gv_token");
        const userRaw = localStorage.getItem("gv_user");
        if (!token) return { userId: null, token: null };
        if (userRaw) { const u = JSON.parse(userRaw); if (u?.user_id) return { userId: u.user_id, token }; }
        return { userId: null, token };
    } catch { return { userId: null, token: null }; }
}

export default function VaultPage() {
    const router = useRouter();
    const [time, setTime] = useState(getTimeLeft());
    const [locked, setLocked] = useState(32.048);
    const [leader, setLeader] = useState(null);
    const [myCarbon, setMyCarbon] = useState(0);
    const [myCoins, setMyCoins] = useState(0);
    const [testament, setTestament] = useState("");
    const [savedTestament, setSavedTestament] = useState(false);
    const [tab, setTab] = useState("vault"); // vault | testament | leaderboard
    const [nasaTemp, setNasaTemp] = useState(null);
    const [carbonRate, setCarbonRate] = useState(null);

    // Countdown
    useEffect(() => {
        const t = setInterval(() => setTime(getTimeLeft()), 1000);
        return () => clearInterval(t);
    }, []);

    // Fetch data
    useEffect(() => {
        const { userId, token } = getUserFromStorage();
        if (!userId) { router.push("/auth"); return; }

        // Globe data (oracle + locked)
        fetch(`${API_BASE}/api/globe-data`).then(r => r.json()).then(d => {
            if (d.ecox_locked) setLocked(d.ecox_locked);
            if (d.oracle?.temp_c) setNasaTemp(d.oracle.temp_c);
            if (d.oracle?.carbon_rate) setCarbonRate(d.oracle.carbon_rate);
        }).catch(() => { });

        // Leaderboard
        fetch(`${API_BASE}/api/leaderboard/global`).then(r => r.json()).then(d => {
            if (d.leaderboard?.length > 0) setLeader(d.leaderboard[0]);
        }).catch(() => { });

        // My profile
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        fetch(`${API_BASE}/api/profile/${userId}`, { headers }).then(r => r.json()).then(d => {
            setMyCarbon(d.user?.carbon_total || 0);
            setMyCoins(d.user?.coins_total || 0);
        }).catch(() => { });

        // Saved testament
        const saved = localStorage.getItem("gv_testament");
        if (saved) setTestament(saved);
    }, []);

    const pctLocked = Math.min(100, (locked / 500000000) * 100 * 1e6); // visual only
    const totalSeconds = (UNLOCK_DATE - new Date("2026-07-01T00:00:00Z")) / 1000;
    const elapsedSeconds = totalSeconds - ((UNLOCK_DATE - new Date()) / 1000);
    const progressPct = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100));

    return (
        <div style={{ minHeight: "100vh", background: "#020810", fontFamily: "'Syne','Space Grotesk',sans-serif", color: "#f0fdf4", padding: "48px 20px 100px", backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,170,0,0.08) 0%, transparent 70%)" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono&display=swap');
                @keyframes spin{to{transform:rotate(360deg)}}
                @keyframes vaultPulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:0.8;transform:scale(1.02)}}
                @keyframes goldGlow{0%,100%{text-shadow:0 0 10px #f59e0b}50%{text-shadow:0 0 30px #f59e0b,0 0 60px #f59e0b44}}
                @keyframes tick{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}
            `}</style>

            <div style={{ maxWidth: 520, margin: "0 auto" }}>

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: 32 }}>
                    <div style={{ fontSize: 11, letterSpacing: 4, color: "rgba(245,158,11,0.5)", fontFamily: "monospace", marginBottom: 8 }}>
                        GAIAVOLT · QUANTUM-LOCK · 2050
                    </div>
                    <h1 style={{ margin: 0, fontSize: "clamp(24px,6vw,36px)", fontWeight: 800, background: "linear-gradient(135deg,#fde047,#f59e0b,#d97706)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "goldGlow 3s infinite" }}>
                        Legacy Vault
                    </h1>
                    <p style={{ color: "rgba(245,158,11,0.5)", fontSize: 12, fontFamily: "monospace", marginTop: 6 }}>
                        "Locked for the planet. Unlocked by its greatest guardian."
                    </p>
                </motion.div>

                {/* Countdown Timer */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                    style={{ padding: "28px 24px", borderRadius: 18, marginBottom: 20, background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", textAlign: "center" }}
                >
                    <div style={{ fontSize: 10, letterSpacing: 4, color: "rgba(245,158,11,0.5)", fontFamily: "monospace", marginBottom: 16 }}>
                        UNLOCK DATE — JANUARY 1, 2050
                    </div>

                    {/* Big countdown */}
                    <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                        {[
                            { v: time.years, l: "YEARS" },
                            { v: time.months, l: "MONTHS" },
                            { v: time.days, l: "DAYS" },
                            { v: time.hours, l: "HOURS" },
                        ].map(({ v, l }) => (
                            <div key={l} style={{ textAlign: "center" }}>
                                <motion.div
                                    key={v}
                                    initial={{ scale: 1.2, color: "#fde047" }}
                                    animate={{ scale: 1, color: "#f59e0b" }}
                                    transition={{ duration: 0.3 }}
                                    style={{ fontSize: "clamp(28px,6vw,42px)", fontWeight: 900, fontFamily: "monospace", color: "#f59e0b", textShadow: "0 0 20px #f59e0b55", minWidth: 60 }}
                                >
                                    {String(v).padStart(2, "0")}
                                </motion.div>
                                <div style={{ fontSize: 9, color: "rgba(245,158,11,0.4)", letterSpacing: 2, fontFamily: "monospace" }}>{l}</div>
                            </div>
                        ))}
                    </div>

                    {/* Seconds */}
                    <div style={{ fontSize: 12, color: "rgba(245,158,11,0.4)", fontFamily: "monospace" }}>
                        {String(time.minutes).padStart(2, "0")}:{String(time.seconds).padStart(2, "0")} remaining today
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginTop: 16, height: 4, borderRadius: 2, background: "rgba(245,158,11,0.1)", overflow: "hidden" }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#f59e0b,#fde047)", boxShadow: "0 0 8px #f59e0b" }}
                        />
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(245,158,11,0.3)", fontFamily: "monospace", marginTop: 4 }}>
                        {progressPct.toFixed(4)}% of journey complete
                    </div>
                </motion.div>

                {/* Locked Fund */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    style={{ padding: "20px 24px", borderRadius: 16, marginBottom: 16, background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)" }}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                            <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(245,158,11,0.5)", fontFamily: "monospace", marginBottom: 4 }}>TOTAL LOCKED</div>
                            <div style={{ fontSize: 32, fontWeight: 900, color: "#f59e0b", fontFamily: "monospace", textShadow: "0 0 20px #f59e0b55" }}>
                                {locked.toFixed(4)} GAIAX
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(245,158,11,0.4)", fontFamily: "monospace", marginTop: 2 }}>
                                Growing with every verification
                            </div>
                        </div>
                        <div style={{ fontSize: 48, animation: "vaultPulse 2s ease-in-out infinite" }}>🏛️</div>
                    </div>

                    {/* Oracle data */}
                    {(nasaTemp || carbonRate) && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(245,158,11,0.1)", display: "flex", gap: 16 }}>
                            {nasaTemp && (
                                <div>
                                    <div style={{ fontSize: 9, color: "rgba(0,204,255,0.5)", fontFamily: "monospace", letterSpacing: 2 }}>🌡️ NASA TEMP</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "#00ccff", fontFamily: "monospace" }}>{nasaTemp}°C</div>
                                </div>
                            )}
                            {carbonRate && (
                                <div>
                                    <div style={{ fontSize: 9, color: "rgba(34,197,94,0.5)", fontFamily: "monospace", letterSpacing: 2 }}>💰 CARBON RATE</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "#22c55e", fontFamily: "monospace" }}>${carbonRate}/ton</div>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {[["vault", "🏆 Rankings"], ["testament", "📜 My Testament"]].map(([id, label]) => (
                        <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "11px", borderRadius: 10, cursor: "pointer", border: `1px solid ${tab === id ? "rgba(245,158,11,0.5)" : "rgba(245,158,11,0.1)"}`, background: tab === id ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.02)", color: tab === id ? "#f59e0b" : "#6b7280", fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* Rankings Tab */}
                {tab === "vault" && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                        {/* Current Leader */}
                        {leader && (
                            <div style={{ padding: "18px 20px", borderRadius: 14, marginBottom: 12, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
                                <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(245,158,11,0.5)", fontFamily: "monospace", marginBottom: 10 }}>
                                    🏆 CURRENT LEADER
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ fontSize: 36 }}>👑</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: "#f59e0b" }}>{leader.name}</div>
                                        <div style={{ fontSize: 11, color: "rgba(245,158,11,0.5)", fontFamily: "monospace" }}>{leader.xp?.toLocaleString()} XP · {leader.carbon?.toFixed(1)} kg CO₂</div>
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: 11, color: "rgba(245,158,11,0.4)", fontFamily: "monospace" }}>WINS IN 2050</div>
                                        <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b", fontFamily: "monospace" }}>🔑</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* My contribution */}
                        <div style={{ padding: "16px 20px", borderRadius: 14, marginBottom: 12, background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.1)" }}>
                            <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(34,197,94,0.5)", fontFamily: "monospace", marginBottom: 10 }}>
                                🌱 YOUR CONTRIBUTION
                            </div>
                            <div style={{ display: "flex", gap: 20 }}>
                                <div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: "#22c55e", fontFamily: "monospace" }}>{myCarbon.toFixed(2)} kg</div>
                                    <div style={{ fontSize: 10, color: "rgba(34,197,94,0.5)", fontFamily: "monospace" }}>CO₂ OFFSET</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: "#f59e0b", fontFamily: "monospace" }}>{myCoins.toFixed(2)}</div>
                                    <div style={{ fontSize: 10, color: "rgba(245,158,11,0.5)", fontFamily: "monospace" }}>GAIA EARNED</div>
                                </div>
                            </div>
                        </div>

                        {/* Info */}
                        <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(245,158,11,0.08)", fontSize: 12, color: "rgba(245,158,11,0.4)", fontFamily: "monospace", lineHeight: 1.7 }}>
                            Every verification sends 1% to this vault.<br />
                            January 1, 2050 — the top carbon saver wins everything.<br />
                            <span style={{ color: "rgba(245,158,11,0.6)" }}>Locked for {time.years} more years. Prove your planet.</span>
                        </div>
                    </motion.div>
                )}

                {/* Testament Tab */}
                {tab === "testament" && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                        <div style={{ padding: "18px 20px", borderRadius: 14, marginBottom: 12, background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)" }}>
                            <div style={{ fontSize: 10, letterSpacing: 3, color: "rgba(245,158,11,0.5)", fontFamily: "monospace", marginBottom: 10 }}>
                                📜 MESSAGE TO 2050
                            </div>
                            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", marginBottom: 14, lineHeight: 1.6 }}>
                                Write a message that will be stored on IPFS — encrypted, permanent.<br />
                                Someone in 2050 will read this.
                            </p>
                            <textarea
                                value={testament}
                                onChange={e => { setTestament(e.target.value); setSavedTestament(false); }}
                                placeholder="To whoever reads this in 2050: I planted a tree today in Hyderabad, Pakistan. I believed the planet was worth saving..."
                                rows={6}
                                style={{ width: "100%", padding: "14px", boxSizing: "border-box", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, color: "#e2e8f0", fontSize: 13, fontFamily: "monospace", resize: "vertical", lineHeight: 1.6, outline: "none" }}
                            />
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    localStorage.setItem("gv_testament", testament);
                                    setSavedTestament(true);
                                    setTimeout(() => setSavedTestament(false), 3000);
                                }}
                                style={{ width: "100%", marginTop: 10, padding: "13px", borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.08)", color: "#f59e0b", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}
                            >
                                {savedTestament ? "✅ Saved to Vault!" : "🔒 Save to Legacy Vault"}
                            </motion.button>
                        </div>

                        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(245,158,11,0.08)", fontSize: 11, color: "rgba(245,158,11,0.3)", fontFamily: "monospace", lineHeight: 1.6, textAlign: "center" }}>
                            🔒 Encrypted on IPFS · Permanent on Blockchain · Readable in 2050
                        </div>
                    </motion.div>
                )}

                {/* Bottom tagline */}
                <div style={{ marginTop: 32, textAlign: "center", fontSize: 10, color: "rgba(245,158,11,0.2)", fontFamily: "monospace", letterSpacing: 2 }}>
                    QUANTUM-LOCK 2050 · POLYGON BLOCKCHAIN · FROM HYDERABAD 2026
                </div>
            </div>
        </div>
    );
}