"""
geo_registry.py — GaiaVolt
============================
#8 Fable5: Geohash Registry
- Solar panels: one-time location lock
- Plantation: 5m radius per tree (no duplicate claims)
- LED: one per address
"""

import sqlite3, math, os
from datetime import datetime, timezone


DB_PATH = "geo_registry.db"

# Geohash precision
# Level 7 = ~150m x 150m
# Level 8 = ~38m x 19m  
# Level 9 = ~4.8m x 4.8m (use for trees)
TREE_RADIUS_M    = 5      # 5 meter radius per tree
SOLAR_RADIUS_M   = 20     # 20 meter radius per solar installation
LED_RADIUS_M     = 50     # 50 meter radius per address


def haversine_m(lat1, lon1, lat2, lon2):
    """Distance in meters between two GPS points."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.asin(math.sqrt(a))


class GeoRegistry:

    def __init__(self):
        self._init_db()
        print("✅ Geo Registry ready (Geohash lock)")

    def _init_db(self):
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS geo_claims (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT,
                proof_type  TEXT,
                lat         REAL,
                lon         REAL,
                radius_m    REAL,
                registered_at TEXT,
                UNIQUE(user_id, proof_type)
            )
        """)
        conn.commit()
        conn.close()

    def check_and_register(self, user_id: str, proof_type: str,
                           lat: float, lon: float) -> dict:
        """
        Check if location is already claimed.
        Returns: {"passed": bool, "reason": str, "registered": bool}
        """
        radius = {
            "plantation":   TREE_RADIUS_M,
            "solar_panels": SOLAR_RADIUS_M,
            "led_lighting": LED_RADIUS_M,
        }.get(proof_type)

        # Only apply to location-locked categories
        if radius is None:
            return {"passed": True, "reason": "No location lock for this category"}

        conn = sqlite3.connect(DB_PATH)

        # Check all existing claims of this type
        existing = conn.execute(
            "SELECT user_id, lat, lon FROM geo_claims WHERE proof_type=?",
            (proof_type,)
        ).fetchall()

        for row in existing:
            ex_user, ex_lat, ex_lon = row
            dist = haversine_m(lat, lon, ex_lat, ex_lon)

            if dist <= radius:
                conn.close()
                if ex_user == user_id:
                    # Same user — returning to their own registered location ✅
                    return {
                        "passed": True,
                        "reason": f"Returning to registered {proof_type} location",
                        "registered": False
                    }
                else:
                    # Different user — location already claimed ❌
                    return {
                        "passed": False,
                        "reason": f"Location already claimed by another user within {radius}m radius. Each {proof_type} location can only be registered once.",
                        "registered": False
                    }

        # New location — register it
        try:
            conn.execute("""
                INSERT INTO geo_claims (user_id, proof_type, lat, lon, radius_m, registered_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, proof_type, lat, lon, radius,
                  datetime.now(timezone.utc).isoformat()))
            conn.commit()
            conn.close()
            return {
                "passed": True,
                "reason": f"New {proof_type} location registered (radius: {radius}m)",
                "registered": True
            }
        except Exception as e:
            conn.close()
            return {"passed": False, "reason": f"Registration error: {e}"}

    def get_stats(self) -> dict:
        conn = sqlite3.connect(DB_PATH)
        total = conn.execute("SELECT COUNT(*) FROM geo_claims").fetchone()[0]
        conn.close()
        return {"total_registered": total}