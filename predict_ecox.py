"""
GaiaVolt — predict_ecox.py

Day 18 Fix:
- get_sha256(), get_phash(), is_duplicate(), PHASH_THRESHOLD removed
- ab image_fingerprint.ImageFingerprinter use hota hai (Principle #5)
- confidence threshold: 70% → 90% (MIN_CONFIDENCE from constants.py)
- syntax errors fixed
"""
import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import numpy as np
import json
import time
import cv2
from PIL import Image
from datetime import datetime, timezone
from dotenv import load_dotenv
from tensorflow.keras.applications.efficientnet import preprocess_input
from src.utils.constants import CONFIG

# ✅ Day 18: image_fingerprint.py se import (Principle #5)
from image_fingerprint import ImageFingerprinter
from anti_cheat import EcoXShield
from geo_fence import check_geo_fence
from src.utils.spoof_detector import detect_spoof
from user_identity import load_identity
from edge_predictor import EdgePredictor

load_dotenv()

DB_FILE    = os.getenv('WALLET_FILE', 'sadaf_wallet.json')

# ✅ Day 10/18: MIN_CONFIDENCE from constants.py (Principle #2)
MIN_CONFIDENCE = CONFIG.get('MIN_CONFIDENCE', 0.90) * 100  # percentage

reward_points = {
    "ocean_cleanup":      100,
    "solar_panels":        50,
    "plantation":          40,
    "electric_cars":       60,
    "cycling":             20,
    "recycling":           30,
    "utility_bills":       25,
    "organic_farming":     45,
    "wind_energy":         80,
    "water_conservation":  35,
    "led_lighting":        15,
    "public_transport":    10
}

shield          = EcoXShield()
fingerprinter   = ImageFingerprinter()  # ✅ Day 18: official fingerprinter
_edge_predictor = None


def get_edge_predictor():
    """TFLite predictor — cached"""
    global _edge_predictor
    if _edge_predictor is None:
        _edge_predictor = EdgePredictor()
    return _edge_predictor


def load_wallet():
    default = {
        "balance":           0,
        "history":           [],
        "processed_hashes":  [],
        "processed_phashes": [],
        "identity_hash":     ""
    }
    if not os.path.exists(DB_FILE):
        return default
    try:
        with open(DB_FILE, 'r') as f:
            data = json.load(f)
        if not isinstance(data, dict) or "balance" not in data:
            return default
        for key in ["processed_hashes", "processed_phashes", "identity_hash"]:
            if key not in data:
                data[key] = [] if key != "identity_hash" else ""
        return data
    except Exception:
        return default


def save_wallet(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=4)


def link_wallet_to_identity(wallet, identity_hash):
    if not wallet.get("identity_hash"):
        wallet["identity_hash"] = identity_hash
        print(f"   Wallet linked to identity")
    elif wallet["identity_hash"] != identity_hash:
        return False, "Wallet belongs to different identity!"
    return True, "Identity matches wallet"


def verify_and_reward(img_path, lat=None, lon=None):
    print(f"\n{'='*60}")
    print(f"GaiaVolt — Verifying: {os.path.basename(img_path)}")
    print(f"{'='*60}")

    if not os.path.exists(img_path):
        print(f"Image not found!")
        return False

    # 1. Identity check
    identity = load_identity()
    if identity is None:
        print(f"No identity found! Run: python user_identity.py first!")
        return False
    print(f"   Identity: {identity['name']}")

    # 2. Spoof check
    if not detect_spoof(img_path):
        print("FRAUD: Screen/spoof detected!")
        return False
    print(f"   Liveness: Authentic!")

    # 3. Geo-fence check
    user_id = os.getenv('REGISTERED_USER', 'user')
    gps_lat = lat or float(os.getenv('DEFAULT_LAT', '24.8607'))
    gps_lon = lon or float(os.getenv('DEFAULT_LON', '67.0011'))

    geo_ok, geo_msg = check_geo_fence(user_id, gps_lat, gps_lon)
    if not geo_ok:
        print(f"GEO-FENCE: {geo_msg}")
        return False

    # 4. Wallet identity link
    wallet = load_wallet()
    link_ok, link_msg = link_wallet_to_identity(
        wallet, identity['identity_hash']
    )
    if not link_ok:
        print(f"BLOCKED: {link_msg}")
        return False
    print(f"   Wallet: {link_msg}")

    # 5. Duplicate check — ✅ Day 18: image_fingerprint.py use karo
    fp_result = fingerprinter.register_image(img_path, user_id, "verify")
    if fp_result.get('is_duplicate'):
        print(f"DUPLICATE: {fp_result.get('method', '')}")
        return False
    print(f"   Fingerprint: {fp_result.get('sha256', '')[:16]}...")

    # 6. AI prediction (TFLite offline)
    edge            = get_edge_predictor()
    result, _, score, ms = edge.predict(img_path)

    if result is None:
        print("Prediction failed!")
        return False

    print(f"   Detected: {result} ({score:.1f}%) [{ms:.1f}ms]")

    # ✅ Day 18: MIN_CONFIDENCE from constants.py (was hardcoded 70)
    if score < MIN_CONFIDENCE:
        print(f"Low confidence: {score:.1f}% (min: {MIN_CONFIDENCE:.0f}%)")
        return False

    # 7. Reward
    points = reward_points.get(result, 0)
    wallet['balance'] += points
    wallet['history'].append({
        "action":     result,
        "reward":     points,
        "match":      f"{score:.2f}%",
        "latency_ms": round(ms, 2),
        "timestamp":  time.time(),
        "date":       datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    })
    save_wallet(wallet)

    print(f"\n+{points} Eco-Coins minted!")
    print(f"Balance: {wallet['balance']} Eco-Coins")
    print(f"{'='*60}\n")
    return True


if __name__ == "__main__":
    solar_dir  = 'dataset/val/solar_panels/'
    images     = os.listdir(solar_dir)
    test_image = os.path.join(solar_dir, images[0])

    print("TEST: Real image")
    verify_and_reward(test_image, lat=24.8607, lon=67.0011)

    print("TEST: Duplicate")
    verify_and_reward(test_image, lat=24.8607, lon=67.0011)