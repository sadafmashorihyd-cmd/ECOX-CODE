"""
Day 21 — Pillar 1: Scientific Accuracy + Pillar 3: Lovelock Integrity Layer
Impact Engine with Static Decay Function + Environment Cross-Validation
"""

import hashlib
import math
from dataclasses import dataclass
from typing import Optional
from datetime import datetime

# ─────────────────────────────────────────────
#  CONSTANTS  (Base year 2024 — deterministic)
# ─────────────────────────────────────────────
BASE_YEAR = 2024

# 1 tonne CO2 → Joules of thermal energy mitigated
# Source: IPCC AR6 — radiative forcing equivalent
CO2_TO_JOULES_PER_TON = 3.67e12       # 3.67 TJ per tonne CO2

# Earth thermal mass constant (surface layer, J per °C per km²)
EARTH_THERMAL_MASS = 4.18e15

# Arctic area target for 2050 goal (km²) — reference: NSIDC
ARCTIC_TARGET_KM2 = 14_000_000

# Fixed decay rate (year-over-year carbon effectiveness decay)
DECAY_RATE = 0.02  # 2% per year after base year


@dataclass
class ProofMetadata:
    """Raw proof data from user submission"""
    co2_kg: float           # Carbon saved in kg
    latitude: float
    longitude: float
    exif_timestamp: str     # ISO format from image metadata
    gps_altitude: float     # metres
    ambient_temp_c: float   # from sensor / weather API
    humidity_pct: float     # 0–100
    image_hash: str         # SHA-256 of submitted image


@dataclass
class ImpactResult:
    """Final verified impact output"""
    co2_tonnes: float
    joules_mitigated: float
    arctic_mm2_cooled: float        # mm² of Arctic preserved
    global_temp_delta: float        # °C reduction (microscopic but real)
    year_decay_factor: float
    human_message: str
    lovelock_score: float           # 0–1, composite integrity score
    proof_fingerprint: str          # deterministic hash of this result


# ─────────────────────────────────────────────
#  PILLAR 1 — Static Decay Function
# ─────────────────────────────────────────────

def decay_factor(current_year: int) -> float:
    """
    Deterministic decay: carbon savings diminish over time as
    baseline atmospheric concentration rises.
    Formula: f(t) = e^(-DECAY_RATE * (t - BASE_YEAR))
    """
    delta_years = max(0, current_year - BASE_YEAR)
    return math.exp(-DECAY_RATE * delta_years)


def calculate_thermal_mitigation(co2_kg: float, year: int) -> dict:
    """
    Pillar 1 core: deterministic CO2 → thermal delta calculation.
    No live API dependency — reward stays stable.
    """
    co2_tonnes = co2_kg / 1000.0
    f = decay_factor(year)

    joules = co2_tonnes * CO2_TO_JOULES_PER_TON * f

    # Temperature delta over Arctic surface layer (1mm depth proxy)
    # ΔT = Q / (m × c) — simplified for micro-impact communication
    arctic_temp_delta = joules / (EARTH_THERMAL_MASS * ARCTIC_TARGET_KM2)

    # Arctic mm² cooled (scaled for human comprehension)
    # 1 mm² = 1e-6 km², so multiply delta by inverse unit
    arctic_mm2 = (joules / (EARTH_THERMAL_MASS * 1e-12)) * f

    return {
        "co2_tonnes": round(co2_tonnes, 6),
        "joules_mitigated": round(joules, 2),
        "global_temp_delta": round(arctic_temp_delta, 12),
        "arctic_mm2_cooled": round(arctic_mm2, 4),
        "year_decay_factor": round(f, 6),
    }


# ─────────────────────────────────────────────
#  PILLAR 3 — Lovelock Integrity Layer
# ─────────────────────────────────────────────

def validate_exif_timestamp(exif_ts: str, tolerance_hours: int = 24) -> bool:
    try:
        image_time = datetime.fromisoformat(exif_ts)
        # timezone-aware comparison
        if image_time.tzinfo is not None:
            from datetime import timezone
            now = datetime.now(timezone.utc)
        else:
            now = datetime.utcnow()
        delta = abs((now - image_time).total_seconds())
        return delta <= (tolerance_hours * 3600)
    except Exception:
        return False


def validate_environment_context(
    latitude: float,
    longitude: float,
    ambient_temp_c: float,
    humidity_pct: float,
    altitude_m: float
) -> dict:
    """
    Cross-reference GPS position against environmental plausibility.
    Lovelock principle: nature has consistent signatures — fake GPS
    rarely has matching environmental fingerprint.
    """
    score = 0.0
    flags = []

    # Altitude plausibility: most inhabited areas 0–4000m
    if 0 <= altitude_m <= 4000:
        score += 0.25
    else:
        flags.append("altitude_anomaly")

    # Temperature plausibility by latitude band
    abs_lat = abs(latitude)
    if abs_lat < 23.5:     # Tropical
        expected_temp_range = (18, 42)
    elif abs_lat < 45:     # Temperate
        expected_temp_range = (-5, 38)
    elif abs_lat < 66.5:   # Subpolar
        expected_temp_range = (-30, 25)
    else:                  # Polar
        expected_temp_range = (-60, 10)

    if expected_temp_range[0] <= ambient_temp_c <= expected_temp_range[1]:
        score += 0.35
    else:
        flags.append("temperature_latitude_mismatch")

    # Humidity plausibility (basic sanity)
    if 5 <= humidity_pct <= 100:
        score += 0.20
    else:
        flags.append("humidity_anomaly")

    # Coordinate validity
    if -90 <= latitude <= 90 and -180 <= longitude <= 180:
        score += 0.20
    else:
        flags.append("invalid_coordinates")

    return {
        "env_score": round(score, 3),
        "flags": flags,
        "passed": score >= 0.75 and len(flags) == 0
    }


def lovelock_integrity_score(
    metadata: ProofMetadata,
    timestamp_ok: bool,
    env_check: dict
) -> float:
    """
    Composite Lovelock score: combines timestamp freshness,
    environment context, and image hash presence.
    Score 0.0–1.0. Minimum 0.80 required to proceed.
    """
    score = 0.0

    if timestamp_ok:
        score += 0.35
    if env_check["passed"]:
        score += 0.40
    if metadata.image_hash and len(metadata.image_hash) == 64:  # SHA-256
        score += 0.25

    return round(score, 3)


# ─────────────────────────────────────────────
#  PILLAR 4 — Human-Readable 2050 Message
# ─────────────────────────────────────────────

ARCTIC_PRESERVATION_GOAL_MM2 = 1.4e19  # Total 2050 Arctic goal in mm²

def generate_impact_message(arctic_mm2: float, tx_hash: Optional[str] = None) -> str:
    """
    Translate scientific delta into 2050-feel human milestone.
    Message is ONLY generated if tx_hash is present (on-chain confirmed).
    """
    if not tx_hash:
        return "[Impact message pending on-chain confirmation]"

    pct_of_goal = (arctic_mm2 / ARCTIC_PRESERVATION_GOAL_MM2) * 100

    if pct_of_goal < 0.00001:
        area_desc = f"{arctic_mm2:.4f} mm²"
    else:
        area_desc = f"{pct_of_goal:.8f}% of the 2050 Arctic goal"

    return (
        f"Your action just cooled a {arctic_mm2:.4f} mm² patch of the Arctic. "
        f"This contributes {pct_of_goal:.10f}% toward the 2050 preservation goal. "
        f"Verified on-chain: {tx_hash[:16]}..."
    )


# ─────────────────────────────────────────────
#  MASTER FUNCTION — Full Track A Pipeline
# ─────────────────────────────────────────────

def run_impact_engine(metadata: ProofMetadata) -> Optional[ImpactResult]:
    """
    Track A: Full pipeline.
    Returns ImpactResult if all checks pass, else None (triggers rollback).
    """
    current_year = datetime.utcnow().year

    # Step 1: Timestamp freshness
    ts_ok = validate_exif_timestamp(metadata.exif_timestamp)
    if not ts_ok:
        print("[ImpactEngine] FAIL — Exif timestamp stale or invalid")
        return None

    # Step 2: Environment cross-validation (Lovelock Layer)
    env_check = validate_environment_context(
        metadata.latitude,
        metadata.longitude,
        metadata.ambient_temp_c,
        metadata.humidity_pct,
        metadata.gps_altitude
    )

    # Step 3: Lovelock composite score
    love_score = lovelock_integrity_score(metadata, ts_ok, env_check)
    if love_score < 0.80:
        print(f"[ImpactEngine] FAIL — Lovelock score too low: {love_score}")
        return None

    # Step 4: Scientific calculation (deterministic)
    thermal = calculate_thermal_mitigation(metadata.co2_kg, current_year)

    # Step 5: Proof fingerprint (deterministic — same input = same hash)
    fingerprint_data = (
        f"{metadata.co2_kg}|{metadata.latitude}|{metadata.longitude}"
        f"|{metadata.exif_timestamp}|{metadata.image_hash}"
        f"|{thermal['joules_mitigated']}|{love_score}"
    )
    proof_fingerprint = hashlib.sha256(fingerprint_data.encode()).hexdigest()

    return ImpactResult(
        co2_tonnes=thermal["co2_tonnes"],
        joules_mitigated=thermal["joules_mitigated"],
        arctic_mm2_cooled=thermal["arctic_mm2_cooled"],
        global_temp_delta=thermal["global_temp_delta"],
        year_decay_factor=thermal["year_decay_factor"],
        human_message="[Pending on-chain tx]",   # filled after Track B
        lovelock_score=love_score,
        proof_fingerprint=proof_fingerprint
    )


# ─── Quick test ───
if __name__ == "__main__":
    test_meta = ProofMetadata(
        co2_kg=2.5,
        latitude=30.3753,
        longitude=69.3451,
        exif_timestamp=datetime.utcnow().isoformat(),
        gps_altitude=212.0,
        ambient_temp_c=32.0,
        humidity_pct=55.0,
        image_hash="a" * 64  # placeholder SHA-256
    )

    result = run_impact_engine(test_meta)
    if result:
        print("\n✅ Track A SUCCESS")
        print(f"  CO₂ saved     : {result.co2_tonnes} tonnes")
        print(f"  Joules removed: {result.joules_mitigated:,.2f} J")
        print(f"  Arctic cooled : {result.arctic_mm2_cooled:.4f} mm²")
        print(f"  Lovelock score: {result.lovelock_score}")
        print(f"  Fingerprint   : {result.proof_fingerprint[:32]}...")
    else:
        print("\n❌ Track A FAILED — rollback initiated")
