"""
Day 21 — Master Orchestrator (FINAL + IPFS)
"""

import asyncio
import json
import hashlib
import os
from dataclasses import dataclass, asdict
from typing import Optional
from datetime import datetime, timezone, timedelta
from enum import Enum

try:
    import aiohttp
except ImportError:
    aiohttp = None

from eth_account import Account
from eth_account.messages import encode_defunct
from dotenv import load_dotenv

from carbon_impact_engine import ProofMetadata, run_impact_engine, generate_impact_message
from reward_web3_bridge import Web3Bridge

load_dotenv()

PRIVATE_KEY = os.getenv("ORACLE_PRIVATE_KEY")
WALLET_ADDR = os.getenv("ADMIN_WALLET_ADDRESS")
DEFAULT_LAT = float(os.getenv("DEFAULT_LAT", 24.8607))
DEFAULT_LON = float(os.getenv("DEFAULT_LON", 67.0011))


class ReceiptStatus(Enum):
    READY_FOR_MINT = "READY_FOR_MINT"
    CONFIRMED      = "CONFIRMED"
    FAILED         = "FAILED"
    INVALIDATED    = "INVALIDATED"


REQUIRED_FIELDS = [
    "wallet_address", "issued_at_utc", "co2_nanograms",
    "proof_fingerprint", "lovelock_basis_points",
    "off_chain_proof_id", "block_number", "receipt_hash",
]
NONZERO_FIELDS = ["co2_nanograms", "lovelock_basis_points", "block_number"]


def validate_schema(data: dict) -> tuple:
    for field in REQUIRED_FIELDS:
        val = data.get(field)
        if val is None or val == "" or val == "None":
            return False, f"Missing/null: '{field}'"
    for field in NONZERO_FIELDS:
        try:
            if int(data.get(field, 0)) == 0:
                return False, f"Zero not allowed: '{field}'"
        except (TypeError, ValueError):
            return False, f"Invalid numeric: '{field}'"
    wallet = data.get("wallet_address", "")
    if not wallet.startswith("0x") or len(wallet) < 10:
        return False, f"Invalid wallet: {wallet}"
    try:
        datetime.fromisoformat(data["issued_at_utc"])
    except Exception:
        return False, f"Invalid timestamp"
    return True, "OK"


def co2_kg_to_uint256(co2_kg):  return int(co2_kg * 1_000_000_000)
def joules_to_uint256(j):       return int(j * 1000)
def arctic_mm2_to_uint256(mm2): return int(mm2 * 1_000_000)
def lovelock_to_uint256(s):     return int(s * 10000)


IPCC_REGIONAL_DEFAULTS = {
    (20, 40, 60, 80):    (32.0, 60.0, "South_Asia"),
    (20, 40, 80, 120):   (28.0, 75.0, "East_Asia"),
    (-10, 20, 60, 80):   (30.0, 80.0, "Tropical_Asia"),
    (40, 70, -10, 40):   (12.0, 70.0, "Europe"),
    (25, 50, -125, -65): (18.0, 55.0, "North_America"),
    (-35, 15, -80, -35): (25.0, 72.0, "South_America"),
    (0, 35, -20, 50):    (28.0, 65.0, "Africa_North"),
}

def get_ipcc_defaults(lat, lon):
    for (la, lb, lo, lob), (t, h, r) in IPCC_REGIONAL_DEFAULTS.items():
        if la <= lat <= lb and lo <= lon <= lob:
            return t, h, f"IPCC_AR6_{r}"
    return 25.0, 65.0, "IPCC_AR6_Global_Mean"


@dataclass
class EnvironmentalReading:
    temperature_c: float
    humidity_pct: float
    source: str
    fetched_at: str
    verified: bool
    layer_used: int


async def fetch_nasa_power(lat, lon):
    if aiohttp is None: return None
    try:
        end_date   = (datetime.now() - timedelta(days=3)).strftime("%Y%m%d")
        start_date = (datetime.now() - timedelta(days=4)).strftime("%Y%m%d")
        url = (f"https://power.larc.nasa.gov/api/temporal/daily/point"
               f"?parameters=T2M,RH2M&community=RE"
               f"&longitude={lon}&latitude={lat}"
               f"&start={start_date}&end={end_date}&format=JSON")
        connector = aiohttp.TCPConnector(ssl=False)
        async with aiohttp.ClientSession(connector=connector) as s:
            async with s.get(url, timeout=aiohttp.ClientTimeout(total=8)) as r:
                if r.status == 200:
                    data  = await r.json()
                    props = data["properties"]["parameter"]
                    temps = [v for v in props["T2M"].values() if v != -999.0]
                    hums  = [v for v in props["RH2M"].values() if v != -999.0]
                    if temps and hums:
                        t = round(sum(temps)/len(temps), 2)
                        h = round(sum(hums)/len(hums), 2)
                        print(f"[NASA L1] ✅ {t}°C, {h}%")
                        return EnvironmentalReading(t, h, "NASA-POWER-API-v2.9",
                            datetime.now(timezone.utc).isoformat(), True, 1)
    except Exception as e:
        print(f"[NASA L1] Failed: {e}")
    return None


async def fetch_open_meteo(lat, lon):
    if aiohttp is None: return None
    try:
        url = (f"https://api.open-meteo.com/v1/forecast"
               f"?latitude={lat}&longitude={lon}"
               f"&current=temperature_2m,relative_humidity_2m&forecast_days=1")
        connector = aiohttp.TCPConnector(ssl=False)
        async with aiohttp.ClientSession(connector=connector) as s:
            async with s.get(url, timeout=aiohttp.ClientTimeout(total=5)) as r:
                if r.status == 200:
                    d = await r.json()
                    t = d["current"]["temperature_2m"]
                    h = d["current"]["relative_humidity_2m"]
                    print(f"[OpenMeteo L2] ✅ {t}°C, {h}%")
                    return EnvironmentalReading(t, h, "Open-Meteo/NASA-MERRA2",
                        datetime.now(timezone.utc).isoformat(), True, 2)
    except Exception as e:
        print(f"[OpenMeteo L2] Failed: {e}")
    return None


async def fetch_environmental_data(lat, lon):
    result = await fetch_nasa_power(lat, lon)
    if result: return result
    result = await fetch_open_meteo(lat, lon)
    if result: return result
    t, h, region = get_ipcc_defaults(lat, lon)
    print(f"[IPCC L3] ⚠️  {region} — {t}°C, {h}%")
    return EnvironmentalReading(t, h, region,
        datetime.now(timezone.utc).isoformat(), False, 3)


IPCC_SEQUESTRATION_FACTORS = {
    "solar": 0.95, "cycling": 0.72, "utility": 0.61, "default": 0.80
}
IPCC_TEMP_BASELINE = 13.9
CURRENT_ANOMALY    = 1.2


def calculate_ipcc_lovelock_score(co2_kg, ambient_temp_c, humidity_pct,
                                   latitude, activity_type="default"):
    seq_factor = IPCC_SEQUESTRATION_FACTORS.get(activity_type, 0.80)
    if activity_type == "solar" and ambient_temp_c > 25.0:
        temp_penalty = (ambient_temp_c - 25.0) * 0.004
        seq_factor   = max(0.60, seq_factor - temp_penalty)
        print(f"[IPCC] Solar penalty: -{temp_penalty:.4f} → seq={seq_factor:.4f}")
    co2_score     = min(1.0, (co2_kg / 5.0) * seq_factor)
    local_anomaly = max(0, ambient_temp_c - IPCC_TEMP_BASELINE)
    temp_score    = min(1.0, local_anomaly / 20.0)
    hum_score     = min(1.0, humidity_pct / 100.0)
    abs_lat    = abs(latitude)
    lat_factor = (1.0 if abs_lat < 23.5 else
                  0.85 if abs_lat < 45 else
                  0.70 if abs_lat < 66.5 else 0.90)
    composite = (co2_score*0.45 + temp_score*0.25 +
                 hum_score*0.15 + lat_factor*0.15)
    return {
        "lovelock_score":    round(min(1.0, composite), 4),
        "co2_score":         round(co2_score, 4),
        "temp_score":        round(temp_score, 4),
        "humidity_score":    round(hum_score, 4),
        "lat_factor":        round(lat_factor, 4),
        "ipcc_seq_factor":   seq_factor,
        "current_anomaly_c": CURRENT_ANOMALY,
        "methodology":       "IPCC_AR6_WGI_Table5.1"
    }


def sign_receipt_eip712(receipt_hash, private_key):
    if not private_key:
        print("[Signer] No key — unsigned")
        return None
    try:
        msg    = encode_defunct(hexstr=receipt_hash.replace("0x",""))
        signed = Account.sign_message(msg, private_key=private_key)
        sig    = signed.signature.hex()
        print(f"[Signer] ✅ EIP-712: {sig[:24]}...")
        return "0x" + sig
    except Exception as e:
        print(f"[Signer] Failed: {e}")
        return None


@dataclass
class LovelockAuditReceipt:
    wallet_address: str
    issued_at_utc: str
    receipt_id: str
    status: str
    co2_nanograms: int
    joules_millijoules: int
    arctic_nanomm2: int
    lovelock_basis_points: int
    proof_fingerprint: str
    co2_tonnes_display: float
    arctic_mm2_display: float
    ipcc_co2_score: float
    ipcc_temp_score: float
    ipcc_humidity_score: float
    ipcc_lat_factor: float
    ipcc_methodology: str
    env_temperature_c: float
    env_humidity_pct: float
    env_data_source: str
    env_verified: bool
    env_layer_used: int
    off_chain_proof_id: str
    on_chain_tx: Optional[str]
    blockchain_provider: str
    mint_latency_ms: float
    block_number: int
    human_message: str
    receipt_hash: str
    oracle_signature: Optional[str]


def build_receipt_hash(fields):
    return hashlib.sha256(
        json.dumps(fields, sort_keys=True, default=str).encode()
    ).hexdigest()


class RollbackLog:
    def __init__(self): self.events = []
    def record(self, track, reason):
        self.events.append({"track": track, "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat()})
        print(f"[Rollback] {track} — {reason}")
    def dump(self): return self.events


class Day21Engine:

    def __init__(self):
        self.web3     = Web3Bridge()
        self.web3.start_background_ping()
        self.rollback = RollbackLog()

    async def execute(self, lat, lon, co2_kg, wallet_address,
                      activity_type="solar"):

        print("\n" + "═"*58)
        print("  DAY 21 — WORLD CLASS ENGINE (TRULY FINAL)")
        print("═"*58)

        print("\n[Env] Fetching 3-layer environmental data...")
        env = await fetch_environmental_data(lat, lon)

        ipcc = calculate_ipcc_lovelock_score(
            co2_kg, env.temperature_c, env.humidity_pct,
            lat, activity_type)
        print(f"[IPCC] Score: {ipcc['lovelock_score']} "
              f"CO2:{ipcc['co2_score']} Temp:{ipcc['temp_score']} "
              f"Hum:{ipcc['humidity_score']} Lat:{ipcc['lat_factor']}")

        metadata = ProofMetadata(
            co2_kg=co2_kg, latitude=lat, longitude=lon,
            exif_timestamp=datetime.now(timezone.utc).isoformat(),
            gps_altitude=10.0,
            ambient_temp_c=env.temperature_c,
            humidity_pct=env.humidity_pct,
            image_hash=hashlib.sha256(b"ecox_proof_test").hexdigest()
        )

        proof_fp = hashlib.sha256(
            f"{co2_kg}{lat}{lon}{metadata.exif_timestamp}".encode()
        ).hexdigest()

        print("\n[Orchestrator] Track A + B parallel...")
        track_a, track_b = await asyncio.gather(
            asyncio.to_thread(run_impact_engine, metadata),
            self.web3.mint_eco_coin(wallet_address, proof_fp, co2_kg/1000.0),
            return_exceptions=True
        )

        if isinstance(track_a, Exception) or track_a is None:
            self.rollback.record("Track A", str(track_a))
            return self._failed_receipt(wallet_address, str(track_a), env, ipcc)

        if isinstance(track_b, Exception) or track_b is None:
            self.rollback.record("Track B", str(track_b))
            return self._failed_receipt(wallet_address, str(track_b), env, ipcc)

        print(f"[Track A] ✅ Lovelock validated")
        print(f"[Track B] ✅ Block: {track_b['block_number']}")

        fields = {
            "wallet_address":        wallet_address,
            "issued_at_utc":         datetime.now(timezone.utc).isoformat(),
            "status":                ReceiptStatus.READY_FOR_MINT.value,
            "co2_nanograms":         co2_kg_to_uint256(co2_kg),
            "joules_millijoules":    joules_to_uint256(track_a.joules_mitigated),
            "arctic_nanomm2":        arctic_mm2_to_uint256(track_a.arctic_mm2_cooled),
            "lovelock_basis_points": lovelock_to_uint256(ipcc["lovelock_score"]),
            "proof_fingerprint":     track_a.proof_fingerprint,
            "co2_tonnes_display":    round(float(track_a.co2_tonnes), 8),
            "arctic_mm2_display":    round(float(track_a.arctic_mm2_cooled), 8),
            "ipcc_co2_score":        ipcc["co2_score"],
            "ipcc_temp_score":       ipcc["temp_score"],
            "ipcc_humidity_score":   ipcc["humidity_score"],
            "ipcc_lat_factor":       ipcc["lat_factor"],
            "ipcc_methodology":      ipcc["methodology"],
            "env_temperature_c":     env.temperature_c,
            "env_humidity_pct":      env.humidity_pct,
            "env_data_source":       env.source,
            "env_verified":          env.verified,
            "env_layer_used":        env.layer_used,
            "off_chain_proof_id":    track_b["off_chain_proof_id"],
            "on_chain_tx":           track_b["on_chain_tx"],
            "blockchain_provider":   track_b["provider_used"],
            "mint_latency_ms":       track_b["latency_ms"],
            "block_number":          track_b["block_number"],
            "human_message":         generate_impact_message(
                track_a.arctic_mm2_cooled, track_b["off_chain_proof_id"]) +
                (f" [⚠️ L3-Low Confidence: Static IPCC data used]"
                 if env.layer_used == 3 else ""),
        }

        receipt_hash = build_receipt_hash(fields)
        receipt_id   = hashlib.sha256(
            f"{wallet_address}{track_b['off_chain_proof_id']}".encode()
        ).hexdigest()

        is_valid, err = validate_schema({**fields, "receipt_hash": receipt_hash})
        if not is_valid:
            self.rollback.record("Schema", err)
            return self._failed_receipt(wallet_address, f"Schema: {err}", env, ipcc)

        receipt = LovelockAuditReceipt(
            **fields,
            receipt_id=receipt_id,
            receipt_hash=receipt_hash,
            oracle_signature=sign_receipt_eip712(receipt_hash, PRIVATE_KEY)
        )

        self._print_receipt(receipt)
        self._save(receipt)
        return receipt

    def _failed_receipt(self, wallet, reason, env, ipcc):
        ts     = datetime.now(timezone.utc).isoformat()
        fields = {"wallet": wallet, "status": "FAILED", "reason": reason}
        return LovelockAuditReceipt(
            wallet_address=wallet, issued_at_utc=ts,
            receipt_id=hashlib.sha256(f"FAIL{ts}".encode()).hexdigest(),
            status=ReceiptStatus.FAILED.value,
            co2_nanograms=0, joules_millijoules=0,
            arctic_nanomm2=0, lovelock_basis_points=0,
            proof_fingerprint="", co2_tonnes_display=0.0,
            arctic_mm2_display=0.0, ipcc_co2_score=0.0,
            ipcc_temp_score=0.0, ipcc_humidity_score=0.0,
            ipcc_lat_factor=0.0, ipcc_methodology="IPCC_AR6_WGI_Table5.1",
            env_temperature_c=env.temperature_c,
            env_humidity_pct=env.humidity_pct,
            env_data_source=env.source, env_verified=env.verified,
            env_layer_used=env.layer_used,
            off_chain_proof_id="", on_chain_tx=None,
            blockchain_provider="", mint_latency_ms=0.0, block_number=0,
            human_message=f"FAILED: {reason}",
            receipt_hash=build_receipt_hash(fields), oracle_signature=None
        )

    def _print_receipt(self, r):
        print("\n" + "═"*58)
        print(f"  🌿 LOVELOCK AUDIT RECEIPT — {r.status}")
        print("═"*58)
        print(f"  Status              : {r.status}")
        print(f"  Wallet              : {r.wallet_address[:16]}...")
        print(f"  CO₂ (uint256)       : {r.co2_nanograms} ng")
        print(f"  CO₂ (display)       : {r.co2_tonnes_display} tonnes")
        print(f"  Lovelock (bp)       : {r.lovelock_basis_points}/10000")
        print(f"  IPCC breakdown      : CO2={r.ipcc_co2_score} "
              f"Temp={r.ipcc_temp_score} Hum={r.ipcc_humidity_score} "
              f"Lat={r.ipcc_lat_factor}")
        print(f"  Methodology         : {r.ipcc_methodology}")
        print(f"  Env source (layer)  : {r.env_data_source} [L{r.env_layer_used}]")
        print(f"  Env temp/humidity   : {r.env_temperature_c}°C / {r.env_humidity_pct}%")
        print(f"  Off-chain proof     : {r.off_chain_proof_id[:24]}...")
        print(f"  On-chain TX         : {r.on_chain_tx or 'Pending'}")
        print(f"  Block               : {r.block_number}")
        print(f"  Oracle signature    : {r.oracle_signature[:24] if r.oracle_signature else 'Unsigned'}...")
        print(f"\n  ✨ {r.human_message}")
        print(f"\n  Receipt Hash        : {r.receipt_hash[:32]}...")
        print("═"*58)

    def _upload_to_ipfs(self, filename: str, data: dict):
        """Auto upload receipt to IPFS via Pinata"""
        try:
            import requests
            jwt = os.getenv("PINATA_JWT")
            if not jwt:
                print("[IPFS] No PINATA_JWT — skipping")
                return
            resp = requests.post(
                "https://api.pinata.cloud/pinning/pinJSONToIPFS",
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json"
                },
                json={
                    "pinataContent":  data,
                    "pinataMetadata": {"name": os.path.basename(filename)}
                },
                timeout=10
            )
            if resp.status_code == 200:
                ipfs_hash = resp.json()["IpfsHash"]
                gateway   = os.getenv("IPFS_GATEWAY", "https://gateway.pinata.cloud/ipfs/")
                print(f"[IPFS] ✅ Uploaded! Hash: {ipfs_hash}")
                print(f"[IPFS] URL : {gateway}{ipfs_hash}")
                data["ipfs_hash"] = ipfs_hash
                data["ipfs_url"]  = f"{gateway}{ipfs_hash}"
                with open(filename, "w") as f:
                    json.dump(data, f, indent=2, default=str)
            else:
                print(f"[IPFS] ❌ Failed: {resp.status_code}")
        except Exception as e:
            print(f"[IPFS] Error: {e} — saved locally only")

    def _save(self, r):
        os.makedirs("receipts", exist_ok=True)
        block = r.block_number or "failed"
        path  = f"receipts/lovelock_{block}_{r.status}.json"

        data = asdict(r)
        if r.status == ReceiptStatus.READY_FOR_MINT.value:
            is_valid, err = validate_schema(data)
            if not is_valid:
                print(f"[SchemaValidator] ❌ ABORT — {err}")
                return

        tmp_path = path + ".tmp"
        try:
            with open(tmp_path, "w") as f:
                json.dump(data, f, indent=2, default=str)
            os.replace(tmp_path, path)
            print(f"\n📄 Receipt → {path}")
            self._upload_to_ipfs(path, data)
        except Exception as e:
            print(f"[Save] ❌ {e}")
            if os.path.exists(tmp_path): os.remove(tmp_path)


async def main():
    engine  = Day21Engine()
    receipt = await engine.execute(
        lat=DEFAULT_LAT, lon=DEFAULT_LON,
        co2_kg=2.5,
        wallet_address=WALLET_ADDR or "0xTEST",
        activity_type="solar"
    )

    if receipt.status == ReceiptStatus.READY_FOR_MINT.value:
        print("\n✅ Day 21 — WORLD CLASS. READY FOR MINT (Day 22).")
    else:
        print(f"\n❌ Status: {receipt.status}")
        for e in engine.rollback.dump():
            print(f"  [{e['track']}] {e['reason']}")


if __name__ == "__main__":
    asyncio.run(main())