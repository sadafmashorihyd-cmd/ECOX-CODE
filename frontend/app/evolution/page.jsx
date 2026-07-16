"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

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

function getUserFromStorage() {
    if (typeof window === "undefined") return { userId: null, name: null, token: null };
    try {
        const token = localStorage.getItem("gv_token");
        const userRaw = localStorage.getItem("gv_user");
        if (!token) return { userId: null, name: null, token: null };
        if (userRaw) {
            const u = JSON.parse(userRaw);
            if (u?.user_id) return { userId: u.user_id, name: u.name, token };
        }
        const payloadB64 = token.split(".")[0];
        const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
        return { userId: payload.user_id || null, name: payload.name || "Eco Hero", token };
    } catch { return { userId: null, name: null, token: null }; }
}

const LEVELS = [
    { level: 1, name: "Seedling", icon: "🌱", xp_required: 0, color: "#86efac" },
    { level: 2, name: "Sapling", icon: "🌿", xp_required: 100, color: "#4ade80" },
    { level: 3, name: "Young Tree", icon: "🌳", xp_required: 300, color: "#22c55e" },
    { level: 4, name: "Forest Guardian", icon: "🌲", xp_required: 700, color: "#16a34a" },
    { level: 5, name: "Eco Warrior", icon: "🦅", xp_required: 1500, color: "#15803d" },
    { level: 6, name: "Planet Protector", icon: "🌍", xp_required: 3000, color: "#166534" },
    { level: 7, name: "Carbon Zero Hero", icon: "⚡", xp_required: 6000, color: "#f59e0b" },
];
function getLevelForXP(xp) {
    let cur = LEVELS[0];
    for (const l of LEVELS) { if (xp >= l.xp_required) cur = l; }
    return cur;
}
function getNextLevel(lvl) { return LEVELS.find(l => l.level === lvl + 1) || null; }

// ── LEVEL CONFIGS for 3D Avatar ───────────────────────────────────────────────
const LEVEL_3D = {
    1: { color: 0x86efac, glowColor: "#86efac", speed: 0.005, shape: "sprout" },
    2: { color: 0x4ade80, glowColor: "#4ade80", speed: 0.007, shape: "sapling" },
    3: { color: 0x22c55e, glowColor: "#22c55e", speed: 0.008, shape: "tree" },
    4: { color: 0x16a34a, glowColor: "#16a34a", speed: 0.009, shape: "bigtree" },
    5: { color: 0x15803d, glowColor: "#15803d", speed: 0.010, shape: "warrior" },
    6: { color: 0x166534, glowColor: "#4ade80", speed: 0.012, shape: "planet" },
    7: { color: 0xf59e0b, glowColor: "#f59e0b", speed: 0.015, shape: "hero" },
};

// Avatar3D component below handles THREE dynamically

function Avatar3D({ level = 1, size = 140 }) {
    const mountRef = useRef(null);
    const frameRef = useRef(null);
    const cfg = LEVEL_3D[level] || LEVEL_3D[1];

    useEffect(() => {
        if (!mountRef.current || typeof window === "undefined") return;

        // Dynamic import — only client side
        import("three").then((THREE) => {
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
            camera.position.set(0, 0.8, 3.5); camera.lookAt(0, 0.6, 0);
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(size, size); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setClearColor(0x000000, 0);
            if (!mountRef.current) return;
            mountRef.current.appendChild(renderer.domElement);

            // Build scene inline
            while (scene.children.length > 0) scene.remove(scene.children[0]);
            scene.add(new THREE.AmbientLight(0x223344, 2));
            const sun = new THREE.DirectionalLight(0xffffff, 3);
            sun.position.set(3, 5, 3); scene.add(sun);
            const glowLight = new THREE.PointLight(cfg.color, 2, 4);
            glowLight.position.set(0, 0.5, 1); scene.add(glowLight);
            const group = new THREE.Group();
            const s = 0.3 + level * 0.12;

            if (cfg.shape === "sprout" || cfg.shape === "sapling") {
                const stemH = s * 1.5;
                const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, stemH, 8), new THREE.MeshPhongMaterial({ color: 0x4ade80 }));
                stem.position.y = stemH / 2; group.add(stem);
                const n = cfg.shape === "sprout" ? 2 : 4;
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * Math.PI * 2;
                    const leaf = new THREE.Mesh(new THREE.SphereGeometry(s * 0.3, 8, 8), new THREE.MeshPhongMaterial({ color: cfg.color, side: THREE.DoubleSide }));
                    leaf.position.set(Math.cos(a) * s * 0.25, stemH * 0.7, Math.sin(a) * s * 0.25); leaf.scale.y = 1.3; group.add(leaf);
                }
            } else if (cfg.shape === "tree" || cfg.shape === "bigtree") {
                const trunkH = s * 1.2;
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, trunkH, 8), new THREE.MeshPhongMaterial({ color: 0x7c3f00 }));
                trunk.position.y = trunkH / 2; group.add(trunk);
                const layers = cfg.shape === "tree" ? 2 : 3;
                for (let i = 0; i < layers; i++) {
                    const cone = new THREE.Mesh(new THREE.ConeGeometry(s * (0.5 - i * 0.08), s * 0.5, 8), new THREE.MeshPhongMaterial({ color: cfg.color }));
                    cone.position.y = trunkH + i * s * 0.35; group.add(cone);
                }
            } else if (cfg.shape === "warrior") {
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1, 8), new THREE.MeshPhongMaterial({ color: 0x7c3f00 }));
                trunk.position.y = 0.5; group.add(trunk);
                const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), new THREE.MeshPhongMaterial({ color: cfg.color, shininess: 50 }));
                canopy.position.y = 1.3; group.add(canopy);
                for (let i = 0; i < 3; i++) {
                    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4 + i * 0.15, 0.02, 8, 32), new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6 - i * 0.15 }));
                    ring.position.y = 1.3; ring.rotation.x = Math.PI / 2 + i * 0.3; group.add(ring);
                }
            } else if (cfg.shape === "planet") {
                group.add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 32), new THREE.MeshPhongMaterial({ color: 0x1a6b3c, shininess: 60 })));
                group.add(new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 32), new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.15, side: THREE.BackSide })));
                const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.02, 8, 64), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.5 }));
                orbit.rotation.x = Math.PI / 4; group.add(orbit);
                const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfde047 }));
                dot.position.set(0.9, 0, 0); orbit.add(dot);
            } else if (cfg.shape === "hero") {
                group.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), new THREE.MeshPhongMaterial({ color: 0x1a6b3c, shininess: 80 })));
                const halo = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.04, 8, 64), new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.9 }));
                halo.rotation.x = Math.PI / 2; group.add(halo);
                for (let i = 0; i < 6; i++) {
                    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 6), new THREE.MeshBasicMaterial({ color: 0xfde047 }));
                    const a = (i / 6) * Math.PI * 2; spike.position.set(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0); spike.rotation.z = a + Math.PI / 2; group.add(spike);
                }
            }

            // Particles
            const pGeo = new THREE.BufferGeometry();
            const pCnt = 5 + level * 5;
            const pPos = new Float32Array(pCnt * 3);
            for (let i = 0; i < pCnt; i++) { pPos[i * 3] = (Math.random() - 0.5) * 2; pPos[i * 3 + 1] = Math.random() * 2.5; pPos[i * 3 + 2] = (Math.random() - 0.5) * 2; }
            pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
            const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: cfg.color, size: 0.05, transparent: true, opacity: 0.8 }));
            group.add(particles);
            scene.add(group);

            let t = 0;
            const animate = () => {
                frameRef.current = requestAnimationFrame(animate);
                t += cfg.speed;
                group.rotation.y = t;
                group.position.y = Math.sin(t * 0.7) * 0.05;
                const pos = particles.geometry.attributes.position;
                for (let i = 0; i < pos.count; i++) { pos.setY(i, (pos.getY(i) + 0.008) % 2.5); pos.setX(i, pos.getX(i) + Math.sin(t + i) * 0.002); }
                pos.needsUpdate = true;
                renderer.render(scene, camera);
            };
            animate();
        });

        return () => {
            cancelAnimationFrame(frameRef.current);
        };
    }, [level, size]);

    return (
        <div style={{ position: "relative", width: size, height: size }}>
            <div style={{ position: "absolute", inset: "10%", borderRadius: "50%", background: `radial-gradient(circle,${cfg.glowColor}33,transparent 70%)`, animation: "avatarPulse 2s ease-in-out infinite" }} />
            <div ref={mountRef} style={{ width: size, height: size, position: "relative" }} />
        </div>
    );
}


// ── STREAK FIRE COMPONENT ─────────────────────────────────────────────────────
function StreakFire({ days }) {
    const isWarning = days > 0 && days < 3; // streak tootne wali hai
    const fireSize = Math.min(days, 30);    // max size 30 days par
    const flames = Math.max(1, Math.min(5, Math.floor(days / 5) + 1));

    const fireColor = isWarning
        ? "#ef4444"   // red — danger
        : days >= 14
            ? "#f97316"   // orange — hot streak
            : days >= 7
                ? "#f59e0b"   // amber — warming up
                : "#fde047";  // yellow — just started

    return (
        <div style={{ textAlign: "center" }}>
            {/* Warning banner */}
            <AnimatePresence>
                {isWarning && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{
                            padding: "8px 14px", borderRadius: 8, marginBottom: 10,
                            background: "rgba(239,68,68,0.12)",
                            border: "1px solid rgba(239,68,68,0.4)",
                            fontSize: 12, color: "#fca5a5", fontFamily: "monospace"
                        }}
                    >
                        ⚠️ Streak tootne wali hai! Aaj verify karo.
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Fire animation */}
            <div style={{ position: "relative", display: "inline-block" }}>
                {/* Glow behind */}
                <div style={{
                    position: "absolute", inset: -10,
                    background: `radial-gradient(circle, ${fireColor}33, transparent 70%)`,
                    borderRadius: "50%",
                    animation: days > 0 ? "pulseGlow 1.5s ease-in-out infinite" : "none"
                }} />

                {/* Main flame */}
                <motion.div
                    animate={days > 0 ? {
                        scale: [1, 1.05, 0.98, 1.03, 1],
                        rotate: [-1, 1, -0.5, 0.5, -1]
                    } : {}}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ fontSize: 40 + fireSize, lineHeight: 1, position: "relative" }}
                >
                    {days === 0 ? "💤" : "🔥"}
                </motion.div>

                {/* Extra flames for big streaks */}
                {days >= 7 && (
                    <motion.div
                        animate={{ scale: [0.8, 1, 0.8], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
                        style={{ position: "absolute", top: -8, right: -12, fontSize: 20 }}
                    >🔥</motion.div>
                )}
                {days >= 14 && (
                    <motion.div
                        animate={{ scale: [0.8, 1, 0.8], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.6 }}
                        style={{ position: "absolute", top: -8, left: -12, fontSize: 20 }}
                    >🔥</motion.div>
                )}
            </div>

            {/* Days count */}
            <div style={{
                fontSize: 28, fontWeight: 900, color: fireColor,
                fontFamily: "monospace", marginTop: 6,
                textShadow: days > 0 ? `0 0 20px ${fireColor}88` : "none",
                transition: "all 0.5s"
            }}>
                {days}d
            </div>
            <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 2, fontFamily: "monospace" }}>
                {days === 0 ? "START YOUR STREAK" :
                    days >= 30 ? "🏆 LEGENDARY STREAK" :
                        days >= 14 ? "🔥 ON FIRE!" :
                            days >= 7 ? "⚡ HEATING UP" :
                                "STREAK"}
            </div>

            {/* Streak meter bar */}
            {days > 0 && (
                <div style={{ marginTop: 8, width: 80, margin: "8px auto 0" }}>
                    <div style={{ height: 4, borderRadius: 2, background: "#1a2a1a", overflow: "hidden" }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (days / 30) * 100)}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            style={{
                                height: "100%", borderRadius: 2,
                                background: `linear-gradient(90deg, #fde047, ${fireColor})`,
                                boxShadow: `0 0 6px ${fireColor}`
                            }}
                        />
                    </div>
                    <div style={{ fontSize: 9, color: "#374151", marginTop: 3, fontFamily: "monospace", textAlign: "center" }}>
                        {days}/30 days
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value, color, isStreak, streakDays }) {
    if (isStreak) {
        return (
            <div style={{ flex: 1, padding: "14px 10px", borderRadius: 12, textAlign: "center", background: "rgba(0,255,100,0.03)", border: `1px solid ${streakDays > 0 ? "rgba(249,115,22,0.2)" : "rgba(0,255,100,0.08)"}` }}>
                <StreakFire days={streakDays || 0} />
            </div>
        );
    }
    return (
        <div style={{ flex: 1, padding: "14px 10px", borderRadius: 12, textAlign: "center", background: "rgba(0,255,100,0.03)", border: "1px solid rgba(0,255,100,0.08)" }}>
            <div style={{ fontSize: 22 }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "monospace", marginTop: 4 }}>{value}</div>
            <div style={{ fontSize: 10, color: "#4b5563", letterSpacing: 1, marginTop: 2 }}>{label}</div>
        </div>
    );
}

function ActivityRow({ act }) {
    const icons = { plantation: "🌱", recycling: "♻️", cycling: "🚲", solar_panels: "☀️", led_lighting: "💡", electric_cars: "⚡", ocean_cleanup: "🌊" };
    const t = new Date(act.time);
    const timeStr = isNaN(t) ? act.time : t.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, marginBottom: 6, background: "rgba(0,255,100,0.02)", border: "1px solid rgba(0,255,100,0.06)" }}>
            <span style={{ fontSize: 20 }}>{icons[act.activity] || "🌿"}</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, textTransform: "capitalize" }}>{act.activity.replace(/_/g, " ")}</div>
                <div style={{ fontSize: 11, color: "#4b5563" }}>{timeStr}</div>
            </div>
            <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#22c55e", fontFamily: "monospace" }}>+{act.xp} XP</div>
                <div style={{ fontSize: 11, color: "#6ee7b7" }}>+{act.coins?.toFixed(1)} GAIA</div>
            </div>
        </div>
    );
}

export default function EvolutionPage() {
    const router = useRouter();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState("profile");
    const [leaderboard, setLeaderboard] = useState([]);
    const [userId, setUserId] = useState(null);
    const [name, setName] = useState(null);
    const [token, setToken] = useState(null);

    useEffect(() => {
        const u = getUserFromStorage();
        if (!u.token) { router.push("/auth"); return; }
        setUserId(u.userId); setName(u.name); setToken(u.token);
    }, [router]);

    const fetchProfile = async () => {
        if (!userId) { setError("Login required."); setLoading(false); return; }
        try {
            setLoading(true);
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await fetch(`${API_BASE}/api/profile/${userId}`, { headers });
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json();
            setProfile(data); setError(null);
        } catch (e) { setError(`Cannot load profile — ${e.message}`); }
        finally { setLoading(false); }
    };

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/leaderboard/global`);
            const data = await res.json();
            setLeaderboard(data.leaderboard || []);
        } catch { }
    };

    useEffect(() => {
        if (userId === null) return;
        fetchProfile(); fetchLeaderboard();
        const iv = setInterval(() => { fetchProfile(); fetchLeaderboard(); }, 30000);
        return () => clearInterval(iv);
    }, [userId]);

    const user = profile?.user;
    const xp = user?.xp || 0;
    const level = getLevelForXP(xp);
    const nextLvl = getNextLevel(level.level);
    const xpProgress = profile?.xp_progress ?? (nextLvl ? Math.min(100, Math.round(((xp - level.xp_required) / (nextLvl.xp_required - level.xp_required)) * 100)) : 100);
    const streakDays = user?.streak_days || 0;

    return (
        <div style={{ minHeight: "100vh", background: "#030b03", backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,80,20,0.35) 0%, transparent 70%)", fontFamily: "'Syne','Space Grotesk',sans-serif", color: "#f0fdf4", padding: "48px 20px 80px" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono&display=swap');
                @keyframes pulseGlow{0%,100%{opacity:0.6}50%{opacity:1}}
                @keyframes avatarPulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:0.8;transform:scale(1.05)}}
                @keyframes spin{to{transform:rotate(360deg)}}
                .tab-btn:hover{color:#22c55e!important;}
            `}</style>
            <div style={{ maxWidth: 520, margin: "0 auto" }}>
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div style={{ fontSize: 11, letterSpacing: 4, color: "#22c55e66", textTransform: "uppercase", marginBottom: 8, fontFamily: "monospace" }}>GaiaVolt · Evolution · Day 25</div>
                    <h1 style={{ margin: 0, fontSize: "clamp(24px,6vw,36px)", fontWeight: 800, background: "linear-gradient(135deg,#86efac,#22c55e,#4ade80)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Your Evolution</h1>
                    {userId && <div style={{ fontSize: 12, color: "#4b5563", marginTop: 6, fontFamily: "monospace" }}>{user?.display_name || name || userId}</div>}
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                    {[["profile", "👤 Profile"], ["leaderboard", "🏆 Leaderboard"]].map(([id, label]) => (
                        <button key={id} className="tab-btn" onClick={() => setTab(id)} style={{ flex: 1, padding: "11px", borderRadius: 10, cursor: "pointer", border: `1px solid ${tab === id ? "#22c55e" : "#1a2e1a"}`, background: tab === id ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.02)", color: tab === id ? "#22c55e" : "#6b7280", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>{label}</button>
                    ))}
                </div>

                {error && <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16, background: "rgba(239,68,68,0.08)", border: "1px solid #ef444433", fontSize: 12, color: "#fca5a5", fontFamily: "monospace" }}>⚠️ {error}</div>}

                {loading && (
                    <div style={{ textAlign: "center", padding: 40 }}>
                        <span style={{ display: "inline-block", width: 24, height: 24, border: "3px solid rgba(34,197,94,0.2)", borderTopColor: "#22c55e", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        <div style={{ fontSize: 12, color: "#4b5563", marginTop: 12, fontFamily: "monospace" }}>Loading evolution data…</div>
                    </div>
                )}

                {!loading && tab === "profile" && user && (
                    <AnimatePresence>
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                            {/* Level ring */}
                            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "24px", borderRadius: 18, marginBottom: 16, background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.1)" }}>
                                {/* 3D Avatar */}
                                <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
                                    <Avatar3D level={level.level} size={140} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: level.color }}>{level.name}</div>
                                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{xp.toLocaleString()} XP total</div>
                                    {nextLvl && (
                                        <>
                                            <div style={{ marginTop: 10, height: 5, borderRadius: 3, background: "#0d1a0d", overflow: "hidden" }}>
                                                <div style={{ height: "100%", borderRadius: 3, background: level.color, width: `${xpProgress}%`, transition: "width 1s ease", boxShadow: `0 0 8px ${level.color}` }} />
                                            </div>
                                            <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4, fontFamily: "monospace" }}>{xpProgress}% → {nextLvl.name} ({(nextLvl.xp_required - xp).toLocaleString()} XP left)</div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Stats — streak fire replaces boring number */}
                            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                <StatCard icon="🪙" label="GAIA COINS" value={(user.coins_total || 0).toFixed(1)} color="#f59e0b" />
                                <StatCard icon="🌿" label="CO₂ SAVED" value={`${(user.carbon_total || 0).toFixed(1)}kg`} color="#22c55e" />
                                <StatCard isStreak streakDays={streakDays} />
                            </div>

                            {/* Evolution path */}
                            <div style={{ padding: "16px", borderRadius: 14, marginBottom: 16, background: "rgba(0,255,100,0.02)", border: "1px solid rgba(0,255,100,0.06)" }}>
                                <div style={{ fontSize: 10, letterSpacing: 3, color: "#1f3a1f", marginBottom: 12, fontFamily: "monospace" }}>EVOLUTION PATH</div>
                                {LEVELS.map((l) => {
                                    const done = xp >= l.xp_required;
                                    const active = level.level === l.level;
                                    return (
                                        <div key={l.level} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, opacity: done ? 1 : 0.35 }}>
                                            <span style={{ fontSize: 18, width: 28 }}>{l.icon}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? l.color : "#4b5563" }}>
                                                    {l.name}{active && <span style={{ marginLeft: 6, fontSize: 10, color: l.color }}>← YOU</span>}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 10, color: "#374151", fontFamily: "monospace" }}>{l.xp_required.toLocaleString()} XP</div>
                                            {done && <span style={{ fontSize: 10, color: "#22c55e" }}>✓</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            {profile?.recent_activities?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 10, letterSpacing: 3, color: "#1f3a1f", marginBottom: 10, fontFamily: "monospace" }}>RECENT ACTIVITY</div>
                                    {profile.recent_activities.map((a, i) => <ActivityRow key={i} act={a} />)}
                                </div>
                            )}

                            <button onClick={fetchProfile} style={{ width: "100%", marginTop: 16, padding: "12px", borderRadius: 12, border: "1px solid rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.05)", color: "#22c55e", fontSize: 12, cursor: "pointer", fontFamily: "monospace" }}>↺ Refresh Data</button>
                        </motion.div>
                    </AnimatePresence>
                )}

                {!loading && tab === "leaderboard" && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                        <div style={{ fontSize: 10, letterSpacing: 3, color: "#1f3a1f", marginBottom: 12, fontFamily: "monospace" }}>GLOBAL LEADERBOARD</div>
                        {leaderboard.length === 0 ? (
                            <div style={{ textAlign: "center", padding: 32, color: "#374151", fontSize: 13 }}>No heroes yet — be the first! 🌱</div>
                        ) : leaderboard.map((u, i) => {
                            const lv = getLevelForXP(u.xp || 0);
                            const medals = ["🥇", "🥈", "🥉"];
                            const isMe = u.user_id === userId;
                            return (
                                <div key={u.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, marginBottom: 8, background: isMe ? "rgba(34,197,94,0.08)" : "rgba(0,255,100,0.02)", border: `1px solid ${isMe ? "rgba(34,197,94,0.3)" : "rgba(0,255,100,0.06)"}` }}>
                                    <span style={{ fontSize: 18, width: 28 }}>{medals[i] || `#${i + 1}`}</span>
                                    <span style={{ fontSize: 22 }}>{lv.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: isMe ? "#22c55e" : "#e2e8f0" }}>{u.name} {isMe && "← You"}</div>
                                        <div style={{ fontSize: 10, color: "#4b5563" }}>{u.city || "Planet Earth"} · Lv.{u.level}</div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 13, color: lv.color, fontFamily: "monospace", fontWeight: 700 }}>{(u.xp || 0).toLocaleString()} XP</div>
                                        <div style={{ fontSize: 10, color: "#6b7280" }}>{(u.carbon || 0).toFixed(1)} kg CO₂</div>
                                    </div>
                                </div>
                            );
                        })}
                    </motion.div>
                )}

                <div style={{ marginTop: 36, textAlign: "center", fontSize: 10, color: "#1a2e1a", fontFamily: "monospace", letterSpacing: 2 }}>
                    EVOLUTION · XP · NFTs · GAIA COINS · POLYGON
                </div>
            </div>
        </div>
    );
}