"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

async function sha256(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("gv_token") || null;
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

const CLASS_META = {
  solar_panels: { icon: "☀️", label: "Solar Panel", color: "#f59e0b" },
  cycling: { icon: "🚲", label: "Cycling", color: "#22c55e" },
  utility_bills: { icon: "📄", label: "Utility Bill", color: "#60a5fa" },
  ev_charging: { icon: "⚡", label: "EV Charging", color: "#a78bfa" },
  recycling: { icon: "♻️", label: "Recycling", color: "#34d399" },
  tree_planting: { icon: "🌱", label: "Tree Planting", color: "#4ade80" },
  wind_turbine: { icon: "💨", label: "Wind Turbine", color: "#67e8f9" },
  public_transit: { icon: "🚌", label: "Public Transit", color: "#fb923c" },
  composting: { icon: "🌍", label: "Composting", color: "#a3e635" },
  led_lighting: { icon: "💡", label: "LED Lighting", color: "#fde047" },
  rainwater: { icon: "💧", label: "Rainwater Harvest", color: "#38bdf8" },
  insulation: { icon: "🏠", label: "Insulation", color: "#e879f9" },
  plantation: { icon: "🌱", label: "Plantation", color: "#4ade80" },
  other_eco: { icon: "🌿", label: "Eco Action", color: "#86efac" },
};

function ModuleRow({ icon, name, status }) {
  const color = { pass: "#22c55e", fail: "#ef4444", pending: "#374151" }[status];
  const label = { pass: "PASS ✓", fail: "FAIL ✗", pending: "· · ·" }[status];
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "9px 14px", borderRadius: 8, marginBottom: 5,
      background: "rgba(0,255,100,0.02)", border: "1px solid rgba(0,255,100,0.06)"
    }}>
      <span style={{ fontSize: 13, color: "#9ca3af" }}>{icon} {name}</span>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 2, color,
        fontFamily: "monospace", textShadow: status === "pass" ? `0 0 8px ${color}` : "none",
        transition: "color 0.4s"
      }}>{label}</span>
    </div>
  );
}

function ConfidenceRing({ value, color }) {
  const r = 34, c = 42, circ = 2 * Math.PI * r;
  return (
    <svg width={c * 2} height={c * 2} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#1a2a1a" strokeWidth={5} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${circ * (value / 100)} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease", filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
  );
}

// ── Impact Card Generator ─────────────────────────────────────────────────────
async function generateImpactCard(result, meta, level) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");

    // Background
    const bg = ctx.createLinearGradient(0, 0, 1080, 1080);
    bg.addColorStop(0, "#030b03");
    bg.addColorStop(0.5, "#0a1a0a");
    bg.addColorStop(1, "#001a0d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1080);

    // Grid
    ctx.strokeStyle = "rgba(0,255,100,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 1080; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1080); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1080, i); ctx.stroke();
    }

    // Glow
    const glow = ctx.createRadialGradient(540, 540, 0, 540, 540, 500);
    glow.addColorStop(0, "rgba(34,197,94,0.15)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1080);

    // Border
    ctx.strokeStyle = "rgba(34,197,94,0.4)";
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 1020, 1020);

    // Logo
    ctx.font = "bold 36px monospace";
    ctx.fillStyle = "rgba(34,197,94,0.6)";
    ctx.textAlign = "center";
    ctx.fillText("GAIAVOLT", 540, 120);
    ctx.font = "16px monospace";
    ctx.fillStyle = "rgba(34,197,94,0.35)";
    ctx.fillText("PROOF OF PLANET", 540, 155);

    // Icon
    ctx.font = "120px serif";
    ctx.fillText(meta.icon, 540, 330);

    // VERIFIED stamp
    ctx.save();
    ctx.translate(540, 420);
    ctx.rotate(-0.1);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 4;
    ctx.strokeRect(-130, -28, 260, 56);
    ctx.font = "bold 40px monospace";
    ctx.fillStyle = "#22c55e";
    ctx.shadowColor = "#22c55e";
    ctx.shadowBlur = 20;
    ctx.fillText("✓ VERIFIED", 0, 14);
    ctx.restore();
    ctx.shadowBlur = 0;

    // Class name
    ctx.font = "bold 52px monospace";
    ctx.fillStyle = meta.color;
    ctx.textAlign = "center";
    ctx.shadowColor = meta.color;
    ctx.shadowBlur = 15;
    ctx.fillText(meta.label.toUpperCase(), 540, 510);
    ctx.shadowBlur = 0;

    // Arctic message
    ctx.font = "26px serif";
    ctx.fillStyle = "#bae6fd";
    ctx.fillText(`"Cooled ${Number(result.arctic_mm2 || 1215730).toLocaleString()} mm² of Arctic"`, 540, 580);

    // Divider
    ctx.strokeStyle = "rgba(34,197,94,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(200, 620); ctx.lineTo(880, 620); ctx.stroke();

    // Stats
    const stats = [
      { label: "CO₂ OFFSET", value: `${result.carbon_kg} kg`, color: "#22c55e" },
      { label: "GAIA EARNED", value: `+${result.reward_coins}`, color: "#f59e0b" },
      { label: "CONFIDENCE", value: `${Math.round((result.confidence || 0) * 100)}%`, color: meta.color },
    ];
    stats.forEach((s, i) => {
      const x = 230 + i * 310;
      ctx.font = "bold 38px monospace";
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 10;
      ctx.fillText(s.value, x, 700);
      ctx.shadowBlur = 0;
      ctx.font = "14px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText(s.label, x, 728);
    });

    // Level
    if (level) {
      ctx.font = "24px serif";
      ctx.fillText(level.icon, 540, 810);
      ctx.font = "bold 20px monospace";
      ctx.fillStyle = level.color;
      ctx.fillText(level.name.toUpperCase(), 540, 840);
    }

    // CTA
    ctx.strokeStyle = "rgba(34,197,94,0.2)";
    ctx.beginPath(); ctx.moveTo(200, 870); ctx.lineTo(880, 870); ctx.stroke();
    ctx.font = "bold 24px monospace";
    ctx.fillStyle = "#22c55e";
    ctx.fillText("Join the Planet Protector Program", 540, 920);
    ctx.font = "18px monospace";
    ctx.fillStyle = "rgba(34,197,94,0.5)";
    ctx.fillText("gaia-volt.vercel.app", 540, 958);
    ctx.font = "13px monospace";
    ctx.fillStyle = "rgba(34,197,94,0.25)";
    ctx.fillText(new Date().toISOString().slice(0, 10), 540, 1000);

    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

// ── Particle Burst (coins exploding) ──────────────────────────────────────────
function CoinParticles({ active }) {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i / 12) * 360,
    distance: 60 + Math.random() * 40,
    delay: Math.random() * 0.3,
    emoji: ["🪙", "✨", "💫", "⭐"][i % 4]
  }));

  if (!active) return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{
            x: Math.cos(p.angle * Math.PI / 180) * p.distance,
            y: Math.sin(p.angle * Math.PI / 180) * p.distance,
            opacity: 0,
            scale: 1.5
          }}
          transition={{ duration: 0.8, delay: p.delay, ease: "easeOut" }}
          style={{ position: "absolute", fontSize: 16 }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
}

// ── Cinematic Scan Lines ───────────────────────────────────────────────────────
function ScanOverlay({ active, color }) {
  if (!active) return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", borderRadius: 12 }}>
      {/* Horizontal scan line */}
      <motion.div
        initial={{ top: "0%" }}
        animate={{ top: ["0%", "100%", "0%"] }}
        transition={{ duration: 1.5, repeat: 2, ease: "linear" }}
        style={{
          position: "absolute", left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          boxShadow: `0 0 12px ${color}`,
        }}
      />
      {/* Corner brackets */}
      {[["0%", "0%", "right", "bottom"], ["0%", "auto", "right", "top"], ["auto", "0%", "left", "bottom"], ["auto", "auto", "left", "top"]].map(([top, bottom, right, left], i) => (
        <div key={i} style={{
          position: "absolute", top, bottom, right, left,
          width: 20, height: 20,
          borderTop: i < 2 ? `2px solid ${color}` : "none",
          borderBottom: i >= 2 ? `2px solid ${color}` : "none",
          borderLeft: i % 2 === 1 ? `2px solid ${color}` : "none",
          borderRight: i % 2 === 0 ? `2px solid ${color}` : "none",
          margin: 8
        }} />
      ))}
      {/* Grid overlay */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 20px, ${color}11 20px, ${color}11 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, ${color}11 20px, ${color}11 21px)`
      }} />
    </div>
  );
}

// ── VERIFIED Stamp ─────────────────────────────────────────────────────────────
function VerifiedStamp({ active, color }) {
  if (!active) return null;
  return (
    <motion.div
      initial={{ scale: 3, opacity: 0, rotate: -15 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
      style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        pointerEvents: "none"
      }}
    >
      <div style={{
        padding: "10px 20px",
        border: `3px solid ${color}`,
        borderRadius: 8,
        background: `${color}22`,
        backdropFilter: "blur(4px)",
        transform: "rotate(-8deg)",
        boxShadow: `0 0 30px ${color}55, inset 0 0 20px ${color}11`
      }}>
        <div style={{
          fontSize: 22, fontWeight: 900, fontFamily: "monospace",
          color, letterSpacing: 4, textShadow: `0 0 20px ${color}`,
          textTransform: "uppercase"
        }}>
          ✓ VERIFIED
        </div>
        <div style={{ fontSize: 9, color: `${color}99`, letterSpacing: 3, textAlign: "center", marginTop: 2, fontFamily: "monospace" }}>
          PLANET SAVED
        </div>
      </div>
    </motion.div>
  );
}

// ── CINEMATIC ResultCard ───────────────────────────────────────────────────────
function ResultCard({ result }) {
  const [phase, setPhase] = useState("scanning");  // scanning → stamp → reveal
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    if (!result) return;
    if (result.verdict !== "VERIFIED") { setPhase("fraud"); return; }

    // Cinematic sequence
    const t1 = setTimeout(() => setPhase("stamp"), 1500);
    const t2 = setTimeout(() => {
      setPhase("reveal");
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 1200);
    }, 2500);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [result]);

  if (!result) return null;

  const ok = result.verdict === "VERIFIED";
  const meta = CLASS_META[result.class] || CLASS_META["other_eco"];
  const conf = Math.round((result.confidence || 0) * 100);
  const txHash = result?.tx_hash || null;

  if (!ok) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          marginTop: 24, padding: "28px", borderRadius: 18, textAlign: "center",
          border: "1px solid #ef444433", background: "rgba(239,68,68,0.05)"
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          transition={{ duration: 0.5, times: [0, 0.6, 1] }}
          style={{ fontSize: 50, marginBottom: 12 }}
        >🚨</motion.div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444", marginBottom: 8, letterSpacing: 2 }}>
          FRAUD DETECTED
        </div>
        <div style={{ fontSize: 13, color: "#fca5a5", fontFamily: "monospace" }}>
          {result.fraud_reason || "Validation failed."}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ marginTop: 24 }}
    >
      {/* ── Image with cinematic overlay ── */}
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", marginBottom: 18, background: "#0a160a", minHeight: 120 }}>
        <div style={{
          padding: "20px", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 60, filter: phase === "scanning" ? "brightness(0.6)" : "brightness(1)",
          transition: "filter 0.5s"
        }}>
          {meta.icon}
        </div>

        <ScanOverlay active={phase === "scanning"} color={meta.color} />
        <VerifiedStamp active={phase === "stamp" || phase === "reveal"} color={meta.color} />

        {/* Scanning text */}
        <AnimatePresence>
          {phase === "scanning" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute", bottom: 10, left: 0, right: 0,
                textAlign: "center", fontSize: 10, color: meta.color,
                fontFamily: "monospace", letterSpacing: 3
              }}
            >
              AI SCANNING · · ·
            </motion.div>
          )}
        </AnimatePresence>

        {/* Coin particles */}
        <CoinParticles active={showParticles} />
      </div>

      {/* ── Reveal content ── */}
      <AnimatePresence>
        {phase === "reveal" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Class + Confidence */}
            <div style={{
              display: "flex", alignItems: "center", gap: 14, marginBottom: 16,
              padding: "18px 20px", borderRadius: 14,
              background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.1)"
            }}>
              <div style={{ fontSize: 36 }}>{meta.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: "#4b5563", fontFamily: "monospace" }}>DETECTED</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: meta.color }}>{meta.label}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <ConfidenceRing value={conf} color={meta.color} />
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: -4, fontFamily: "monospace" }}>{conf}%</div>
              </div>
            </div>

            {/* Coin reward */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "20px", borderRadius: 14, marginBottom: 14,
                background: "linear-gradient(135deg,rgba(34,197,94,0.12),rgba(74,222,128,0.05))",
                border: "1px solid rgba(34,197,94,0.2)"
              }}
            >
              <span style={{ fontSize: 32 }}>🪙</span>
              <span style={{
                fontSize: 40, fontWeight: 900, color: "#22c55e",
                fontFamily: "monospace", textShadow: "0 0 30px #22c55e88"
              }}>
                +{result.reward_coins} GAIA
              </span>
            </motion.div>

            {/* CO2 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{
                display: "flex", justifyContent: "center", gap: 6,
                fontSize: 14, color: "#6ee7b7", marginBottom: 14
              }}
            >
              🌿 <strong style={{ color: "#a3e635" }}>{result.carbon_kg} kg</strong>&nbsp;CO₂ offset
            </motion.div>

            {/* Arctic message */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              style={{
                padding: "16px 18px", borderRadius: 12,
                background: "linear-gradient(135deg, rgba(0,100,150,0.15), rgba(0,50,100,0.1))",
                border: "1px solid rgba(100,200,255,0.15)",
                fontSize: 13, color: "#bae6fd", fontStyle: "italic",
                textAlign: "center", lineHeight: 1.6,
                borderLeft: "3px solid #38bdf8"
              }}
            >
              ❄️ "{result.planet_message || `Your action just cooled a 1mm patch of the Arctic.`}"
            </motion.div>

            {/* Blockchain proof */}
            {txHash && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                style={{
                  marginTop: 12, padding: "10px 14px",
                  background: "rgba(0,255,136,0.04)",
                  border: "1px solid rgba(0,255,136,0.15)",
                  borderRadius: 10
                }}
              >
                <div style={{ fontSize: 10, color: "rgba(0,255,136,0.4)", marginBottom: 4, letterSpacing: 2, fontFamily: "monospace" }}>
                  BLOCKCHAIN PROOF
                </div>
                <a
                  href={`https://amoy.polygonscan.com/tx/${txHash}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: "#00ff88", wordBreak: "break-all", textDecoration: "none" }}
                >
                  🔗 {txHash.slice(0, 20)}...{txHash.slice(-8)}
                </a>
              </motion.div>
            )}

            {/* Multi-Platform Share Menu */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              style={{ marginTop: 14 }}
            >
              {/* Download Card */}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={async () => {
                  const lv = getLevelForXP(0);
                  const url = await generateImpactCard(result, meta, lv);
                  const a = document.createElement("a");
                  a.href = url; a.download = `gaiavolt-${result.class}-${Date.now()}.png`; a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ width: "100%", padding: "13px", borderRadius: 12, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", color: "#22c55e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", marginBottom: 10 }}
              >
                📸 Download Impact Card
              </motion.button>

              {/* Share label */}
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#1f3a1f", fontFamily: "monospace", marginBottom: 8 }}>
                🌍 INSPIRE OTHERS — SHARE YOUR IMPACT
              </div>

              {/* Social buttons grid */}
              {(() => {
                const shareText = `🌍 I just verified a ${meta.label} action on GaiaVolt and earned ${result.reward_coins} GAIA coins!\n\nMy action cooled ${result.carbon_kg}kg of CO₂ ❄️\n\nJoin the Planet Protector Program 🌱\ngaia-volt.vercel.app\n\n#GaiaVolt #ProofOfPlanet #ClimateAction`;
                const shareUrl = "https://gaia-volt.vercel.app";
                const encodedText = encodeURIComponent(shareText);
                const encodedUrl = encodeURIComponent(shareUrl);

                const platforms = [
                  { name: "WhatsApp", emoji: "💬", color: "#25D366", bg: "rgba(37,211,102,0.1)", url: `https://wa.me/?text=${encodedText}` },
                  { name: "Twitter/X", emoji: "🐦", color: "#1DA1F2", bg: "rgba(29,161,242,0.1)", url: `https://twitter.com/intent/tweet?text=${encodedText}` },
                  { name: "LinkedIn", emoji: "💼", color: "#0077B5", bg: "rgba(0,119,181,0.1)", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&summary=${encodedText}` },
                  { name: "Facebook", emoji: "👥", color: "#1877F2", bg: "rgba(24,119,242,0.1)", url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}` },
                  { name: "Instagram", emoji: "📸", color: "#E1306C", bg: "rgba(225,48,108,0.1)", url: null, action: "copy" },
                  { name: "TikTok", emoji: "🎵", color: "#ff0050", bg: "rgba(255,0,80,0.1)", url: null, action: "copy" },
                  { name: "Snapchat", emoji: "👻", color: "#FFFC00", bg: "rgba(255,252,0,0.1)", url: `https://www.snapchat.com/share?url=${encodedUrl}` },
                  { name: "Reddit", emoji: "🤖", color: "#FF4500", bg: "rgba(255,69,0,0.1)", url: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent(`I just verified eco-action on GaiaVolt — Proof of Planet! 🌍`)}` },
                ];

                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {platforms.map((p) => (
                      <motion.button
                        key={p.name}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={async () => {
                          if (p.action === "copy" || !p.url) {
                            // Instagram/TikTok — copy text + open app
                            await navigator.clipboard.writeText(shareText).catch(() => { });
                            alert(`✅ Caption copied!\n\nNow open ${p.name} and paste it with your Impact Card photo.`);
                          } else {
                            window.open(p.url, "_blank");
                          }
                        }}
                        style={{
                          padding: "10px 8px", borderRadius: 10,
                          border: `1px solid ${p.color}33`,
                          background: p.bg, color: p.color,
                          fontSize: 12, fontWeight: 600,
                          cursor: "pointer", fontFamily: "monospace",
                          display: "flex", alignItems: "center",
                          justifyContent: "center", gap: 6
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{p.emoji}</span>
                        <span>{p.name}</span>
                      </motion.button>
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function VerifyPage() {
  const router = useRouter();
  const [mode, setMode] = useState("photo");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [modules, setModules] = useState({ spatial: "pending", liveness: "pending", ai: "pending", ocr: "pending", zk: "pending" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [gps, setGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("idle");
  const [recording, setRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const [challengeCode, setChallengeCode] = useState("")

  // Generate random 4-digit challenge code on mount
  useEffect(() => {
    const code = Math.floor(1000 + Math.random() * 9000).toString()
    setChallengeCode(code)
  }, [])
  const videoRef = useRef();
  const mediaRecRef = useRef();
  const streamRef = useRef();
  const timerRef = useRef();

  useEffect(() => {
    const token = localStorage.getItem("gv_token");
    if (!token) router.push("/auth");
  }, [router]);

  const reset = () => {
    setPhase("idle"); setResult(null); setError(null);
    setModules({ spatial: "pending", liveness: "pending", ai: "pending", ocr: "pending", zk: "pending" });
  };

  const gpsTrackRef = useRef([]);
  const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  };

  const getGPS = useCallback(() => {
    setGpsStatus("getting");
    if (!navigator.geolocation) { setGpsStatus("denied"); return; }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, speed } = pos.coords;
        const track = gpsTrackRef.current;
        let distance_m = 0;
        if (track.length > 0) {
          distance_m = track.reduce((acc, p, i) => {
            if (i === 0) return 0;
            return acc + haversine(track[i - 1].lat, track[i - 1].lon, p.lat, p.lon);
          }, 0);
        }
        track.push({ lat, lon });
        setGps({ lat, lon, speed_kmh: (speed || 0) * 3.6, distance_m });
        setGpsStatus("got");
      },
      () => setGpsStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => { getGPS(); }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecRef.current = rec;
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      };
      rec.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      setError("Camera access denied — allow camera permission.");
    }
  };

  const stopRecording = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const handleFile = useCallback((f) => {
    if (!f) return;
    reset(); setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(f);
  }, []);

  const animateModules = async (mods) => {
    for (const key of ["spatial", "liveness", "ai", "ocr", "zk"]) {
      await new Promise(r => setTimeout(r, 400));
      setModules(prev => ({ ...prev, [key]: mods[key] || "pass" }));
    }
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://sadafmashori-gaiavolt.hf.space";

  const runVerify = async () => {
    const uploadFile = mode === "video" ? videoBlob : file;
    if (!uploadFile || ["hashing", "uploading", "verifying"].includes(phase)) return;
    reset(); setError(null);
    try {
      setPhase("hashing");
      const hash = await sha256(uploadFile);
      setPhase("uploading");
      const selectedActivity = activityRef.current?.value || "plantation";
      const maxSize = mode === "video" ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
      if (uploadFile.size > maxSize) {
        setError(`File too large — max ${mode === "video" ? "20MB" : "10MB"}.`);
        setPhase("error"); return;
      }
      const fd = new FormData();
      if (mode === "video") {
        fd.append("video", uploadFile, "activity.webm");
        fd.append("activity", selectedActivity);
      } else {
        fd.append("image", uploadFile);
        fd.append("proof_type", selectedActivity);
      }
      fd.append("sha256", hash);
      fd.append("mode", mode);
      fd.append("challenge_code", challengeCode); // ✅ #2 Fable5: challenge code
      if (gps) {
        fd.append("lat", gps.lat.toString());
        fd.append("lon", gps.lon.toString());
        fd.append("speed_kmh", gps.speed_kmh.toString());
        fd.append("distance_m", gps.distance_m?.toString() || "0"); // ✅ #11 Fable5
      }
      const endpoint = mode === "video" ? "/verify-video" : "/upload-ecox";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST", body: fd,
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      setPhase("verifying");
      await animateModules(data.modules || {});
      if (data.verdict === "VERIFIED") {
        setResult({ verdict: "VERIFIED", ...data });
        setPhase("done");
      } else {
        setResult({ verdict: "FRAUD", fraud_reason: data.fraud_reason || data.error || "Validation failed." });
        setPhase("fraud");
      }
    } catch {
      setError("Cannot connect to API. Please try again.");
      setPhase("error");
    }
  };

  const busy = ["hashing", "uploading", "verifying"].includes(phase);
  const canVerify = mode === "video" ? (videoBlob && !busy) : (file && !busy);
  const phaseText = { idle: "Ready", hashing: "Fingerprinting…", uploading: "Sending to AI…", verifying: "Verifying…", done: "Done ✓", fraud: "Fraud", error: "Error" }[phase];
  const gpsColor = { idle: "#374151", getting: "#f59e0b", got: "#22c55e", denied: "#ef4444" }[gpsStatus];
  const gpsText = { idle: "Getting GPS…", getting: "Getting GPS…", got: `GPS ✓ ${gps?.lat?.toFixed(3)},${gps?.lon?.toFixed(3)}`, denied: "GPS denied" }[gpsStatus];

  return (
    <div style={{
      minHeight: "100vh", background: "#030b03",
      backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,80,20,0.35) 0%, transparent 70%)",
      fontFamily: "'Syne','Space Grotesk',sans-serif", color: "#f0fdf4", padding: "48px 20px 80px"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .drop-zone:hover{border-color:#22c55e66!important;}
        .vbtn:hover:not(:disabled){background:linear-gradient(135deg,#15803d,#16a34a)!important;transform:translateY(-1px);}
        .mode-btn.active{border-color:#22c55e!important;color:#22c55e!important;background:rgba(34,197,94,0.1)!important;}
      `}</style>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#22c55e66", textTransform: "uppercase", marginBottom: 8, fontFamily: "monospace" }}>
            GaiaVolt · Proof of Planet · Day 24
          </div>
          <h1 style={{
            margin: 0, fontSize: "clamp(26px,6vw,40px)", fontWeight: 800,
            background: "linear-gradient(135deg,#86efac,#22c55e,#4ade80)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
          }}>Upload & Verify</h1>
          <div style={{
            marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 14px", borderRadius: 20, background: "rgba(0,0,0,0.3)",
            border: `1px solid ${gpsColor}44`, fontSize: 11, color: gpsColor, fontFamily: "monospace"
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: gpsColor, animation: gpsStatus === "getting" ? "pulse 1s infinite" : "none", display: "inline-block" }} />
            {gpsText}
            {gpsStatus === "denied" && (
              <button onClick={getGPS} style={{ marginLeft: 6, color: "#f59e0b", background: "none", border: "none", cursor: "pointer", fontSize: 10 }}>Retry</button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[{ id: "photo", icon: "📸", label: "Photo Proof" }, { id: "video", icon: "🎥", label: "Video Proof" }].map(m => (
            <button key={m.id} className={`mode-btn${mode === m.id ? " active" : ""}`}
              onClick={() => { setMode(m.id); reset(); setFile(null); setPreview(null); setVideoBlob(null); setVideoUrl(null); }}
              style={{ flex: 1, padding: "12px", borderRadius: 12, cursor: "pointer", border: "1px solid #1a2e1a", background: "rgba(255,255,255,0.02)", color: "#6b7280", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>
              {m.icon}<br /><span style={{ fontSize: 11 }}>{m.label}</span>
            </button>
          ))}
        </div>

        {/* ✅ #2 Fable5: Random Challenge Code */}
        {challengeCode && (
          <div style={{
            marginBottom: 14, padding: "14px 18px", borderRadius: 12,
            background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.3)"
          }}>
            <div style={{ fontSize: 10, color: "rgba(255,170,0,0.6)", letterSpacing: 3, fontFamily: "monospace", marginBottom: 6 }}>
              ✍️ WRITE THIS CODE ON PAPER — HOLD IN PHOTO
            </div>
            <div style={{
              fontSize: 36, fontWeight: 900, color: "#f59e0b",
              fontFamily: "monospace", letterSpacing: 8,
              textShadow: "0 0 20px #f59e0b55"
            }}>
              {challengeCode}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,170,0,0.4)", marginTop: 4, fontFamily: "monospace" }}>
              Code must be visible in your photo — refreshes every session
            </div>
            <button
              onClick={() => setChallengeCode(Math.floor(1000 + Math.random() * 9000).toString())}
              style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(255,170,0,0.3)", background: "transparent", color: "rgba(255,170,0,0.6)", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}
            >
              🔄 New Code
            </button>
          </div>
        )}

        {mode === "photo" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#4b5563", fontFamily: "monospace", marginBottom: 6 }}>SELECT ACTIVITY:</div>
              <select ref={activityRef} onChange={(e) => {
                const COMING_SOON = ["coming_soon_ocean", "coming_soon_transit", "coming_soon_water", "coming_soon_farming", "coming_soon_bills", "coming_soon_wind"];
                if (COMING_SOON.includes(e.target.value)) {
                  const labels = { coming_soon_ocean: "🌊 Ocean Cleanup", coming_soon_wind: "💨 Wind Energy", coming_soon_transit: "🚌 Public Transport", coming_soon_water: "💧 Water Conservation", coming_soon_farming: "🌾 Organic Farming", coming_soon_bills: "📄 Utility Bills" };
                  alert(`${labels[e.target.value] || "This feature"} coming soon! 🌱`);
                  e.target.value = "plantation";
                }
              }} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,0.5)", border: "1px solid #22c55e33", color: "#e2e8f0", fontSize: 13, outline: "none", cursor: "pointer" }}>
                <option value="plantation">🌱 Plantation ✅</option>
                <option value="recycling">♻️ Recycling ✅</option>
                <option value="led_lighting">💡 LED Lighting ✅</option>
                <option value="cycling">🚲 Cycling ✅</option>
                <option value="solar_panels">☀️ Solar Panels ✅</option>
                <option value="electric_cars">⚡ Electric Cars ✅</option>
                <option value="coming_soon_ocean">🌊 Ocean Cleanup — Coming Soon</option>
                <option value="coming_soon_wind">💨 Wind Energy — Coming Soon</option>
                <option value="coming_soon_transit">🚌 Public Transport — Coming Soon</option>
                <option value="coming_soon_water">💧 Water Conservation — Coming Soon</option>
                <option value="coming_soon_farming">🌾 Organic Farming — Coming Soon</option>
                <option value="coming_soon_bills">📄 Utility Bills — Coming Soon</option>
              </select>

              {/* ✅ #9 Fable5: Live capture instructions per activity */}
              {activityRef.current?.value === "plantation" && (
                <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", fontSize: 11, color: "rgba(34,197,94,0.7)", fontFamily: "monospace" }}>
                  📋 Plantation proof: Hold challenge code + show seedling + touch soil in photo
                </div>
              )}
              {activityRef.current?.value === "solar_panels" && (
                <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", fontSize: 11, color: "rgba(245,158,11,0.7)", fontFamily: "monospace" }}>
                  ☀️ Solar proof: Show panels + surrounding roof/landmark in one continuous shot
                </div>
              )}
              {activityRef.current?.value === "cycling" && (
                <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", fontSize: 11, color: "rgba(34,197,94,0.7)", fontFamily: "monospace" }}>
                  🚲 Cycling proof: GPS tracking active — ride minimum 500m before uploading
                </div>
              )}
            </div>
            <div className="drop-zone" onClick={() => inputRef.current?.click()} style={{ position: "relative", borderRadius: 16, cursor: "pointer", overflow: "hidden", border: "1.5px dashed #1a2e1a", background: "rgba(0,255,100,0.015)", minHeight: preview ? 0 : 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {preview ? (
                <img src={preview} alt="preview" style={{ width: "100%", display: "block", borderRadius: 15, maxHeight: 300, objectFit: "cover" }} />
              ) : (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <div style={{ fontSize: 42, marginBottom: 10 }}>📸</div>
                  <div style={{ fontSize: 13, color: "#4b5563" }}>Tap to upload photo</div>
                  <div style={{ fontSize: 11, marginTop: 6, color: "#1f2937", fontFamily: "monospace" }}>Must be fresh — GPS required</div>
                </div>
              )}
              <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            </div>
          </>
        )}

        {mode === "video" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#4b5563", fontFamily: "monospace", marginBottom: 6 }}>SELECT ACTIVITY:</div>
              <select ref={activityRef} onChange={(e) => {
                const COMING_SOON = ["coming_soon_ocean", "coming_soon_transit", "coming_soon_water", "coming_soon_farming", "coming_soon_bills", "coming_soon_wind"];
                if (COMING_SOON.includes(e.target.value)) {
                  alert("Coming soon! 🌱");
                  e.target.value = "plantation";
                }
              }} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,0.5)", border: "1px solid #22c55e33", color: "#e2e8f0", fontSize: 13, outline: "none", cursor: "pointer" }}>
                <option value="plantation">🌱 Plantation ✅</option>
                <option value="recycling">♻️ Recycling ✅</option>
                <option value="led_lighting">💡 LED Lighting ✅</option>
                <option value="cycling">🚲 Cycling ✅</option>
                <option value="solar_panels">☀️ Solar Panels ✅</option>
                <option value="electric_cars">⚡ Electric Cars ✅</option>
                <option value="coming_soon_ocean">🌊 Ocean Cleanup — Coming Soon</option>
                <option value="coming_soon_wind">💨 Wind Energy — Coming Soon</option>
                <option value="coming_soon_transit">🚌 Public Transport — Coming Soon</option>
                <option value="coming_soon_water">💧 Water Conservation — Coming Soon</option>
                <option value="coming_soon_farming">🌾 Organic Farming — Coming Soon</option>
                <option value="coming_soon_bills">📄 Utility Bills — Coming Soon</option>
              </select>
            </div>
            <div style={{ borderRadius: 16, overflow: "hidden", background: "#000", border: "1.5px solid #1a2e1a" }}>
              {!videoUrl ? (
                <>
                  <video ref={videoRef} style={{ width: "100%", maxHeight: 280, display: "block", background: "#000" }} muted playsInline />
                  <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {recording ? (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#ef4444", fontFamily: "monospace" }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite", display: "inline-block" }} />
                          REC {recordSeconds}s
                        </div>
                        <button onClick={stopRecording} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>⏹ Stop</button>
                      </>
                    ) : (
                      <button onClick={startRecording} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#16a34a,#22c55e)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>🎥 Start Recording</button>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ padding: 16 }}>
                  <video src={videoUrl} controls style={{ width: "100%", borderRadius: 10, maxHeight: 280 }} />
                  <button onClick={() => { setVideoBlob(null); setVideoUrl(null); reset(); }} style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 10, border: "1px solid #1a2e1a", background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 12 }}>↺ Record again</button>
                </div>
              )}
            </div>
          </>
        )}

        {(file || videoBlob) && (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#374151", fontFamily: "monospace", padding: "0 4px" }}>
            <span style={{ color: "#22c55e66" }}>▸ {mode === "video" ? `video_${recordSeconds}s.webm` : file?.name}</span>
            <span>{mode === "video" ? `${recordSeconds}s` : `${((file?.size || 0) / 1024).toFixed(1)} KB`}</span>
          </div>
        )}

        {(file || videoBlob) && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#1f3a1f", textTransform: "uppercase", marginBottom: 10, fontFamily: "monospace" }}>▸ Consensus Engine — All must pass</div>
            <ModuleRow icon="🛰️" name="Spatial Metadata (GPS + Timestamp)" status={modules.spatial} />
            <ModuleRow icon="👁️" name="Liveness 2.0 (Blur / Moiré)" status={modules.liveness} />
            <ModuleRow icon="🧠" name="AI Vision — ecox_model_edge.tflite" status={modules.ai} />
            <ModuleRow icon="📝" name="Activity Proof (Video/OCR)" status={modules.ocr} />
            <ModuleRow icon="🔐" name="ZK-Proof (Off-chain)" status={modules.zk} />
          </div>
        )}

        {error && (
          <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid #ef444433", fontSize: 12, color: "#fca5a5", fontFamily: "monospace" }}>
            ⚠️ {error}
          </div>
        )}

        <motion.button
          whileHover={{ scale: canVerify ? 1.02 : 1 }}
          whileTap={{ scale: canVerify ? 0.98 : 1 }}
          className="vbtn"
          disabled={!canVerify}
          onClick={runVerify}
          style={{ width: "100%", marginTop: 20, padding: "17px 0", borderRadius: 14, border: "none", cursor: canVerify ? "pointer" : "not-allowed", background: canVerify ? "linear-gradient(135deg,#16a34a,#22c55e)" : "rgba(255,255,255,0.04)", color: canVerify ? "#fff" : "#1f2937", fontSize: 15, fontWeight: 800, letterSpacing: 0.8, transition: "all 0.2s" }}
        >
          {busy ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
              {phaseText}
            </span>
          ) : "⚡ ⚡ Verify & Earn GaiaVolt"}
        </motion.button>

        <AnimatePresence>{result && <ResultCard result={result} />}</AnimatePresence>

        {result && (
          <button onClick={() => { setFile(null); setPreview(null); setVideoBlob(null); setVideoUrl(null); reset(); }} style={{ width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 12, border: "1px solid #1a2e1a", background: "transparent", color: "#374151", fontSize: 13, cursor: "pointer" }}>↺ Upload another proof</button>
        )}

        <div style={{ marginTop: 36, textAlign: "center", fontSize: 10, color: "#1a2e1a", fontFamily: "monospace", letterSpacing: 2 }}>
          GPS · VIDEO PROOF · AI · ZK-SNARKS · POLYGON
        </div>
      </div>
    </div>
  );
}a