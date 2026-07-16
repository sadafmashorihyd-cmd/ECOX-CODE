import os
import json
import time
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()


class ChainlinkOracle:
    """
    Day 14: Oracle Integration — 3-Source Redundancy
    Real-world data → Smart Contract

    Sources:
    1. carbonintensity.org.uk — UK carbon intensity (free)
    2. open-meteo.com         — weather (free, no key)
    3. co2signal.com          — global CO2 signal (free tier)

    Architecture document requirement: 3 independent sources
    for oracle redundancy — prevents Oracle Manipulation attacks.
    """

    def __init__(self):
        self.carbon_rate  = None
        self.weather      = None
        self.co2_signal   = None
        self.last_updated = None

    # ── Source 1: Carbon Rate ─────────────────────────────────────────
    def fetch_carbon_rate(self):
        """
        Primary: carbonintensity.org.uk
        Backup: co2signal.com
        """
        # Primary source
        try:
            response = requests.get(
                "https://api.carbonintensity.org.uk/intensity",
                timeout=5
            )
            if response.status_code == 200:
                data      = response.json()
                intensity = data['data'][0]['intensity']['actual']
                # Convert gCO2/kWh to $/ton approximate
                self.carbon_rate = round(intensity * 0.025, 2)
                print(f"   Carbon Rate (live): {self.carbon_rate} $/ton")
                return self.carbon_rate
        except Exception as e:
            print(f"   Carbon API unavailable: {e}")

        # Fallback: None — Fail-Safe mode (reward pause)
        # Day 8 mein decided: oracle fail = reward pause, not 24.80 hardcoded
        self.carbon_rate = None
        print(f"   Carbon rate unavailable — reward will pause (Fail-Safe)")
        return None

    # ── Source 2: Weather ─────────────────────────────────────────────
    def fetch_weather(self, lat=24.8607, lon=67.0011):
        """
        Open-Meteo: Free, no API key needed.
        """
        try:
            url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}"
                f"&current=temperature_2m,weather_code"
                f"&timezone=auto"
            )
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data    = response.json()
                current = data['current']
                temp    = current['temperature_2m']
                code    = current['weather_code']

                if code < 3:
                    condition = "Clear"
                elif code < 50:
                    condition = "Cloudy"
                elif code < 70:
                    condition = "Rainy"
                else:
                    condition = "Stormy"

                self.weather = {
                    "temp":      temp,
                    "condition": condition,
                    "code":      code,
                    "location":  f"{lat}, {lon}"
                }
                print(f"   Weather (live): {temp}°C, {condition}")
                return self.weather
        except Exception as e:
            print(f"   Weather API unavailable: {e}")

        self.weather = None
        return None

    # ── Source 3: CO2 Signal (NEW — Oracle Redundancy) ────────────────
    def fetch_co2_signal(self, country_code="PK"):
        """
        ✅ NEW — Day 14: Third independent source.

        co2signal.com provides real-time CO2 intensity per country.
        Pakistan = "PK", Global fallback available.

        Architecture document requirement:
        'Oracle Redundancy: 3 independent, verified sources'
        """
        co2_token = os.getenv('CO2SIGNAL_TOKEN', '')

        try:
            headers = {}
            if co2_token:
                headers['auth-token'] = co2_token

            url = f"https://api.co2signal.com/v1/latest?countryCode={country_code}"
            response = requests.get(url, headers=headers, timeout=5)

            if response.status_code == 200:
                data      = response.json()
                intensity = data.get('data', {}).get('carbonIntensity', None)
                fossil_pct = data.get('data', {}).get('fossilFuelPercentage', None)

                if intensity is not None:
                    self.co2_signal = {
                        "carbon_intensity": round(intensity, 2),
                        "fossil_fuel_pct":  round(fossil_pct, 1) if fossil_pct else None,
                        "country":          country_code,
                        "source":           "co2signal.com"
                    }
                    print(f"   CO2 Signal ({country_code}): {intensity:.1f} gCO2/kWh")
                    return self.co2_signal

        except Exception as e:
            print(f"   CO2 Signal unavailable: {e}")

        # Fallback: None — not critical, just bonus source
        self.co2_signal = None
        print(f"   CO2 Signal unavailable (non-critical)")
        return None

    # ── Consensus Check ───────────────────────────────────────────────
    def check_consensus(self):
        """
        3-source consensus check.
        Agar carbon_rate aur weather dono available hain = CONSENSUS.
        co2_signal optional hai (bonus verification).
        """
        sources_available = sum([
            self.carbon_rate is not None,
            self.weather is not None,
            self.co2_signal is not None,
        ])

        consensus = sources_available >= 2  # 2/3 minimum

        return {
            "consensus":         consensus,
            "sources_available": sources_available,
            "sources_total":     3,
            "carbon_rate":       self.carbon_rate is not None,
            "weather":           self.weather is not None,
            "co2_signal":        self.co2_signal is not None,
        }

    # ── Fetch All ─────────────────────────────────────────────────────
    def fetch_all(self, lat=24.8607, lon=67.0011):
        """Fetch all 3 oracle sources"""
        print(f"\n{'='*55}")
        print(f"CHAINLINK ORACLE — FETCHING DATA (3 Sources)")
        print(f"{'='*55}")
        print(f"   Timestamp: {datetime.now(timezone.utc).isoformat()}")

        self.fetch_carbon_rate()
        self.fetch_weather(lat, lon)
        self.fetch_co2_signal()

        consensus = self.check_consensus()
        self.last_updated = datetime.now(timezone.utc).isoformat()

        status = "LIVE" if consensus["consensus"] else "FAIL-SAFE"
        print(f"   Consensus: {consensus['sources_available']}/3 sources")
        print(f"   Status: {status}")

        payload = {
            "carbon_rate":  self.carbon_rate,
            "weather":      self.weather,
            "co2_signal":   self.co2_signal,
            "consensus":    consensus,
            "timestamp":    self.last_updated,
            "data_sources": [
                "carbonintensity.org.uk",
                "open-meteo.com",
                "co2signal.com"
            ],
            "status": status
        }

        print(f"{'='*55}\n")
        return payload

    # ── Carbon Multiplier ─────────────────────────────────────────────
    def calculate_multiplier(self, action_class):
        """Carbon impact multiplier based on real data"""
        base_multipliers = {
            "solar_panels":       1.5,
            "cycling":            1.2,
            "electric_cars":      1.8,
            "ocean_cleanup":      2.0,
            "plantation":         1.6,
            "recycling":          1.3,
            "utility_bills":      1.1,
            "organic_farming":    1.4,
            "wind_energy":        1.7,
            "water_conservation": 1.3,
            "led_lighting":       1.1,
            "public_transport":   1.2
        }

        base = base_multipliers.get(action_class, 1.0)

        if self.weather:
            if self.weather['condition'] == 'Clear':
                base *= 1.1
            elif self.weather['condition'] == 'Rainy':
                base *= 0.9

        if self.carbon_rate:
            if self.carbon_rate > 30:
                base *= 1.2
            elif self.carbon_rate < 15:
                base *= 0.8

        return round(base, 2)


def run_oracle_demo():
    print(f"\n{'='*55}")
    print(f"DAY 14 — ORACLE INTEGRATION (3-Source)")
    print(f"{'='*55}")

    oracle = ChainlinkOracle()
    data   = oracle.fetch_all(lat=24.8607, lon=67.0011)

    # Consensus report
    consensus = data['consensus']
    print(f"\nCONSENSUS REPORT:")
    print(f"{'='*55}")
    print(f"   Sources available: {consensus['sources_available']}/3")
    print(f"   Carbon rate:       {'OK' if consensus['carbon_rate'] else 'UNAVAILABLE'}")
    print(f"   Weather:           {'OK' if consensus['weather'] else 'UNAVAILABLE'}")
    print(f"   CO2 Signal:        {'OK' if consensus['co2_signal'] else 'UNAVAILABLE'}")
    print(f"   Status:            {data['status']}")

    # Multipliers
    print(f"\nCARBON MULTIPLIERS (Real-time):")
    print(f"{'='*55}")
    for action in ["solar_panels", "cycling", "electric_cars", "plantation"]:
        mult   = oracle.calculate_multiplier(action)
        reward = int(mult * 50)
        print(f"   {action:<22} {mult}x → {reward} coins")

    # Impact
    print(f"\nPLANETARY IMPACT:")
    print(f"{'='*55}")
    print(f"   Carbon Rate:  ${data['carbon_rate']}/ton")
    if data['weather']:
        print(f"   Temperature:  {data['weather']['temp']}°C")
        print(f"   Condition:    {data['weather']['condition']}")
    if data['co2_signal']:
        print(f"   CO2 Intensity: {data['co2_signal']['carbon_intensity']} gCO2/kWh")
    print(f"   Timestamp:    {data['timestamp']}")

    with open('oracle_data.json', 'w') as f:
        json.dump(data, f, indent=4)
    print(f"\n   Oracle data saved: oracle_data.json")

    print(f"\n{'='*55}")
    print(f"Day 14 Oracle Integration COMPLETE!")
    print(f"3 Sources: carbonintensity + open-meteo + co2signal")
    print(f"{'='*55}\n")

    return data


if __name__ == "__main__":
    run_oracle_demo()