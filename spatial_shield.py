import os
import time
import numpy as np
import cv2
from datetime import datetime, timezone, timedelta
from cryptography.fernet import Fernet
from dotenv import load_dotenv

# ✅ Day 9: haversine sirf geo_fence.py mein — Principle #5
from geo_fence import haversine_distance
from encryption_engine import load_key

load_dotenv()


class SpatialShield:
    def __init__(self):
        self.trust_score = 100

        # ✅ GLOBAL FIX: Koi default location nahi
        # Pehli baar user ki real location hi baseline hogi
        # Pehle Karachi hardcoded tha — jo duniya bhar ke users ke liye galat tha
        self.last_known_location = None
        self.last_scan_time      = None

        key         = load_key()
        self.cipher = Fernet(key)
        print(f"✅ SpatialShield initialized")
        print(f"   Mode: Global (no hardcoded location)")

    def fetch_oracle_env_data(self):
        """Oracle data fetch — TODO: Replace with real Chainlink call"""
        print(f"\n[ORACLE NODE CONNECTING]")

        env_payload = {
            "global_temp_anomaly":     "+1.15°C",
            "carbon_market_rate":      24.80,
            "satellite_lock":          "NASA_TERRA_SATELLITE_01",
            "carbon_delta_multiplier": 1.45,
            "data_source":             "SIMULATION",
            "timestamp":               datetime.now(timezone.utc).isoformat()
        }

        print(f"   Satellite: {env_payload['satellite_lock']}")
        print(f"   Temp Delta: {env_payload['global_temp_anomaly']}")
        print(f"   Carbon Rate: ${env_payload['carbon_market_rate']}/ton")
        print(f"   Source: {env_payload['data_source']}")
        return env_payload

    def calculate_carbon_impact(self, user_action_score, oracle_multiplier):
        print(f"\n{'='*50}")
        print(f"IMPACT CALCULATION")
        print(f"{'='*50}")
        impact_score = user_action_score * oracle_multiplier
        tokens       = impact_score * 0.5
        print(f"   Action Score: {user_action_score}")
        print(f"   Multiplier:   {oracle_multiplier}")
        print(f"   CO2 Offset:   -{impact_score:.2f} kg")
        print(f"   ECOX Tokens:  {tokens:.4f}")
        return impact_score

    def generate_cyberpunk_heatmap(self, image_path):
        """Spoof detection via texture analysis"""
        print(f"\nSENTINEL SCANNING: {os.path.basename(image_path)}")

        if not os.path.exists(image_path):
            print(f"Image not found!")
            return "ERROR", None

        img = cv2.imread(image_path)
        if img is None:
            return "ERROR", None

        gray              = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        lap_edges         = cv2.Laplacian(gray, cv2.CV_64F)
        heatmap_intensity = np.var(lap_edges)

        SPOOF_THRESHOLD = 100.0
        print(f"   Texture score: {heatmap_intensity:.2f}")

        if heatmap_intensity < SPOOF_THRESHOLD:
            print(f"SPOOF DETECTED (Score: {heatmap_intensity:.2f})")
            return "RED_ALERT", heatmap_intensity

        print(f"   Organic texture verified!")
        return "GREEN_SIGNAL", heatmap_intensity

    def verify_integrity(self, new_lat, new_lon, current_time=None):
        """
        GPS velocity check — teleportation detect karo.

        ✅ GLOBAL FIX: Pehli location always valid hai
        (Pehle Karachi hardcoded tha — London se test karo to
        "teleportation" deta tha — yeh world no. 1 app ke liye wrong tha)

        ✅ Day 9: haversine_distance geo_fence.py se import hua
        """
        if current_time is None:
            current_time = datetime.now(timezone.utc)

        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        # ✅ PEHLI BAAR — koi comparison nahi, seedha valid
        if self.last_known_location is None or self.last_scan_time is None:
            self.last_known_location = (new_lat, new_lon)
            self.last_scan_time      = current_time
            print(f"   First location registered: {new_lat:.4f}, {new_lon:.4f}")
            return 100

        print(f"\n{'='*50}")
        print(f"SPATIO-TEMPORAL AUDIT")
        print(f"{'='*50}")

        dist = haversine_distance(
            self.last_known_location[0],
            self.last_known_location[1],
            new_lat, new_lon
        )

        if self.last_scan_time.tzinfo is None:
            self.last_scan_time = self.last_scan_time.replace(tzinfo=timezone.utc)

        time_diff = (current_time - self.last_scan_time).total_seconds() / 60
        velocity  = dist / time_diff if time_diff > 0 else 999

        MAX_VELOCITY = 2.0  # 2 km/min = 120 km/h

        print(f"   Distance:    {dist:.2f} km")
        print(f"   Time diff:   {time_diff:.1f} min")
        print(f"   Velocity:    {velocity:.2f} km/min")
        print(f"   Max allowed: {MAX_VELOCITY} km/min")

        if velocity > MAX_VELOCITY:
            print(f"   FRAUD: Impossible velocity!")
            return 0

        print(f"   Location verified!")
        self.last_known_location = (new_lat, new_lon)
        self.last_scan_time      = current_time
        return 100


if __name__ == "__main__":
    shield = SpatialShield()

    # Test 1: Pehli location — anywhere in world — valid honi chahiye
    print("\n--- Test 1: London user (first location) ---")
    score1 = shield.verify_integrity(51.5074, -0.1278)
    print(f"   Result: {'VALID' if score1 == 100 else 'FRAUD'}")

    # Test 2: Same city — valid
    print("\n--- Test 2: Still in London (valid) ---")
    score2 = shield.verify_integrity(51.5100, -0.1300,
             datetime.now(timezone.utc))
    print(f"   Result: {'VALID' if score2 == 100 else 'FRAUD'}")

    # Test 3: Instant teleportation to Karachi — FRAUD
    print("\n--- Test 3: Teleportation London→Karachi (fraud) ---")
    score3 = shield.verify_integrity(24.8607, 67.0011,
             datetime.now(timezone.utc))
    print(f"   Result: {'VALID' if score3 == 100 else 'FRAUD CAUGHT!'}")

    print(f"\n{'='*55}")
    print(f"Global fix: No hardcoded location — works worldwide!")
    print(f"{'='*55}\n")