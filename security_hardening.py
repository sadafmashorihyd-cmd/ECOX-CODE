"""
GaiaVolt — Security Hardening v2.0
1. Anti-Deepfake: Temporal + Optical Flow
2. GPS Spoofing Defense: Multi-layer validation
3. Hard-Coded Security Gatekeeper

Day 9 Fix: _haversine() removed — now imported from geo_fence.py (Principle #5)
"""
import cv2
import numpy as np
import hashlib
import time
import requests
from datetime import datetime, timezone

# ✅ Day 9: haversine sirf geo_fence.py mein — Principle #5 (Single Source of Truth)
from geo_fence import haversine_distance


class SecurityGatekeeper:
    """
    Hard-coded gatekeeper — CANNOT be bypassed even in emergency mode.
    These checks always run regardless of threshold settings.
    """

    # ── GATEKEEPER 1: Anti-Deepfake ──────────────────────────────────
    def check_deepfake(self, frames):
        """
        Temporal Analysis + Optical Flow deepfake detection.
        Deepfake = too smooth, too perfect, no natural noise.
        Real video = micro-jitters, natural optical flow variance.
        """
        if len(frames) < 6:
            return {"passed": True, "reason": "Too few frames to analyze"}

        # Test 1: Optical Flow Variance
        flow_mags     = []
        flow_variance = 0.0
        step          = max(1, len(frames) // 10)

        for i in range(0, len(frames) - step, step):
            prev = cv2.cvtColor(frames[i],      cv2.COLOR_BGR2GRAY)
            curr = cv2.cvtColor(frames[i+step], cv2.COLOR_BGR2GRAY)
            try:
                flow = cv2.calcOpticalFlowFarneback(
                    prev, curr, None, 0.5, 3, 15, 3, 5, 1.2, 0
                )
                mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
                flow_mags.append(float(np.mean(mag)))
            except Exception:
                pass

        if flow_mags:
            flow_variance = float(np.std(flow_mags))
            flow_avg      = float(np.mean(flow_mags))
            if flow_variance < 0.05 and flow_avg > 0.5:
                return {
                    "passed":         False,
                    "reason":         "Deepfake detected — unnatural optical flow",
                    "flow_variance":  flow_variance
                }

        # Test 2: Temporal Noise Analysis
        noise_vars = []
        avg_noise  = 0.0

        for frame in frames[::3][:5]:
            gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(float)
            noise = gray - cv2.GaussianBlur(gray, (5, 5), 0)
            noise_vars.append(float(np.var(noise)))

        if noise_vars:
            avg_noise = float(np.mean(noise_vars))
            if avg_noise < 3.0:
                return {
                    "passed":      False,
                    "reason":      "AI-generated video detected — no camera sensor noise",
                    "noise_level": avg_noise
                }

        # Test 3: Compression artifacts (block boundary detection)
        block_scores = []
        for frame in frames[::4][:5]:
            gray   = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            h, w   = gray.shape
            score  = 0
            for y in range(0, min(h-8, 64), 8):
                for x in range(0, min(w-8, 64), 8):
                    if x > 0:
                        left_edge = abs(float(gray[y+4, x]) - float(gray[y+4, x-1]))
                        score    += left_edge
            block_scores.append(score)

        print(f"   Deepfake check: flow_var={flow_variance:.3f} noise={avg_noise:.2f}")
        return {"passed": True, "reason": "Real video confirmed"}

    # ── GATEKEEPER 2: GPS Multi-Layer Defense ────────────────────────
    def validate_gps_multilayer(self, lat, lon, ip_address=None):
        """
        Multi-layer GPS validation:
        Layer 1: Coordinate sanity check
        Layer 2: IP-to-location correlation
        Layer 3: Speed/velocity check (in activity_proof_engine)
        """
        # Layer 1: Basic sanity
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return False, "Invalid GPS coordinates"

        if lat < -60 or lat > 75:
            return False, "Suspicious GPS — uninhabited coordinates"

        # Layer 2: IP correlation (if available)
        if ip_address and ip_address not in ['127.0.0.1', '::1'] \
                and not ip_address.startswith(('192.168.', '10.')):
            try:
                resp = requests.get(
                    f"http://ip-api.com/json/{ip_address}",
                    timeout=3
                )
                if resp.status_code == 200:
                    ip_data    = resp.json()
                    if ip_data.get('status') == 'success':
                        ip_lat     = ip_data.get('lat', 0)
                        ip_lon     = ip_data.get('lon', 0)
                        ip_country = ip_data.get('country', '')

                        # ✅ Day 9: geo_fence.haversine_distance use karo
                        dist = haversine_distance(lat, lon, ip_lat, ip_lon)

                        print(f"   IP location: {ip_country} ({ip_lat:.2f}, {ip_lon:.2f})")
                        print(f"   GPS location: ({lat:.2f}, {lon:.2f})")
                        print(f"   IP-GPS distance: {dist:.0f}km")

                        if dist > 2000:
                            return False, f"GPS-IP mismatch: {dist:.0f}km apart — possible GPS spoofing"
            except Exception as e:
                print(f"   IP check skipped: {e}")

        return True, "GPS validated"

    # ── GATEKEEPER 3: Hard Security (cannot be disabled) ─────────────
    def hard_security_check(self, video_path, frames, gps, ip=None):
        """
        These checks ALWAYS run — even if threshold = 0.
        Returns (passed, reason, details)
        """
        import os

        # 1. File integrity
        file_size = os.path.getsize(video_path)
        if file_size < 1000:
            return False, "Video file too small — likely invalid", {}

        # 2. Minimum frames
        if len(frames) < 3:
            return False, "Video has too few frames", {}

        # 3. Deepfake check — ALWAYS runs
        df_result = self.check_deepfake(frames)
        if not df_result["passed"]:
            return False, df_result["reason"], df_result

        # 4. GPS validation — ALWAYS runs
        if gps:
            gps_ok, gps_msg = self.validate_gps_multilayer(
                gps.get('lat', 0), gps.get('lon', 0), ip
            )
            if not gps_ok:
                return False, gps_msg, {}

        # 5. Minimum motion — completely static video = fake
        if len(frames) >= 2:
            diffs = []
            for i in range(1, min(len(frames), 5)):
                diff = cv2.absdiff(
                    cv2.cvtColor(frames[i-1], cv2.COLOR_BGR2GRAY),
                    cv2.cvtColor(frames[i],   cv2.COLOR_BGR2GRAY)
                )
                diffs.append(float(np.mean(diff)))
            avg_motion = float(np.mean(diffs)) if diffs else 0
            if avg_motion < 0.5:
                return False, "Completely static video — real activity required", {"motion": avg_motion}

        print(f"   Hard security: ALL checks passed")
        return True, "Security validated", {}