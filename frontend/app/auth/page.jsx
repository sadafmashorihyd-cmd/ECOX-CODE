'use client'
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://sadafmashori-gaiavolt.hf.space'

export default function AuthPage() {
    const router = useRouter()
    const [mode, setMode] = useState("auto") // auto | login | signup | genesis | biometric
    const [form, setForm] = useState({ name: "", email: "", password: "", city: "" })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [genesisStep, setGenesisStep] = useState(0)
    const [hasBiometric, setHasBiometric] = useState(false)
    const [particles, setParticles] = useState([])
    const [forgotMode, setForgotMode] = useState(false)
    const [forgotEmail, setForgotEmail] = useState("")
    const [forgotSent, setForgotSent] = useState(false)
    const [resetToken, setResetToken] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [resetDone, setResetDone] = useState(false)

    const handleForgotPassword = async (e) => {
        e.preventDefault(); setLoading(true); setError("")
        try {
            const res = await fetch(`${API_BASE}/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: forgotEmail }) })
            const data = await res.json()
            if (data.dev_token) setResetToken(data.dev_token)
            setForgotSent(true)
        } catch { setError("Cannot connect") }
        setLoading(false)
    }

    const handleResetPassword = async (e) => {
        e.preventDefault(); setLoading(true); setError("")
        try {
            const res = await fetch(`${API_BASE}/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, password: newPassword }) })
            const data = await res.json()
            if (!res.ok) { setError(data.error); setLoading(false); return }
            if (data.token) { localStorage.setItem("gv_token", data.token); setResetDone(true); setTimeout(() => router.push("/"), 2000) }
        } catch { setError("Cannot connect") }
        setLoading(false)
    }

    const genesisMessages = [
        { icon: "🌍", title: "Welcome to GaiaVolt", msg: "The world's first AI + Blockchain planetary impact verifier." },
        { icon: "🔒", title: "Your Data is Sacred", msg: "Zero-Knowledge proofs protect your identity. We verify actions, not spy on people." },
        { icon: "⛓️", title: "Every Action is Permanent", msg: "Your eco-actions are minted on Polygon blockchain — immutable proof forever." },
        { icon: "🌱", title: "You are now a Planet Guardian", msg: "Your first verified action will cool a 1mm patch of the Arctic. Let's begin." }
    ]

    // Check biometric availability
    useEffect(() => {
        const pts = Array.from({ length: 40 }, (_, i) => ({
            id: i, x: Math.random() * 100, y: Math.random() * 100,
            size: Math.random() * 2 + 0.5, speed: Math.random() * 0.3 + 0.1,
            opacity: Math.random() * 0.5 + 0.2
        }))
        setParticles(pts)

        // Check WebAuthn support
        if (typeof window !== "undefined" &&
            window.PublicKeyCredential &&
            navigator.credentials) {
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                .then(available => {
                    setHasBiometric(available)
                    setMode(available ? "biometric" : "login")
                })
                .catch(() => setMode("login"))
        } else {
            setMode("login")
        }
    }, [])

    // ── Biometric Registration ────────────────────────────────────────────────
    const handleBiometricSignup = async () => {
        setLoading(true)
        setError("")
        try {
            const userId = crypto.randomUUID()
            const challenge = crypto.getRandomValues(new Uint8Array(32))

            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: { name: "GaiaVolt", id: window.location.hostname },
                    user: {
                        id: new TextEncoder().encode(userId),
                        name: `gv_${userId.slice(0, 8)}`,
                        displayName: "Planet Guardian"
                    },
                    pubKeyCredParams: [
                        { type: "public-key", alg: -7 },
                        { type: "public-key", alg: -257 }
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform",
                        userVerification: "required",
                        residentKey: "preferred"
                    },
                    timeout: 60000,
                }
            })

            if (!credential) throw new Error("Biometric cancelled")

            // Register with backend using biometric credential ID
            const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
            const res = await fetch(`${API_BASE}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Planet Guardian",
                    email: `${userId.slice(0, 8)}@gaiavolt.bio`,
                    password: credId.slice(0, 32),
                    city: "Earth",
                    biometric_id: credId
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Signup failed")

            localStorage.setItem("gv_token", data.token)
            localStorage.setItem("gv_user", JSON.stringify(data.user))
            localStorage.setItem("gv_biometric_id", credId)

            setMode("genesis")
            setGenesisStep(0)

        } catch (e) {
            if (e.name === "NotAllowedError") {
                setError("Fingerprint cancelled. Try email login instead.")
            } else {
                setError(e.message || "Biometric failed")
            }
        }
        setLoading(false)
    }

    // ── Biometric Login ───────────────────────────────────────────────────────
    const handleBiometricLogin = async () => {
        setLoading(true)
        setError("")
        try {
            const challenge = crypto.getRandomValues(new Uint8Array(32))
            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge,
                    userVerification: "required",
                    timeout: 60000,
                }
            })

            if (!credential) throw new Error("Biometric cancelled")

            const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
            const storedCredId = localStorage.getItem("gv_biometric_id")

            // Login with stored credentials
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: `${storedCredId?.slice(0, 8) || credId.slice(0, 8)}@gaiavolt.bio`,
                    password: (storedCredId || credId).slice(0, 32)
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error("Account not found. Please sign up first.")

            localStorage.setItem("gv_token", data.token)
            localStorage.setItem("gv_user", JSON.stringify(data.user))
            router.push("/")

        } catch (e) {
            if (e.name === "NotAllowedError") {
                setError("Fingerprint cancelled.")
            } else {
                setError(e.message || "Biometric login failed")
            }
        }
        setLoading(false)
    }

    // ── Email/Password Submit ─────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        try {
            const endpoint = mode === "signup" ? "/auth/signup" : "/auth/login"
            const body = mode === "signup"
                ? { name: form.name, email: form.email, password: form.password, city: form.city }
                : { email: form.email, password: form.password }

            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            })
            const data = await res.json()
            if (!res.ok) { setError(data.error || "Something went wrong"); setLoading(false); return }

            localStorage.setItem("gv_token", data.token)
            localStorage.setItem("gv_user", JSON.stringify(data.user))

            if (mode === "signup") { setMode("genesis"); setGenesisStep(0) }
            else router.push("/")
        } catch { setError("Cannot connect to server") }
        setLoading(false)
    }

    const nextGenesis = () => {
        if (genesisStep < genesisMessages.length - 1) setGenesisStep(s => s + 1)
        else router.push("/")
    }

    // ── Genesis Screen ────────────────────────────────────────────────────────
    if (mode === "genesis") {
        const step = genesisMessages[genesisStep]
        return (
            <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New', monospace", position: "relative", overflow: "hidden" }}>
                {particles.map(p => (
                    <div key={p.id} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, borderRadius: "50%", background: "#00ff88", opacity: p.opacity, animation: `float ${3 + p.speed * 10}s ease-in-out infinite`, animationDelay: `${p.id * 0.1}s` }} />
                ))}
                <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}} @keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{box-shadow:0 0 20px #00ff88}50%{box-shadow:0 0 40px #00ff88,0 0 80px #00ff8855}}`}</style>
                <div style={{ textAlign: "center", padding: "2rem", maxWidth: "480px", animation: "fadeIn 0.8s ease" }}>
                    <div style={{ fontSize: "80px", marginBottom: "1.5rem" }}>{step.icon}</div>
                    <h1 style={{ color: "#00ff88", fontSize: "24px", fontWeight: "bold", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "3px" }}>{step.title}</h1>
                    <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "16px", lineHeight: "1.8", marginBottom: "2.5rem" }}>{step.msg}</p>
                    <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "2rem" }}>
                        {genesisMessages.map((_, i) => (
                            <div key={i} style={{ width: i === genesisStep ? "24px" : "8px", height: "8px", borderRadius: "4px", background: i === genesisStep ? "#00ff88" : "rgba(0,255,136,0.3)", transition: "all 0.3s ease" }} />
                        ))}
                    </div>
                    <button onClick={nextGenesis} style={{ background: "transparent", border: "1px solid #00ff88", color: "#00ff88", padding: "14px 40px", fontSize: "14px", letterSpacing: "2px", cursor: "pointer", textTransform: "uppercase", borderRadius: "4px", animation: "pulse 2s infinite" }}>
                        {genesisStep < genesisMessages.length - 1 ? "Continue →" : "Begin My Mission 🌱"}
                    </button>
                </div>
            </div>
        )
    }

    // ── Biometric Screen ──────────────────────────────────────────────────────
    if (mode === "biometric") {
        const hasAccount = !!localStorage.getItem?.("gv_biometric_id")
        return (
            <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#000 0%,#0a0a0a 50%,#001a0d 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New',monospace", padding: "1rem", position: "relative", overflow: "hidden" }}>
                {particles.map(p => (
                    <div key={p.id} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, borderRadius: "50%", background: "#00ff88", opacity: p.opacity * 0.3, animation: `float ${3 + p.speed * 10}s ease-in-out infinite` }} />
                ))}
                <style>{`
                    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}}
                    @keyframes glow{0%,100%{text-shadow:0 0 10px #00ff88}50%{text-shadow:0 0 20px #00ff88,0 0 40px #00ff8844}}
                    @keyframes scanline{0%{top:-10%}100%{top:110%}}
                    @keyframes thumbPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 0 10px #00ff88)}50%{transform:scale(1.1);filter:drop-shadow(0 0 25px #00ff88)}}
                `}</style>

                {/* Scanline */}
                <div style={{ position: "fixed", left: 0, right: 0, height: "3px", background: "linear-gradient(transparent,rgba(0,255,136,0.1),transparent)", animation: "scanline 4s linear infinite", pointerEvents: "none" }} />

                <div style={{ width: "100%", maxWidth: "380px", background: "rgba(0,0,0,0.85)", border: "1px solid rgba(0,255,136,0.3)", borderRadius: "16px", padding: "2.5rem", position: "relative", backdropFilter: "blur(10px)", textAlign: "center" }}>

                    {/* Logo */}
                    <div style={{ fontSize: "40px", marginBottom: "8px" }}>🌍</div>
                    <h1 style={{ color: "#00ff88", fontSize: "22px", fontWeight: "bold", letterSpacing: "4px", textTransform: "uppercase", animation: "glow 3s infinite", margin: "0 0 6px" }}>GaiaVolt</h1>
                    <p style={{ color: "rgba(0,255,136,0.5)", fontSize: "11px", letterSpacing: "2px", margin: "0 0 32px" }}>PROOF OF PLANET PROTOCOL</p>

                    {/* Fingerprint icon */}
                    <div style={{ fontSize: "80px", marginBottom: "16px", animation: "thumbPulse 2s ease-in-out infinite" }}>
                        👆
                    </div>

                    <h2 style={{ color: "#e2e8f0", fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>
                        {hasAccount ? "Welcome Back!" : "One Touch to Begin"}
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", lineHeight: "1.6", marginBottom: "28px" }}>
                        {hasAccount
                            ? "Use your fingerprint or FaceID to continue your mission."
                            : "No password needed. Your biometric is your identity."}
                    </p>

                    {error && <div style={{ padding: "10px", marginBottom: "16px", background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", borderRadius: "8px", color: "#ff6666", fontSize: "12px" }}>{error}</div>}

                    {/* Main biometric button */}
                    <button
                        onClick={hasAccount ? handleBiometricLogin : handleBiometricSignup}
                        disabled={loading}
                        style={{ width: "100%", padding: "16px", background: loading ? "rgba(0,255,136,0.1)" : "linear-gradient(135deg,rgba(0,255,136,0.15),rgba(0,255,136,0.08))", border: "1px solid #00ff88", borderRadius: "10px", color: "#00ff88", fontSize: "15px", fontWeight: "700", letterSpacing: "2px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: "16px", transition: "all 0.2s" }}
                    >
                        {loading ? "⏳ Verifying..." : hasAccount ? "🔐 Touch to Login" : "👆 Touch to Join"}
                    </button>

                    {/* Alternative — email */}
                    <div style={{ borderTop: "1px solid rgba(0,255,136,0.1)", paddingTop: "16px", marginTop: "4px" }}>
                        <p style={{ color: "rgba(0,255,136,0.35)", fontSize: "11px", marginBottom: "10px" }}>or use email instead</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={() => { setMode("login"); setError("") }} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "rgba(0,255,136,0.5)", fontSize: "11px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "1px" }}>
                                Login
                            </button>
                            <button onClick={() => { setMode("signup"); setError("") }} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "rgba(0,255,136,0.5)", fontSize: "11px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "1px" }}>
                                Sign Up
                            </button>
                        </div>
                    </div>

                    {/* Privacy note */}
                    <p style={{ color: "rgba(0,255,136,0.25)", fontSize: "10px", marginTop: "20px", lineHeight: "1.5" }}>
                        🔒 Biometric data never leaves your device.<br />
                        Zero-Knowledge Privacy — GDPR compliant.
                    </p>
                </div>
            </div>
        )
    }

    // ── Email/Password Screen ─────────────────────────────────────────────────
    return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#000 0%,#0a0a0a 50%,#001a0d 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New',monospace", padding: "1rem", position: "relative", overflow: "hidden" }}>
            <style>{`
                @keyframes glow{0%,100%{text-shadow:0 0 10px #00ff88}50%{text-shadow:0 0 20px #00ff88,0 0 40px #00ff8844}}
                @keyframes scanline{0%{top:-10%}100%{top:110%}}
                input::placeholder{color:rgba(0,255,136,0.3);}
                input:focus{outline:none;border-color:#00ff88!important;box-shadow:0 0 10px rgba(0,255,136,0.2);}
                .gv-btn:hover{background:rgba(0,255,136,0.15)!important;transform:translateY(-1px);}
            `}</style>

            <div style={{ position: "fixed", left: 0, right: 0, height: "3px", background: "linear-gradient(transparent,rgba(0,255,136,0.1),transparent)", animation: "scanline 4s linear infinite", pointerEvents: "none" }} />

            <div style={{ width: "100%", maxWidth: "420px", background: "rgba(0,0,0,0.85)", border: "1px solid rgba(0,255,136,0.3)", borderRadius: "8px", padding: "2.5rem", position: "relative", backdropFilter: "blur(10px)" }}>

                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <div style={{ fontSize: "40px", marginBottom: "8px" }}>🌍</div>
                    <h1 style={{ color: "#00ff88", fontSize: "22px", fontWeight: "bold", letterSpacing: "4px", textTransform: "uppercase", animation: "glow 3s infinite", margin: "0 0 6px" }}>GaiaVolt</h1>
                    <p style={{ color: "rgba(0,255,136,0.5)", fontSize: "11px", letterSpacing: "2px", margin: 0 }}>PROOF OF PLANET PROTOCOL</p>
                </div>

                {/* Back to biometric */}
                {hasBiometric && (
                    <button onClick={() => { setMode("biometric"); setError("") }} style={{ width: "100%", padding: "10px", marginBottom: "16px", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "rgba(0,255,136,0.6)", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "1px" }}>
                        ← Back to Fingerprint Login
                    </button>
                )}

                {/* Mode toggle */}
                <div style={{ display: "flex", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: "6px", marginBottom: "2rem", overflow: "hidden" }}>
                    {["login", "signup"].map(m => (
                        <button key={m} onClick={() => { setMode(m); setError("") }} style={{ flex: 1, padding: "10px", background: mode === m ? "rgba(0,255,136,0.15)" : "transparent", border: "none", color: mode === m ? "#00ff88" : "rgba(0,255,136,0.4)", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", borderRight: m === "login" ? "1px solid rgba(0,255,136,0.15)" : "none", fontFamily: "inherit" }}>
                            {m === "login" ? "Login" : "Sign Up"}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    {mode === "signup" && (
                        <div style={{ marginBottom: "1rem" }}>
                            <label style={{ display: "block", color: "rgba(0,255,136,0.6)", fontSize: "11px", letterSpacing: "1px", marginBottom: "6px" }}>YOUR NAME</label>
                            <input type="text" required placeholder="Planet Guardian" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: "100%", padding: "12px", boxSizing: "border-box", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "4px", color: "#00ff88", fontSize: "14px", fontFamily: "inherit" }} />
                        </div>
                    )}
                    <div style={{ marginBottom: "1rem" }}>
                        <label style={{ display: "block", color: "rgba(0,255,136,0.6)", fontSize: "11px", letterSpacing: "1px", marginBottom: "6px" }}>EMAIL</label>
                        <input type="email" required placeholder="guardian@planet.earth" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ width: "100%", padding: "12px", boxSizing: "border-box", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "4px", color: "#00ff88", fontSize: "14px", fontFamily: "inherit" }} />
                    </div>
                    <div style={{ marginBottom: mode === "signup" ? "1rem" : "1.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <label style={{ color: "rgba(0,255,136,0.6)", fontSize: "11px", letterSpacing: "1px" }}>PASSWORD</label>
                            {mode === "login" && (
                                <button type="button" onClick={() => setForgotMode(true)} style={{ background: "none", border: "none", color: "rgba(0,255,136,0.4)", fontSize: "10px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "1px" }}>
                                    Forgot?
                                </button>
                            )}
                        </div>
                        <input type="password" required placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ width: "100%", padding: "12px", boxSizing: "border-box", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "4px", color: "#00ff88", fontSize: "14px", fontFamily: "inherit" }} />
                    </div>
                    {mode === "signup" && (
                        <div style={{ marginBottom: "1.5rem" }}>
                            <label style={{ display: "block", color: "rgba(0,255,136,0.6)", fontSize: "11px", letterSpacing: "1px", marginBottom: "6px" }}>CITY</label>
                            <input type="text" required placeholder="Karachi" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={{ width: "100%", padding: "12px", boxSizing: "border-box", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "4px", color: "#00ff88", fontSize: "14px", fontFamily: "inherit" }} />
                        </div>
                    )}
                    {error && <div style={{ padding: "10px", marginBottom: "1rem", background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", borderRadius: "4px", color: "#ff6666", fontSize: "13px", textAlign: "center" }}>{error}</div>}
                    <button type="submit" disabled={loading} className="gv-btn" style={{ width: "100%", padding: "14px", background: loading ? "rgba(0,255,136,0.1)" : "rgba(0,255,136,0.12)", border: "1px solid #00ff88", borderRadius: "4px", color: "#00ff88", fontSize: "13px", letterSpacing: "3px", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                        {loading ? "⏳ Processing..." : mode === "login" ? "⚡ Enter GaiaVolt" : "🌱 Join the Mission"}
                    </button>
                </form>
            </div>
            {/* Forgot Password Modal */}
            {forgotMode && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                    <div style={{ width: "100%", maxWidth: "380px", background: "rgba(0,0,0,0.95)", border: "1px solid rgba(0,255,136,0.3)", borderRadius: "12px", padding: "28px" }}>
                        <h2 style={{ color: "#00ff88", fontSize: "18px", fontWeight: "700", marginBottom: "6px", fontFamily: "'Courier New',monospace" }}>Reset Password</h2>
                        <p style={{ color: "rgba(0,255,136,0.4)", fontSize: "12px", marginBottom: "20px", fontFamily: "'Courier New',monospace" }}>Enter your email to receive a reset link.</p>

                        {!forgotSent ? (
                            <form onSubmit={handleForgotPassword}>
                                <input type="email" required placeholder="guardian@planet.earth" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                                    style={{ width: "100%", padding: "12px", boxSizing: "border-box", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "#00ff88", fontSize: "13px", fontFamily: "'Courier New',monospace", marginBottom: "12px", outline: "none" }} />
                                {error && <div style={{ color: "#ff6666", fontSize: "12px", marginBottom: "10px" }}>{error}</div>}
                                <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "rgba(0,255,136,0.1)", border: "1px solid #00ff88", borderRadius: "6px", color: "#00ff88", fontSize: "12px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", letterSpacing: "2px", marginBottom: "8px" }}>
                                    {loading ? "⏳ Sending..." : "⚡ Send Reset Link"}
                                </button>
                            </form>
                        ) : !resetDone ? (
                            <form onSubmit={handleResetPassword}>
                                <div style={{ padding: "12px", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "rgba(0,255,136,0.7)", fontSize: "12px", fontFamily: "'Courier New',monospace", marginBottom: "14px", lineHeight: 1.6 }}>
                                    ✅ Reset link sent!<br />
                                    {resetToken && <span style={{ color: "rgba(0,255,136,0.4)" }}>Dev token: {resetToken.slice(0, 16)}...</span>}
                                </div>
                                <input type="text" placeholder="Paste reset token" value={resetToken} onChange={e => setResetToken(e.target.value)}
                                    style={{ width: "100%", padding: "10px", boxSizing: "border-box", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "#00ff88", fontSize: "12px", fontFamily: "monospace", marginBottom: "8px", outline: "none" }} />
                                <input type="password" required placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                    style={{ width: "100%", padding: "10px", boxSizing: "border-box", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "#00ff88", fontSize: "12px", fontFamily: "monospace", marginBottom: "12px", outline: "none" }} />
                                {error && <div style={{ color: "#ff6666", fontSize: "12px", marginBottom: "10px" }}>{error}</div>}
                                <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "rgba(0,255,136,0.1)", border: "1px solid #00ff88", borderRadius: "6px", color: "#00ff88", fontSize: "12px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", letterSpacing: "2px", marginBottom: "8px" }}>
                                    {loading ? "⏳ Resetting..." : "🔑 Reset Password"}
                                </button>
                            </form>
                        ) : (
                            <div style={{ textAlign: "center", padding: "20px", color: "#22c55e", fontSize: "14px", fontFamily: "monospace" }}>
                                ✅ Password reset! Redirecting...
                            </div>
                        )}

                        <button onClick={() => { setForgotMode(false); setForgotSent(false); setError(""); setResetToken(""); setNewPassword("") }} style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid rgba(0,255,136,0.15)", borderRadius: "6px", color: "rgba(0,255,136,0.4)", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}