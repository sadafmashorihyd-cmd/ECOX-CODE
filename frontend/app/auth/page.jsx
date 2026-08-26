'use client'
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    "https://rjqxdsrhgnydhtlegyxx.supabase.co",
    "sb_publishable_yxkdO7v2GNL4TAzJ1lbb_g_wXjYxLQY"
)

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://sadafmashori-gaiavolt.hf.space'

const CATEGORIES = [
    { id: "plantation", icon: "🌱", label: "Tree Planting" },
    { id: "cycling", icon: "🚴", label: "Cycling" },
    { id: "solar_panels", icon: "☀️", label: "Solar Energy" },
    { id: "recycling", icon: "♻️", label: "Recycling" },
    { id: "led_lighting", icon: "💡", label: "LED Lighting" },
    { id: "ev_charging", icon: "⚡", label: "EV Charging" },
]

const COMMITMENTS = [
    "I will reduce my carbon footprint every day",
    "I will inspire others to take climate action",
    "I will track and verify my eco-actions",
    "I will become a Carbon Zero Hero by 2030",
]

export default function AuthPage() {
    const router = useRouter()
    const [mode, setMode] = useState("auto")
    const [step, setStep] = useState(1) // signup steps: 1=credentials, 2=profile, 3=categories
    const [form, setForm] = useState({
        name: "", email: "", password: "", city: "",
        commitment: "", categories: []
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [genesisStep, setGenesisStep] = useState(0)
    const [hasBiometric, setHasBiometric] = useState(false)
    const [particles, setParticles] = useState([])
    const [forgotMode, setForgotMode] = useState(false)
    const [forgotEmail, setForgotEmail] = useState("")
    const [forgotSent, setForgotSent] = useState(false)
    const [nameStep, setNameStep] = useState(false)
    const [biometricName, setBiometricName] = useState("")
    const [biometricCity, setBiometricCity] = useState("")

    const genesisMessages = [
        { icon: "🌍", title: "Welcome to GaiaVolt", msg: "The world's first AI + Blockchain planetary impact verifier." },
        { icon: "🔒", title: "Your Data is Sacred", msg: "Zero-Knowledge proofs protect your identity. We verify actions, not spy on people." },
        { icon: "⛓️", title: "Every Action is Permanent", msg: "Your eco-actions are minted on Polygon blockchain — immutable proof forever." },
        { icon: "🌱", title: "You are now a Planet Guardian", msg: "Your first verified action will cool a 1mm patch of the Arctic. Let's begin." }
    ]

    useEffect(() => {
        const pts = Array.from({ length: 40 }, (_, i) => ({
            id: i, x: Math.random() * 100, y: Math.random() * 100,
            size: Math.random() * 2 + 0.5, speed: Math.random() * 0.3 + 0.1,
            opacity: Math.random() * 0.5 + 0.2
        }))
        setParticles(pts)

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                localStorage.setItem("gv_token", session.access_token)
                localStorage.setItem("gv_user", JSON.stringify({
                    user_id: session.user.id,
                    name: session.user.user_metadata?.name || "",
                    email: session.user.email,
                    city: session.user.user_metadata?.city || ""
                }))
                router.push("/")
            }
        })

        if (typeof window !== "undefined" && window.PublicKeyCredential && navigator.credentials) {
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

    const toggleCategory = (id) => {
        setForm(f => ({
            ...f,
            categories: f.categories.includes(id)
                ? f.categories.filter(c => c !== id)
                : [...f.categories, id]
        }))
    }

    const handleSignupStep1 = (e) => {
        e.preventDefault()
        if (!form.name.trim()) { setError("Please enter your name"); return }
        if (!form.email.trim()) { setError("Please enter your email"); return }
        if (form.password.length < 6) { setError("Password must be at least 6 characters"); return }
        setError("")
        setStep(2)
    }

    const handleSignupStep2 = (e) => {
        e.preventDefault()
        if (!form.city.trim()) { setError("Please enter your city"); return }
        if (!form.commitment) { setError("Please select a commitment"); return }
        setError("")
        setStep(3)
    }

    const handleSignupStep3 = async () => {
        setLoading(true)
        setError("")
        try {
            const { data, error: signupError } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                    data: {
                        name: form.name,
                        city: form.city,
                        commitment: form.commitment,
                        categories: form.categories
                    }
                }
            })
            if (signupError) throw signupError

            try {
                await fetch(`${API_BASE}/auth/signup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: form.name, email: form.email,
                        password: form.password, city: form.city,
                        commitment: form.commitment
                    })
                })
            } catch (e) { console.log("Backend sync:", e) }

            localStorage.setItem("gv_token", data.session?.access_token || "")
            localStorage.setItem("gv_user", JSON.stringify({
                user_id: data.user?.id,
                name: form.name,
                email: form.email,
                city: form.city,
                commitment: form.commitment,
                categories: form.categories
            }))
            setMode("genesis")
            setGenesisStep(0)
        } catch (err) {
            setError(err.message || "Signup failed")
        }
        setLoading(false)
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        try {
            const { data, error: loginError } = await supabase.auth.signInWithPassword({
                email: form.email, password: form.password
            })
            if (loginError) throw loginError

            try {
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: form.email, password: form.password })
                })
                const backendData = await res.json()
                if (backendData.token) {
                    localStorage.setItem("gv_token", backendData.token)
                    localStorage.setItem("gv_user", JSON.stringify(backendData.user))
                } else {
                    localStorage.setItem("gv_token", data.session.access_token)
                    localStorage.setItem("gv_user", JSON.stringify({
                        user_id: data.user.id,
                        name: data.user.user_metadata?.name || form.email.split("@")[0],
                        email: data.user.email,
                        city: data.user.user_metadata?.city || ""
                    }))
                }
            } catch (e) {
                localStorage.setItem("gv_token", data.session.access_token)
                localStorage.setItem("gv_user", JSON.stringify({
                    user_id: data.user.id,
                    name: data.user.user_metadata?.name || form.email.split("@")[0],
                    email: data.user.email
                }))
            }
            router.push("/")
        } catch (err) {
            setError(err.message || "Invalid email or password")
        }
        setLoading(false)
    }

    const handleBiometricSignup = async (customName, customCity) => {
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
                        displayName: customName
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
            const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
            const email = `${userId.slice(0, 8)}@gaiavolt.bio`
            const password = credId.slice(0, 32)

            const { data, error: signupError } = await supabase.auth.signUp({
                email, password,
                options: { data: { name: customName, city: customCity, biometric_id: credId } }
            })
            if (signupError) throw signupError

            try {
                await fetch(`${API_BASE}/auth/signup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: customName, email, password, city: customCity })
                })
            } catch (e) { console.log("Backend sync:", e) }

            localStorage.setItem("gv_token", data.session?.access_token || "")
            localStorage.setItem("gv_user", JSON.stringify({ user_id: data.user?.id, name: customName, email, city: customCity }))
            localStorage.setItem("gv_biometric_id", credId)
            localStorage.setItem("gv_biometric_email", email)
            localStorage.setItem("gv_biometric_password", password)
            setMode("genesis")
            setGenesisStep(0)
        } catch (e) {
            if (e.name === "NotAllowedError") setError("Fingerprint cancelled. Try email login.")
            else setError(e.message || "Biometric failed")
        }
        setLoading(false)
    }

    const handleBiometricLogin = async () => {
        setLoading(true)
        setError("")
        try {
            const challenge = crypto.getRandomValues(new Uint8Array(32))
            const credential = await navigator.credentials.get({
                publicKey: { challenge, userVerification: "required", timeout: 60000 }
            })
            if (!credential) throw new Error("Biometric cancelled")

            const storedEmail = localStorage.getItem("gv_biometric_email")
            const storedPassword = localStorage.getItem("gv_biometric_password")
            if (!storedEmail || !storedPassword) throw new Error("No saved passkey. Please sign up first.")

            const { data, error: loginError } = await supabase.auth.signInWithPassword({
                email: storedEmail, password: storedPassword
            })
            if (loginError) throw loginError

            try {
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: storedEmail, password: storedPassword })
                })
                const backendData = await res.json()
                if (backendData.token) {
                    localStorage.setItem("gv_token", backendData.token)
                    localStorage.setItem("gv_user", JSON.stringify(backendData.user))
                }
            } catch (e) {
                localStorage.setItem("gv_token", data.session.access_token)
                localStorage.setItem("gv_user", JSON.stringify({
                    user_id: data.user.id,
                    name: data.user.user_metadata?.name || "Guardian",
                    email: data.user.email
                }))
            }
            router.push("/")
        } catch (e) {
            if (e.name === "NotAllowedError") setError("Fingerprint cancelled.")
            else setError(e.message || "Biometric login failed.")
        }
        setLoading(false)
    }

    const handleForgotPassword = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                redirectTo: `${window.location.origin}/auth?reset=true`
            })
            if (error) throw error
            setForgotSent(true)
        } catch (e) { setError(e.message || "Cannot send reset email") }
        setLoading(false)
    }

    const nextGenesis = () => {
        if (genesisStep < genesisMessages.length - 1) setGenesisStep(s => s + 1)
        else router.push("/")
    }

    const inputStyle = { width: "100%", padding: "12px", boxSizing: "border-box", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "#00ff88", fontSize: "14px", fontFamily: "'Courier New',monospace", outline: "none" }
    const labelStyle = { display: "block", color: "rgba(0,255,136,0.6)", fontSize: "11px", letterSpacing: "1px", marginBottom: "6px", fontFamily: "monospace" }

    // ── Genesis Screen ──────────────────────────────────────────────────
    if (mode === "genesis") {
        const gStep = genesisMessages[genesisStep]
        return (
            <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New', monospace", position: "relative", overflow: "hidden" }}>
                {particles.map(p => (
                    <div key={p.id} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, borderRadius: "50%", background: "#00ff88", opacity: p.opacity, animation: `float ${3 + p.speed * 10}s ease-in-out infinite` }} />
                ))}
                <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}} @keyframes pulse{0%,100%{box-shadow:0 0 20px #00ff88}50%{box-shadow:0 0 40px #00ff88,0 0 80px #00ff8855}}`}</style>
                <div style={{ textAlign: "center", padding: "2rem", maxWidth: "480px" }}>
                    <div style={{ fontSize: "80px", marginBottom: "1.5rem" }}>{gStep.icon}</div>
                    <h1 style={{ color: "#00ff88", fontSize: "24px", fontWeight: "bold", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "3px" }}>{gStep.title}</h1>
                    <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "16px", lineHeight: "1.8", marginBottom: "2.5rem" }}>{gStep.msg}</p>
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

    // ── Biometric Screen ────────────────────────────────────────────────
    if (mode === "biometric") {
        const hasAccount = typeof window !== "undefined" && !!localStorage.getItem("gv_biometric_id")
        return (
            <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#000 0%,#001a0d 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New',monospace", padding: "1rem", position: "relative", overflow: "hidden" }}>
                {particles.map(p => (
                    <div key={p.id} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, borderRadius: "50%", background: "#00ff88", opacity: p.opacity * 0.3, animation: `float ${3 + p.speed * 10}s ease-in-out infinite` }} />
                ))}
                <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}} @keyframes glow{0%,100%{text-shadow:0 0 10px #00ff88}50%{text-shadow:0 0 20px #00ff88}} @keyframes thumbPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 0 10px #00ff88)}50%{transform:scale(1.1);filter:drop-shadow(0 0 25px #00ff88)}} input:focus{outline:none;border-color:#00ff88!important;}`}</style>

                <div style={{ width: "100%", maxWidth: "380px", background: "rgba(0,0,0,0.85)", border: "1px solid rgba(0,255,136,0.3)", borderRadius: "16px", padding: "2.5rem", backdropFilter: "blur(10px)", textAlign: "center" }}>
                    <div style={{ fontSize: "40px", marginBottom: "8px" }}>🌍</div>
                    <h1 style={{ color: "#00ff88", fontSize: "22px", fontWeight: "bold", letterSpacing: "4px", textTransform: "uppercase", animation: "glow 3s infinite", margin: "0 0 6px" }}>GaiaVolt</h1>
                    <p style={{ color: "rgba(0,255,136,0.5)", fontSize: "11px", letterSpacing: "2px", margin: "0 0 32px" }}>PROOF OF PLANET PROTOCOL</p>
                    <div style={{ fontSize: "80px", marginBottom: "16px", animation: "thumbPulse 2s ease-in-out infinite" }}>👆</div>
                    <h2 style={{ color: "#e2e8f0", fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>
                        {hasAccount ? "Welcome Back!" : "One Touch to Begin"}
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", lineHeight: "1.6", marginBottom: "28px" }}>
                        {hasAccount ? "Use your fingerprint to continue your mission." : "No password needed. Your biometric is your identity."}
                    </p>
                    {error && <div style={{ padding: "10px", marginBottom: "16px", background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", borderRadius: "8px", color: "#ff6666", fontSize: "12px" }}>{error}</div>}
                    <button onClick={hasAccount ? handleBiometricLogin : () => setNameStep(true)} disabled={loading}
                        style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg,rgba(0,255,136,0.15),rgba(0,255,136,0.08))", border: "1px solid #00ff88", borderRadius: "10px", color: "#00ff88", fontSize: "15px", fontWeight: "700", letterSpacing: "2px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: "16px" }}>
                        {loading ? "⏳ Verifying..." : hasAccount ? "🔐 Touch to Login" : "👆 Touch to Join"}
                    </button>
                    <div style={{ borderTop: "1px solid rgba(0,255,136,0.1)", paddingTop: "16px" }}>
                        <p style={{ color: "rgba(0,255,136,0.35)", fontSize: "11px", marginBottom: "10px" }}>or use email instead</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={() => { setMode("login"); setError("") }} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "rgba(0,255,136,0.5)", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>Login</button>
                            <button onClick={() => { setMode("signup"); setStep(1); setError("") }} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "rgba(0,255,136,0.5)", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>Sign Up</button>
                        </div>
                    </div>
                </div>

                {/* Name Modal for Biometric */}
                {nameStep && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                        <div style={{ width: "100%", maxWidth: "360px", background: "rgba(0,0,0,0.95)", border: "1px solid rgba(0,255,136,0.4)", borderRadius: "16px", padding: "2rem", textAlign: "center" }}>
                            <div style={{ fontSize: "50px", marginBottom: "12px" }}>🌍</div>
                            <h2 style={{ color: "#00ff88", fontSize: "18px", fontWeight: "700", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "6px", fontFamily: "'Courier New',monospace" }}>Who Are You?</h2>
                            <p style={{ color: "rgba(0,255,136,0.5)", fontSize: "11px", marginBottom: "24px", fontFamily: "'Courier New',monospace" }}>Your identity will be linked to your fingerprint permanently.</p>
                            <div style={{ marginBottom: "12px", textAlign: "left" }}>
                                <label style={labelStyle}>YOUR NAME</label>
                                <input type="text" placeholder="Your real name" value={biometricName} onChange={e => setBiometricName(e.target.value)} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: "20px", textAlign: "left" }}>
                                <label style={labelStyle}>YOUR CITY</label>
                                <input type="text" placeholder="Karachi" value={biometricCity} onChange={e => setBiometricCity(e.target.value)} style={inputStyle} />
                            </div>
                            <button onClick={() => { if (!biometricName.trim()) { setError("Please enter your name"); return } setNameStep(false); handleBiometricSignup(biometricName, biometricCity || "Earth") }} disabled={loading}
                                style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,rgba(0,255,136,0.15),rgba(0,255,136,0.08))", border: "1px solid #00ff88", borderRadius: "10px", color: "#00ff88", fontSize: "14px", fontWeight: "700", letterSpacing: "2px", cursor: "pointer", fontFamily: "inherit", marginBottom: "10px" }}>
                                {loading ? "⏳ Setting up..." : "👆 Continue with Fingerprint"}
                            </button>
                            {error && <div style={{ color: "#ff6666", fontSize: "12px", marginBottom: "8px" }}>{error}</div>}
                            <button onClick={() => { setNameStep(false); setError("") }} style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid rgba(0,255,136,0.15)", borderRadius: "6px", color: "rgba(0,255,136,0.4)", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // ── Signup Multi-Step ───────────────────────────────────────────────
    if (mode === "signup") {
        return (
            <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#000 0%,#001a0d 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New',monospace", padding: "1rem" }}>
                <style>{`@keyframes glow{0%,100%{text-shadow:0 0 10px #00ff88}50%{text-shadow:0 0 20px #00ff88}} input::placeholder{color:rgba(0,255,136,0.3);} input:focus{outline:none;border-color:#00ff88!important;} select:focus{outline:none;border-color:#00ff88!important;}`}</style>

                <div style={{ width: "100%", maxWidth: "440px", background: "rgba(0,0,0,0.85)", border: "1px solid rgba(0,255,136,0.3)", borderRadius: "12px", padding: "2rem", backdropFilter: "blur(10px)" }}>

                    {/* Header */}
                    <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                        <div style={{ fontSize: "36px", marginBottom: "6px" }}>🌍</div>
                        <h1 style={{ color: "#00ff88", fontSize: "20px", fontWeight: "bold", letterSpacing: "4px", textTransform: "uppercase", animation: "glow 3s infinite", margin: "0 0 4px" }}>GaiaVolt</h1>
                        <p style={{ color: "rgba(0,255,136,0.4)", fontSize: "10px", letterSpacing: "2px", margin: 0 }}>JOIN THE MISSION</p>
                    </div>

                    {/* Progress */}
                    <div style={{ display: "flex", gap: "6px", marginBottom: "1.5rem" }}>
                        {[1, 2, 3].map(s => (
                            <div key={s} style={{ flex: 1, height: "3px", borderRadius: "2px", background: s <= step ? "#00ff88" : "rgba(0,255,136,0.15)", transition: "all 0.3s" }} />
                        ))}
                    </div>

                    {error && <div style={{ padding: "10px", marginBottom: "1rem", background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", borderRadius: "6px", color: "#ff6666", fontSize: "12px", textAlign: "center" }}>{error}</div>}

                    {/* Step 1: Credentials */}
                    {step === 1 && (
                        <form onSubmit={handleSignupStep1}>
                            <p style={{ color: "rgba(0,255,136,0.6)", fontSize: "11px", letterSpacing: "1px", marginBottom: "16px", textAlign: "center" }}>STEP 1 OF 3 — YOUR IDENTITY</p>
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={labelStyle}>YOUR NAME</label>
                                <input type="text" required placeholder="Enter your real name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={labelStyle}>EMAIL</label>
                                <input type="email" required placeholder="guardian@planet.earth" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: "1.5rem" }}>
                                <label style={labelStyle}>PASSWORD</label>
                                <input type="password" required placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
                            </div>
                            <button type="submit" style={{ width: "100%", padding: "13px", background: "rgba(0,255,136,0.12)", border: "1px solid #00ff88", borderRadius: "6px", color: "#00ff88", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}>
                                Continue →
                            </button>
                            <button type="button" onClick={() => { setMode("login"); setError("") }} style={{ width: "100%", padding: "10px", marginTop: "8px", background: "transparent", border: "none", color: "rgba(0,255,136,0.4)", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
                                Already have an account? Login
                            </button>
                        </form>
                    )}

                    {/* Step 2: Profile */}
                    {step === 2 && (
                        <form onSubmit={handleSignupStep2}>
                            <p style={{ color: "rgba(0,255,136,0.6)", fontSize: "11px", letterSpacing: "1px", marginBottom: "16px", textAlign: "center" }}>STEP 2 OF 3 — YOUR MISSION</p>
                            <div style={{ marginBottom: "1rem" }}>
                                <label style={labelStyle}>YOUR CITY</label>
                                <input type="text" required placeholder="Karachi" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: "1.5rem" }}>
                                <label style={labelStyle}>YOUR COMMITMENT</label>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {COMMITMENTS.map((c, i) => (
                                        <div key={i} onClick={() => setForm(f => ({ ...f, commitment: c }))}
                                            style={{ padding: "10px 12px", background: form.commitment === c ? "rgba(0,255,136,0.15)" : "rgba(0,255,136,0.03)", border: `1px solid ${form.commitment === c ? "#00ff88" : "rgba(0,255,136,0.15)"}`, borderRadius: "6px", color: form.commitment === c ? "#00ff88" : "rgba(0,255,136,0.5)", fontSize: "11px", cursor: "pointer", lineHeight: "1.4", transition: "all 0.2s" }}>
                                            {form.commitment === c ? "✅ " : "○ "}{c}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button type="button" onClick={() => setStep(1)} style={{ flex: 1, padding: "12px", background: "transparent", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "rgba(0,255,136,0.5)", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
                                <button type="submit" style={{ flex: 2, padding: "12px", background: "rgba(0,255,136,0.12)", border: "1px solid #00ff88", borderRadius: "6px", color: "#00ff88", fontSize: "12px", letterSpacing: "2px", cursor: "pointer", fontFamily: "inherit" }}>Continue →</button>
                            </div>
                        </form>
                    )}

                    {/* Step 3: Categories */}
                    {step === 3 && (
                        <div>
                            <p style={{ color: "rgba(0,255,136,0.6)", fontSize: "11px", letterSpacing: "1px", marginBottom: "16px", textAlign: "center" }}>STEP 3 OF 3 — YOUR ECO-ACTIONS</p>
                            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginBottom: "14px", textAlign: "center" }}>What eco-actions will you verify?</p>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "1.5rem" }}>
                                {CATEGORIES.map(cat => (
                                    <div key={cat.id} onClick={() => toggleCategory(cat.id)}
                                        style={{ padding: "12px", background: form.categories.includes(cat.id) ? "rgba(0,255,136,0.15)" : "rgba(0,255,136,0.03)", border: `1px solid ${form.categories.includes(cat.id) ? "#00ff88" : "rgba(0,255,136,0.15)"}`, borderRadius: "8px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                                        <div style={{ fontSize: "24px", marginBottom: "4px" }}>{cat.icon}</div>
                                        <div style={{ color: form.categories.includes(cat.id) ? "#00ff88" : "rgba(0,255,136,0.5)", fontSize: "10px", letterSpacing: "1px" }}>{cat.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button onClick={() => setStep(2)} style={{ flex: 1, padding: "12px", background: "transparent", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "rgba(0,255,136,0.5)", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
                                <button onClick={handleSignupStep3} disabled={loading} style={{ flex: 2, padding: "12px", background: "rgba(0,255,136,0.12)", border: "1px solid #00ff88", borderRadius: "6px", color: "#00ff88", fontSize: "12px", letterSpacing: "2px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                                    {loading ? "⏳ Creating..." : "🌱 Join Mission"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ── Login Screen ────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#000 0%,#001a0d 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New',monospace", padding: "1rem" }}>
            <style>{`@keyframes glow{0%,100%{text-shadow:0 0 10px #00ff88}50%{text-shadow:0 0 20px #00ff88}} input::placeholder{color:rgba(0,255,136,0.3);} input:focus{outline:none;border-color:#00ff88!important;} .gv-btn:hover{background:rgba(0,255,136,0.15)!important;}`}</style>

            <div style={{ width: "100%", maxWidth: "420px", background: "rgba(0,0,0,0.85)", border: "1px solid rgba(0,255,136,0.3)", borderRadius: "12px", padding: "2.5rem", backdropFilter: "blur(10px)" }}>
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <div style={{ fontSize: "40px", marginBottom: "8px" }}>🌍</div>
                    <h1 style={{ color: "#00ff88", fontSize: "22px", fontWeight: "bold", letterSpacing: "4px", textTransform: "uppercase", animation: "glow 3s infinite", margin: "0 0 6px" }}>GaiaVolt</h1>
                    <p style={{ color: "rgba(0,255,136,0.5)", fontSize: "11px", letterSpacing: "2px", margin: 0 }}>PROOF OF PLANET PROTOCOL</p>
                </div>

                {hasBiometric && (
                    <button onClick={() => { setMode("biometric"); setError("") }} style={{ width: "100%", padding: "10px", marginBottom: "16px", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "6px", color: "rgba(0,255,136,0.6)", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
                        👆 Use Fingerprint Instead
                    </button>
                )}

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: "1rem" }}>
                        <label style={labelStyle}>EMAIL</label>
                        <input type="email" required placeholder="guardian@planet.earth" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ marginBottom: "1.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>PASSWORD</label>
                            <button type="button" onClick={() => setForgotMode(true)} style={{ background: "none", border: "none", color: "rgba(0,255,136,0.4)", fontSize: "10px", cursor: "pointer", fontFamily: "inherit" }}>Forgot?</button>
                        </div>
                        <input type="password" required placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
                    </div>
                    {error && <div style={{ padding: "10px", marginBottom: "1rem", background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", borderRadius: "4px", color: "#ff6666", fontSize: "13px", textAlign: "center" }}>{error}</div>}
                    <button type="submit" disabled={loading} className="gv-btn" style={{ width: "100%", padding: "14px", background: "rgba(0,255,136,0.12)", border: "1px solid #00ff88", borderRadius: "6px", color: "#00ff88", fontSize: "13px", letterSpacing: "3px", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: "10px" }}>
                        {loading ? "⏳ Processing..." : "⚡ Enter GaiaVolt"}
                    </button>
                    <button type="button" onClick={() => { setMode("signup"); setStep(1); setError("") }} style={{ width: "100%", padding: "10px", background: "transparent", border: "none", color: "rgba(0,255,136,0.4)", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
                        New here? Join the Mission 🌱
                    </button>
                </form>
            </div>

            {forgotMode && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                    <div style={{ width: "100%", maxWidth: "380px", background: "rgba(0,0,0,0.95)", border: "1px solid rgba(0,255,136,0.3)", borderRadius: "12px", padding: "28px" }}>
                        <h2 style={{ color: "#00ff88", fontSize: "18px", fontWeight: "700", marginBottom: "6px", fontFamily: "'Courier New',monospace" }}>Reset Password</h2>
                        <p style={{ color: "rgba(0,255,136,0.4)", fontSize: "12px", marginBottom: "20px", fontFamily: "'Courier New',monospace" }}>Supabase will send a real reset email.</p>
                        {!forgotSent ? (
                            <form onSubmit={handleForgotPassword}>
                                <input type="email" required placeholder="guardian@planet.earth" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} style={{ ...inputStyle, marginBottom: "12px" }} />
                                {error && <div style={{ color: "#ff6666", fontSize: "12px", marginBottom: "10px" }}>{error}</div>}
                                <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "rgba(0,255,136,0.1)", border: "1px solid #00ff88", borderRadius: "6px", color: "#00ff88", fontSize: "12px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", letterSpacing: "2px", marginBottom: "8px" }}>
                                    {loading ? "⏳ Sending..." : "⚡ Send Reset Email"}
                                </button>
                            </form>
                        ) : (
                            <div style={{ textAlign: "center", padding: "20px", color: "#22c55e", fontSize: "14px", fontFamily: "monospace" }}>✅ Reset email sent! Check your inbox.</div>
                        )}
                        <button onClick={() => { setForgotMode(false); setForgotSent(false); setError("") }} style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid rgba(0,255,136,0.15)", borderRadius: "6px", color: "rgba(0,255,136,0.4)", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}