'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

interface Action {
    id: number; city: string; country: string; lat: number; lon: number;
    type: string; co2: number; conf: number;
}

const ACTIONS: Action[] = [
    { id: 1,  city: 'Karachi',       country: 'Pakistan',     lat: 24.86,  lon: 67.00,   type: 'cycling',      co2: 0.8, conf: 97.2 },
    { id: 2,  city: 'Lahore',        country: 'Pakistan',     lat: 31.55,  lon: 74.34,   type: 'solar_panels', co2: 2.5, conf: 98.1 },
    { id: 3,  city: 'Islamabad',     country: 'Pakistan',     lat: 33.72,  lon: 73.06,   type: 'plantation',   co2: 5.0, conf: 99.1 },
    { id: 4,  city: 'Hyderabad',     country: 'Pakistan',     lat: 25.37,  lon: 68.35,   type: 'plantation',   co2: 5.0, conf: 99.9 },
    { id: 5,  city: 'Mumbai',        country: 'India',        lat: 19.08,  lon: 72.88,   type: 'cycling',      co2: 0.8, conf: 96.4 },
    { id: 6,  city: 'Delhi',         country: 'India',        lat: 28.61,  lon: 77.21,   type: 'solar_panels', co2: 2.5, conf: 94.8 },
    { id: 7,  city: 'London',        country: 'UK',           lat: 51.51,  lon: -0.13,   type: 'cycling',      co2: 0.8, conf: 95.6 },
    { id: 8,  city: 'Berlin',        country: 'Germany',      lat: 52.52,  lon: 13.40,   type: 'wind_energy',  co2: 3.2, conf: 98.0 },
    { id: 9,  city: 'Paris',         country: 'France',       lat: 48.86,  lon: 2.35,    type: 'cycling',      co2: 0.8, conf: 96.1 },
    { id: 10, city: 'New York',      country: 'USA',          lat: 40.71,  lon: -74.01,  type: 'solar_panels', co2: 2.5, conf: 95.8 },
    { id: 11, city: 'Tokyo',         country: 'Japan',        lat: 35.68,  lon: 139.69,  type: 'solar_panels', co2: 2.5, conf: 99.0 },
    { id: 12, city: 'Dubai',         country: 'UAE',          lat: 25.20,  lon: 55.27,   type: 'solar_panels', co2: 2.5, conf: 98.5 },
    { id: 13, city: 'São Paulo',     country: 'Brazil',       lat: -23.55, lon: -46.63,  type: 'plantation',   co2: 5.0, conf: 98.3 },
    { id: 14, city: 'Cairo',         country: 'Egypt',        lat: 30.04,  lon: 31.24,   type: 'solar_panels', co2: 2.5, conf: 96.7 },
    { id: 15, city: 'Singapore',     country: 'Singapore',    lat: 1.35,   lon: 103.82,  type: 'solar_panels', co2: 2.5, conf: 98.7 },
    { id: 16, city: 'Sydney',        country: 'Australia',    lat: -33.87, lon: 151.21,  type: 'solar_panels', co2: 2.5, conf: 98.4 },
    { id: 17, city: 'Stockholm',     country: 'Sweden',       lat: 59.33,  lon: 18.07,   type: 'wind_energy',  co2: 3.2, conf: 99.1 },
    { id: 18, city: 'Nairobi',       country: 'Kenya',        lat: -1.29,  lon: 36.82,   type: 'plantation',   co2: 5.0, conf: 97.8 },
    { id: 19, city: 'Jakarta',       country: 'Indonesia',    lat: -6.21,  lon: 106.85,  type: 'plantation',   co2: 5.0, conf: 96.9 },
    { id: 20, city: 'Toronto',       country: 'Canada',       lat: 43.65,  lon: -79.38,  type: 'wind_energy',  co2: 3.2, conf: 96.5 },
];

const ICONS: Record<string, string> = {
    solar_panels: '☀️', cycling: '🚴', utility_bills: '⚡',
    plantation: '🌱', wind_energy: '💨', electric_cars: '🔋',
    recycling: '♻️', led_lighting: '💡',
};

const MAX_LASERS = 50;
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const FRAME_MS  = isMobile ? 1000 / 30 : 1000 / 60;

function getApiBase(): string {
    if (typeof window === 'undefined') return 'http://127.0.0.1:8000';
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://127.0.0.1:8000';
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
    return 'https://sadafmashori-gaiavolt.hf.space';
}
const API_BASE = getApiBase();

async function fetchStats()        { try { const r = await fetch(`${API_BASE}/api/stats`,          {mode:'cors'}); return r.ok ? r.json() : null; } catch { return null; } }
async function fetchRecentActions(){ try { const r = await fetch(`${API_BASE}/api/recent-actions`, {mode:'cors'}); return r.ok ? r.json() : null; } catch { return null; } }
async function fetchGlobeData()    { try { const r = await fetch(`${API_BASE}/api/globe-data`,     {mode:'cors'}); return r.ok ? r.json() : null; } catch { return null; } }

const ATM_VERT = `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const ATM_FRAG = `varying vec3 vNormal; void main() { float i = pow(0.65 - dot(vNormal, vec3(0,0,1)), 3.0); gl_FragColor = vec4(0.0, 0.9, 1.0, 1.0) * i; }`;

function toVec3(lat: number, lon: number, r: number): THREE.Vector3 {
    const safeLat = (typeof lat === 'number' && isFinite(lat)) ? lat : 24.86;
    const safeLon = (typeof lon === 'number' && isFinite(lon)) ? lon : 67.00;
    const phi   = (90 - safeLat) * (Math.PI / 180);
    const theta = (safeLon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r  * Math.cos(phi),
        r  * Math.sin(phi) * Math.sin(theta)
    );
}

class LaserPool {
    mesh: THREE.InstancedMesh;
    ages: Float32Array;
    count = 0;
    constructor(scene: THREE.Scene) {
        const geo  = new THREE.CylinderGeometry(0.004, 0.004, 1, 4);
        const mat  = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 1.0 });
        this.mesh  = new THREE.InstancedMesh(geo, mat, MAX_LASERS);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.ages  = new Float32Array(MAX_LASERS).fill(0);
        const dummy = new THREE.Object3D();
        dummy.scale.set(0.001, 0.001, 0.001); dummy.updateMatrix();
        for (let i = 0; i < MAX_LASERS; i++) this.mesh.setMatrixAt(i, dummy.matrix);
        this.mesh.instanceMatrix.needsUpdate = true;
        scene.add(this.mesh);
    }
    add(lat: number, lon: number) {
        const safeLat = isFinite(lat) ? lat : 24.86;
        const safeLon = isFinite(lon) ? lon : 67.00;
        const i      = this.count % MAX_LASERS;
        const origin = toVec3(safeLat, safeLon, 1.02);
        const tip    = toVec3(safeLat, safeLon, 1.7);
        const len    = origin.distanceTo(tip);
        if (len < 1e-6) return;
        const dir    = tip.clone().sub(origin).normalize();
        if (!isFinite(dir.x) || !isFinite(dir.y) || !isFinite(dir.z)) return;
        const dummy  = new THREE.Object3D();
        dummy.position.copy(origin.clone().lerp(tip, 0.5));
        dummy.scale.set(1, len, 1);
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        dummy.updateMatrix();
        if (dummy.matrix.elements.some(v => !isFinite(v))) return;
        this.mesh.setMatrixAt(i, dummy.matrix);
        this.ages[i] = 1.0;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.count++;
    }
    tick() {
        let maxOp = 0;
        for (let i = 0; i < MAX_LASERS; i++) {
            if (this.ages[i] > 0) { this.ages[i] = Math.max(0, this.ages[i] - 0.012); if (this.ages[i] > maxOp) maxOp = this.ages[i]; }
        }
        (this.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, maxOp);
    }
    dispose(scene: THREE.Scene) { scene.remove(this.mesh); }
}

export default function GaiaVoltGlobe() {
    const mountRef  = useRef<HTMLDivElement>(null);
    const globeRef  = useRef<THREE.Mesh | null>(null);
    const atmRef    = useRef<THREE.Mesh | null>(null);
    const rendRef   = useRef<THREE.WebGLRenderer | null>(null);
    const frameRef  = useRef<number>(0);
    const poolRef   = useRef<LaserPool | null>(null);
    const lastRef   = useRef(0);
    const velRef    = useRef({ x: 0, y: 0.0008 });
    const dragRef   = useRef({ on: false, lx: 0, ly: 0 });
    const fpsRef    = useRef({ frames: 0, last: 0 });
    const lastIdRef = useRef(0);

    const [idx,          setIdx]          = useState(0);
    const [co2,          setCo2]          = useState(0);
    const [acts,         setActs]         = useState(0);
    const [fps,          setFps]          = useState(60);
    const [backendLive,  setBackendLive]  = useState(false);
    const [nasaTemp,     setNasaTemp]     = useState<string>('');
    const [ecoxLocked,   setEcoxLocked]   = useState('0.025');
    const [carbonRate,   setCarbonRate]   = useState<string>('');

    useEffect(() => {
        if (!mountRef.current) return;
        const W = mountRef.current.clientWidth  || window.innerWidth;
        const H = mountRef.current.clientHeight || window.innerHeight;
        const scene = new THREE.Scene();

        // Stars
        const sp = new Float32Array(6000);
        for (let i = 0; i < 6000; i++) sp[i] = (Math.random() - 0.5) * 500;
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
        scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 })));

        // Earth texture
        const loader   = new THREE.TextureLoader();
        const earthTex = loader.load('/earth.jpg');
        earthTex.magFilter = THREE.LinearFilter;
        earthTex.minFilter = THREE.LinearMipmapLinearFilter;
        earthTex.anisotropy = 4;

        // ✅ FIX 1: Earth — darker
        const globe = new THREE.Mesh(
            new THREE.SphereGeometry(1, isMobile ? 24 : 48, isMobile ? 24 : 48),
            new THREE.MeshPhongMaterial({
                map:       earthTex,
                specular:  new THREE.Color(0x111111),
                shininess: 8,
                color:     new THREE.Color(0x445566), // darker tint
            })
        );
        scene.add(globe);
        globeRef.current = globe;

        // Atmosphere
        const atm = new THREE.Mesh(
            new THREE.SphereGeometry(1.12, 24, 24),
            new THREE.ShaderMaterial({ vertexShader: ATM_VERT, fragmentShader: ATM_FRAG, blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false })
        );
        scene.add(atm);
        atmRef.current = atm;

        poolRef.current = new LaserPool(scene);

        // ✅ Natural lighting — not too bright, not too dark
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const sun = new THREE.DirectionalLight(0xfff0dd, 2.5);
        sun.position.set(5, 3, 5);
        scene.add(sun);
        const fill = new THREE.DirectionalLight(0x334466, 0.8);
        fill.position.set(-5, -2, -3);
        scene.add(fill);

        const cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
        cam.position.set(0, 0, 3.2); // earth medium size

        const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // ✅ FIX 3: capped at 1.5 for FPS
        renderer.setClearColor(0x020d18, 1);
        mountRef.current.appendChild(renderer.domElement);
        rendRef.current = renderer;

        const tick = (now: number) => {
            frameRef.current = requestAnimationFrame(tick);
            if (now - lastRef.current < FRAME_MS) return;
            lastRef.current = now;
            fpsRef.current.frames++;
            if (now - fpsRef.current.last > 1000) {
                setFps(fpsRef.current.frames);
                if (fpsRef.current.frames < 25) renderer.setPixelRatio(1);
                fpsRef.current = { frames: 0, last: now };
            }
            velRef.current.y *= 0.94;
            velRef.current.x *= 0.94;
            globe.rotation.y += velRef.current.y;
            globe.rotation.x += velRef.current.x;
            globe.rotation.x  = Math.max(-0.45, Math.min(0.45, globe.rotation.x));
            atm.rotation.copy(globe.rotation);
            poolRef.current?.tick();
            try { renderer.render(scene, cam); } catch {}
        };
        requestAnimationFrame(tick);

        const down = (e: MouseEvent | TouchEvent) => {
            const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
            dragRef.current = { on: true, lx: x, ly: y };
            velRef.current  = { x: 0, y: 0 };
        };
        const move = (e: MouseEvent | TouchEvent) => {
            if (!dragRef.current.on) return;
            const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
            velRef.current  = { x: (y - dragRef.current.ly) * 0.004, y: (x - dragRef.current.lx) * 0.004 };
            dragRef.current = { on: true, lx: x, ly: y };
        };
        const up = () => { dragRef.current.on = false; };
        const el = renderer.domElement;
        el.addEventListener('mousedown', down); el.addEventListener('mousemove', move); el.addEventListener('mouseup', up);
        el.addEventListener('touchstart', down, { passive: true }); el.addEventListener('touchmove', move, { passive: true }); el.addEventListener('touchend', up);
        const onResize = () => {
            if (!mountRef.current) return;
            const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;
            if (!w || !h) return;
            cam.aspect = w / h; cam.updateProjectionMatrix(); renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            cancelAnimationFrame(frameRef.current);
            poolRef.current?.dispose(scene);
            renderer.dispose();
            if (mountRef.current?.contains(renderer.domElement)) mountRef.current.removeChild(renderer.domElement);
        };
    }, []);

    useEffect(() => {
        const a = ACTIONS[idx];
        if (!a) return;
        poolRef.current?.add(a.lat, a.lon);
        setCo2(p  => parseFloat((p + a.co2).toFixed(2)));
        setActs(p => p + 1);
    }, [idx]);

    useEffect(() => {
        const t = setInterval(() => setIdx(i => (i + 1) % ACTIONS.length), 2500);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const poll = async () => {
            const stats = await fetchStats();
            if (stats) { setBackendLive(true); if (stats.total_actions > 0) { setCo2(stats.total_co2_kg); setActs(stats.total_actions); } }
            const recent = await fetchRecentActions();
            if (recent?.actions?.length > 0) {
                const latest = recent.actions[0];
                if (latest.id !== lastIdRef.current) {
                    lastIdRef.current = latest.id;
                    const lat = isFinite(latest.lat) ? latest.lat : 24.86;
                    const lon = isFinite(latest.lon) ? latest.lon : 67.00;
                    poolRef.current?.add(lat, lon);
                }
            }
            const globeData = await fetchGlobeData();
            if (globeData) {
                if (globeData.oracle?.temp_c    != null) setNasaTemp(`${globeData.oracle.temp_c}°C`);
                if (globeData.oracle?.carbon_rate != null) setCarbonRate(`$${globeData.oracle.carbon_rate}/t`);
                if (globeData.ecox_locked       != null) setEcoxLocked(globeData.ecox_locked.toFixed(4));
                if (globeData.total_co2         > 0)    setCo2(globeData.total_co2);
                if (globeData.total_actions     > 0)    setActs(globeData.total_actions);
            }
        };
        poll();
        const t = setInterval(poll, 30000);
        return () => clearInterval(t);
    }, []);

    const action = ACTIONS[idx];

    return (
        <div className="relative w-full h-screen overflow-hidden"
            style={{ background: '#020d18', fontFamily: "'Courier New', monospace" }}>

            {/* Three.js canvas */}
            <div ref={mountRef} className="absolute inset-0" />

            {/* FPS + Live indicator — top right */}
            <div className="absolute top-16 right-3 z-20 flex flex-col items-end gap-1">
                <div style={{ fontSize: 9, color: fps < 30 ? '#ff4444' : '#00ff8888', letterSpacing: 2 }}>{fps} FPS</div>
                <div style={{ fontSize: 9, color: backendLive ? '#00ff8888' : '#ff664488', letterSpacing: 2 }}>
                    {backendLive ? '● LIVE' : '○ OFFLINE'}
                </div>
            </div>

            {/* ── TOP BAR ─────────────────────────────────────────────────── */}
            <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} transition={{ duration:1 }}
                className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3"
                style={{ background: 'linear-gradient(to bottom, rgba(2,13,24,0.95), transparent)' }}>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00ff88' }} />
                    <span className="font-bold tracking-widest" style={{ color: '#00ff88', fontSize: isMobile ? '13px' : '17px' }}>
                        GAIA<span style={{ color: '#ffaa00' }}>VOLT</span>
                    </span>
                    {!isMobile && <span style={{ fontSize: 10, color: 'rgba(0,255,136,0.4)', letterSpacing: 3 }}>PROOF OF PLANET</span>}
                </div>
                <div className="flex gap-2 items-center" style={{ fontSize: 10, color: 'rgba(0,255,136,0.5)', letterSpacing: 1 }}>
                    <span style={{ color: '#00ff88' }}>POLYGON ✓</span>
                    {nasaTemp  && <><span>•</span><span style={{ color:'#00ccff' }}>🌡️ {nasaTemp} LIVE</span></>}
                    {carbonRate && <><span>•</span><span style={{ color:'#ffaa00' }}>💰 {carbonRate}</span></>}
                </div>
            </motion.div>

            {/* ── LEFT STATS ──────────────────────────────────────────────── */}
            {/* ── LEFT STATS — Desktop only ──────────────────────────────── */}
            {!isMobile && (
            <motion.div initial={{ opacity:0, x:-30 }} animate={{ opacity:1, x:0 }} transition={{ duration:1, delay:0.3 }}
                className="absolute left-3 z-10 flex flex-col gap-2"
                style={{ top: '35%', transform: 'translateY(-50%)' }}>
                {[
                    { label: 'CO₂ SAVED', value: `${co2.toFixed(1)} kg`, color: '#00ff88' },
                    { label: 'ACTIONS',   value: `${acts}`,               color: '#00ccff' },
                    { label: 'LIVE CITY', value: action.city,             color: '#ffaa00' },
                ].map(s => (
                    <div key={s.label} style={{ padding: '8px 12px', borderRadius: 10, backdropFilter: 'blur(8px)', border: `1px solid ${s.color}25`, background: 'rgba(2,13,24,0.8)', minWidth: 110 }}>
                        <div style={{ fontSize: 8, color: `${s.color}60`, letterSpacing: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </motion.div>
            )}

            {/* ── MOBILE STATS — Top horizontal bar ─────────────────────── */}
            {isMobile && (
            <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} transition={{ duration:1, delay:0.3 }}
                className="absolute left-0 right-0 z-10 flex justify-center gap-2 px-3"
                style={{ top: 70 }}>
                {[
                    { label: 'CO₂', value: `${co2.toFixed(1)}kg`, color: '#00ff88' },
                    { label: 'ACTS', value: `${acts}`,             color: '#00ccff' },
                    { label: 'CITY', value: action.city,           color: '#ffaa00' },
                ].map(s => (
                    <div key={s.label} style={{ padding: '6px 10px', borderRadius: 8, backdropFilter: 'blur(8px)', border: `1px solid ${s.color}25`, background: 'rgba(2,13,24,0.85)', textAlign:'center' }}>
                        <div style={{ fontSize: 7, color: `${s.color}60`, letterSpacing: 1 }}>{s.label}</div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </motion.div>
            )}

            {/* ── RIGHT ACTION CARD — Desktop only ────────────────────── */}
            {!isMobile && (
            <motion.div initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} transition={{ duration:1, delay:0.5 }}
                className="absolute right-3 z-10"
                style={{ top: '30%', transform: 'translateY(-50%)', width: 155 }}>
                <AnimatePresence mode="wait">
                    <motion.div key={action.id}
                        initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
                        style={{ borderRadius: 14, padding: '14px', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,255,136,0.2)', background: 'rgba(2,13,24,0.88)' }}>
                        <div style={{ fontSize: 8, color: 'rgba(0,255,136,0.5)', letterSpacing: 2, marginBottom: 6 }}>
                            {backendLive ? '🟢 LIVE' : 'ACTION'}
                        </div>
                        <div style={{ fontSize: isMobile ? 22 : 28, marginBottom: 4 }}>{ICONS[action.type] || '🌱'}</div>
                        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: '#00ff88' }}>{action.city}</div>
                        <div style={{ fontSize: 9,  color: 'rgba(0,255,136,0.5)', letterSpacing: 1 }}>{action.country}</div>
                        <div style={{ fontSize: 9,  color: 'rgba(0,255,136,0.4)', marginTop: 2 }}>{action.type.replace(/_/g,' ').toUpperCase()}</div>
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,255,136,0.1)', display: 'flex', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 7, color: 'rgba(0,255,136,0.4)' }}>CO₂</div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#00ff88' }}>{action.co2}kg</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 7, color: 'rgba(0,204,255,0.4)' }}>AI</div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#00ccff' }}>{action.conf}%</div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </motion.div>
            )}

            {/* ── MOBILE ACTION CARD — below globe, above buttons ────────── */}
            {isMobile && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
                className="absolute left-0 right-0 z-10 flex justify-center"
                style={{ bottom: 170 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', borderRadius:12, backdropFilter:'blur(10px)', border:'1px solid rgba(0,255,136,0.2)', background:'rgba(2,13,24,0.88)' }}>
                    <div style={{ fontSize:22 }}>{ICONS[action.type] || '🌱'}</div>
                    <div>
                        <div style={{ fontSize:13, fontWeight:800, color:'#00ff88' }}>{action.city}</div>
                        <div style={{ fontSize:9,  color:'rgba(0,255,136,0.5)' }}>{action.type.replace(/_/g,' ').toUpperCase()} · {action.co2}kg CO₂</div>
                    </div>
                    {backendLive && <div style={{ fontSize:8, color:'#00ff88' }}>🟢</div>}
                </div>
            </motion.div>
            )}
            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:1, delay:0.7 }}
                className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-4"
                style={{ background: 'linear-gradient(to top, rgba(2,13,24,0.95) 60%, transparent)' }}>

                {/* Quantum Lock ticker */}
                <div className="flex items-center justify-center gap-2 mb-3">
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 16px', borderRadius:20, border:'1px solid rgba(255,170,0,0.3)', background:'rgba(2,13,24,0.8)' }}>
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#ffaa00' }}/>
                        <span style={{ fontSize:9, color:'rgba(255,170,0,0.6)', letterSpacing:2 }}>QUANTUM-LOCK 2050</span>
                        <span style={{ fontSize:11, fontWeight:800, color:'#ffaa00' }}>{ecoxLocked} GAIAX LOCKED</span>
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#ffaa00' }}/>
                    </div>
                </div>

                {/* ✅ Smaller buttons — no overlap */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, maxWidth:380, margin:'0 auto' }}>
                    <a href="/evolution" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', borderRadius:12, background:'linear-gradient(135deg,#16a34a,#22c55e)', color:'#fff', fontWeight:700, fontSize:12, textDecoration:'none' }}>
                        🌱 My Journey
                    </a>
                    <a href="/verify" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px', borderRadius:12, background:'linear-gradient(135deg,#15803d,#22c55e)', color:'#fff', fontWeight:700, fontSize:12, textDecoration:'none' }}>
                        ⚡ Verify & Earn
                    </a>
                    <a href="/nfts" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:10, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.35)', color:'#f59e0b', fontWeight:600, fontSize:11, textDecoration:'none' }}>
                        🎨 Living NFTs
                    </a>
                    <a href="/vault" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', color:'#f59e0b', fontWeight:600, fontSize:11, textDecoration:'none' }}>
                        🏛️ Vault 2050
                    </a>
                </div>
            </motion.div>
        </div>
    );
}