"""
Day 22 — Web3 Bridge (REAL CONTRACT)
Connects to deployed EcoCoin on Polygon Amoy
CONTRACT_ADDRESS = "0xc26A215ada91C7A51001a2c11B5348D532B28c93"
"""

import asyncio
import time
import json
import hashlib
import os
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum
from web3 import Web3
from web3.exceptions import Web3Exception
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────
INFURA_KEY   = os.getenv("INFURA_KEY")
ALCHEMY_KEY  = os.getenv("ALCHEMY_KEY")
WALLET_ADDR  = os.getenv("ADMIN_WALLET_ADDRESS")
PRIVATE_KEY  = os.getenv("ORACLE_PRIVATE_KEY")
CHAIN_ID     = int(os.getenv("CHAIN_ID", 80002))
CONTRACT_ADDRESS = "0xc26A215ada91C7A51001a2c11B5348D532B28c93"
# Load ABI from artifact file
ABI_PATH = os.path.join(
    os.path.dirname(__file__),
    "ecox-contracts", "artifacts", "contracts",
    "EcoCoin.sol", "EcoCoin.json"
)

def load_abi():
    try:
        with open(ABI_PATH, "r") as f:
            return json.load(f)["abi"]
    except Exception as e:
        print(f"[ABI] Warning: Could not load from file ({e}) — using embedded ABI")
        return EMBEDDED_ABI

# Minimal embedded ABI (fallback)
EMBEDDED_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "recipient", "type": "address"},
            {"internalType": "uint256", "name": "amount",    "type": "uint256"},
            {"internalType": "bytes32", "name": "actionId",  "type": "bytes32"},
            {"internalType": "uint256", "name": "confidenceBps", "type": "uint256"}
        ],
        "name": "mintFromAI",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "recipient", "type": "address"},
            {"internalType": "uint256", "name": "amount",    "type": "uint256"},
            {"internalType": "bytes32", "name": "actionId",  "type": "bytes32"}
        ],
        "name": "approveMint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs":  [],
        "name":    "totalSupply",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs":  [{"internalType": "address", "name": "account", "type": "address"}],
        "name":    "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "recipient",  "type": "address"},
            {"indexed": False, "name": "amount",     "type": "uint256"},
            {"indexed": True,  "name": "imageHash",  "type": "bytes32"}
        ],
        "name": "EcoRewardMinted",
        "type": "event"
    }
]

# ─────────────────────────────────────────────
#  RPC PROVIDERS
# ─────────────────────────────────────────────
RPC_PROVIDERS = [
    {"name": "Amoy-Public", "url": "https://rpc-amoy.polygon.technology"},
    {"name": "Infura",      "url": f"https://polygon-amoy.infura.io/v3/{INFURA_KEY}"},
    {"name": "Alchemy",     "url": f"https://polygon-amoy.g.alchemy.com/v2/{ALCHEMY_KEY}"},
]

LATENCY_THRESHOLD_MS    = 2000
MAX_FAILURES_TO_OPEN    = 2
RETRY_DELAY_SECONDS     = 1.5
MAX_RETRIES             = 3
HEALTH_PING_INTERVAL    = 30

# ─────────────────────────────────────────────
#  CIRCUIT BREAKER
# ─────────────────────────────────────────────
class CircuitState(Enum):
    CLOSED    = "closed"
    OPEN      = "open"
    HALF_OPEN = "half_open"


@dataclass
class ProviderHealth:
    name: str
    url: str
    failures: int = 0
    state: CircuitState = CircuitState.CLOSED
    last_failure_time: float = 0.0
    latency_samples: list = field(default_factory=list)

    @property
    def avg_latency_ms(self) -> float:
        if not self.latency_samples:
            return 0.0
        return round(sum(self.latency_samples) / len(self.latency_samples), 1)

    def record_latency(self, ms: float):
        self.latency_samples.append(ms)
        if len(self.latency_samples) > 10:
            self.latency_samples.pop(0)

    def mark_failure(self):
        self.failures += 1
        self.last_failure_time = time.time()
        if self.failures >= MAX_FAILURES_TO_OPEN:
            self.state = CircuitState.OPEN
            print(f"[CircuitBreaker] {self.name} → OPEN")

    def mark_success(self):
        self.failures = 0
        self.state    = CircuitState.CLOSED

    def can_attempt(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time > HEALTH_PING_INTERVAL:
                self.state = CircuitState.HALF_OPEN
                return True
            return False
        return True


# ─────────────────────────────────────────────
#  WEB3 BRIDGE — REAL CONTRACT
# ─────────────────────────────────────────────
class Web3Bridge:

    def __init__(self):
        self.providers = [
            ProviderHealth(name=p["name"], url=p["url"])
            for p in RPC_PROVIDERS
        ]
        self.active_index = 0
        self.w3           = self._connect()
        self.contract     = self._load_contract()
        self._ping_task   = None

    def _connect(self) -> Web3:
        for i, p in enumerate(self.providers):
            try:
                w3 = Web3(Web3.HTTPProvider(p.url, request_kwargs={"timeout": 5}))
                if w3.is_connected():
                    self.active_index = i
                    self.providers[i].mark_success()
                    print(f"[Web3Bridge] Connected → {p.name}")
                    print(f"[Web3Bridge] Live block: {w3.eth.block_number}")
                    return w3
            except Exception as e:
                print(f"[Web3Bridge] {p.name} failed: {e}")
                self.providers[i].mark_failure()
        raise ConnectionError("[Web3Bridge] ALL providers failed!")

    def _load_contract(self):
        """Load EcoCoin contract with full ABI"""
        abi = load_abi()
        contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(CONTRACT_ADDRESS),
            abi=abi
        )
        # Verify contract is accessible
        try:
            supply = contract.functions.totalSupply().call()
            print(f"[Contract] EcoCoin loaded ✅")
            print(f"[Contract] Total supply: {supply / 10**18:.2f} ECOX")
            print(f"[Contract] Address: {CONTRACT_ADDRESS}")
        except Exception as e:
            print(f"[Contract] Warning: {e}")
        return contract

    def _switch_provider(self):
        for i, p in enumerate(self.providers):
            if i != self.active_index and p.can_attempt():
                try:
                    w3 = Web3(Web3.HTTPProvider(p.url, request_kwargs={"timeout": 5}))
                    if w3.is_connected():
                        self.active_index = i
                        self.w3           = w3
                        self.contract     = self._load_contract()
                        p.mark_success()
                        print(f"[CircuitBreaker] Switched → {p.name}")
                        return True
                except Exception:
                    p.mark_failure()
        return False

    async def _background_ping(self):
        while True:
            await asyncio.sleep(HEALTH_PING_INTERVAL)
            for p in self.providers:
                if p.state in (CircuitState.OPEN, CircuitState.HALF_OPEN):
                    try:
                        w3 = Web3(Web3.HTTPProvider(p.url, request_kwargs={"timeout": 3}))
                        if w3.is_connected():
                            p.mark_success()
                            print(f"[AutoPing] {p.name} recovered → CLOSED")
                    except Exception:
                        p.last_failure_time = time.time()

    def start_background_ping(self):
        self._ping_task = asyncio.ensure_future(self._background_ping())

    # ─────────────────────────────────────────
    #  REAL MINT — mintFromAI
    # ─────────────────────────────────────────

    def calculate_mint_amount(self, co2_tonnes: float) -> int:
        """
        1 tonne CO2 saved = 1000 ECOX
        Amount in wei (18 decimals)
        Papa fix: amount * 10**18
        """
        ecox_amount = co2_tonnes * 1000
        return int(ecox_amount * 10**18)

    def sign_and_send_mint(
        self,
        recipient: str,
        co2_tonnes: float,
        proof_fingerprint: str
    ) -> Optional[dict]:
        """
        Real on-chain mintFromAI transaction.
        Signs with ORACLE_PRIVATE_KEY and sends to blockchain.
        """
        if not PRIVATE_KEY:
            print("[Signer] No ORACLE_PRIVATE_KEY — cannot sign real tx")
            return None

        try:
            recipient_checksum = Web3.to_checksum_address(recipient)
            amount    = self.calculate_mint_amount(co2_tonnes)
            action_id = bytes.fromhex(proof_fingerprint[:64])

            print(f"\n[RealMint] Building transaction...")
            print(f"  Recipient : {recipient_checksum[:16]}...")
            print(f"  Amount    : {amount / 10**18:.4f} ECOX")
            print(f"  ActionId  : {proof_fingerprint[:16]}...")

            # Build transaction
            nonce = self.w3.eth.get_transaction_count(
                Web3.to_checksum_address(WALLET_ADDR)
            )
            gas_price = self.w3.eth.gas_price

            confidence_bps = 9500
            tx = self.contract.functions.mintFromAI(
                recipient_checksum,
                amount,
                action_id,
                confidence_bps
            ).build_transaction({
                "from":     Web3.to_checksum_address(WALLET_ADDR),
                "nonce":    nonce,
                "gasPrice": gas_price,
                "chainId":  CHAIN_ID,
            })

            # Estimate gas
            try:
                tx["gas"] = self.w3.eth.estimate_gas(tx)
                print(f"  Gas est.  : {tx['gas']}")
            except Exception as e:
                tx["gas"] = 200000
                print(f"  Gas est.  : 200000 (fallback — {e})")

            # Sign and send
            signed  = self.w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            tx_hex  = "0x" + tx_hash.hex()

            print(f"[RealMint] ✅ TX sent: {tx_hex[:24]}...")

            # Wait for receipt
            print(f"[RealMint] Waiting for confirmation...")
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

            if receipt["status"] == 1:
                print(f"[RealMint] ✅ CONFIRMED on block {receipt['blockNumber']}")
                return {
                    "tx_hash":      tx_hex,
                    "block_number": receipt["blockNumber"],
                    "gas_used":     receipt["gasUsed"],
                    "status":       "success"
                }
            else:
                print(f"[RealMint] ❌ TX REVERTED")
                return {"tx_hash": tx_hex, "status": "reverted"}

        except Exception as e:
            print(f"[RealMint] Error: {e}")
            return None

    async def mint_eco_coin(
        self,
        wallet_address: str,
        proof_fingerprint: str,
        co2_tonnes: float
    ) -> Optional[dict]:
        """
        Track B: Try real mint first, fall back to off-chain proof.
        """
        provider = self.providers[self.active_index]
        print(f"\n[Web3Bridge] Mint initiated...")
        print(f"  Wallet : {wallet_address[:16]}...")
        print(f"  Proof  : {proof_fingerprint[:24]}...")
        print(f"  CO₂    : {co2_tonnes} tonnes")

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                start = time.time()

                if not self.w3.is_connected():
                    self._switch_provider()

                block      = self.w3.eth.block_number
                latency_ms = (time.time() - start) * 1000
                provider.record_latency(latency_ms)

                if latency_ms > LATENCY_THRESHOLD_MS:
                    provider.mark_failure()
                    self._switch_provider()
                    continue

                provider.mark_success()

                # Try real on-chain mint
                real_result = self.sign_and_send_mint(
                    recipient=wallet_address,
                    co2_tonnes=co2_tonnes,
                    proof_fingerprint=proof_fingerprint
                )

                # Off-chain proof ID (always generated)
                off_chain_id = "0x" + self.w3.keccak(
                    text=f"{proof_fingerprint}{wallet_address}{block}"
                ).hex()

                if real_result and real_result.get("status") == "success":
                    return {
                        "off_chain_proof_id": off_chain_id,
                        "on_chain_tx":        real_result["tx_hash"],
                        "block_number":       real_result["block_number"],
                        "gas_used":           real_result["gas_used"],
                        "provider_used":      provider.name,
                        "latency_ms":         round(latency_ms, 2),
                        "minted_at":          time.time(),
                        "ecox_amount":        self.calculate_mint_amount(co2_tonnes) / 10**18
                    }
                else:
                    # Oracle not set yet — return off-chain proof
                    print(f"[Web3Bridge] Real mint skipped — oracle setup pending")
                    return {
                        "off_chain_proof_id": off_chain_id,
                        "on_chain_tx":        None,
                        "block_number":       block,
                        "gas_used":           0,
                        "provider_used":      provider.name,
                        "latency_ms":         round(latency_ms, 2),
                        "minted_at":          time.time(),
                        "ecox_amount":        self.calculate_mint_amount(co2_tonnes) / 10**18
                    }

            except Exception as e:
                print(f"[Web3Bridge] Attempt {attempt}/{MAX_RETRIES}: {e}")
                provider.mark_failure()
                if self.active_index < len(self.providers) - 1:
                    self._switch_provider()
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(RETRY_DELAY_SECONDS * attempt)

        return None

    def get_contract_info(self) -> dict:
        """Get live contract stats"""
        try:
            return {
                "address":      CONTRACT_ADDRESS,
                "total_supply": self.contract.functions.totalSupply().call() / 10**18,
                "paused":       self.contract.functions.paused().call(),
                "oracle_count": self.contract.functions.oracleCount().call(),
            }
        except Exception as e:
            return {"error": str(e)}

    def get_health_report(self) -> dict:
        return {
            p.name: {
                "state":          p.state.value,
                "failures":       p.failures,
                "avg_latency_ms": p.avg_latency_ms
            }
            for p in self.providers
        }


# ─── Test ───
async def _test():
    bridge = Web3Bridge()
    bridge.start_background_ping()

    print("\n[ContractInfo]", json.dumps(bridge.get_contract_info(), indent=2))

    result = await bridge.mint_eco_coin(
        wallet_address=WALLET_ADDR,
        proof_fingerprint="a" * 64,
        co2_tonnes=0.0025
    )

    if result:
        print(f"\n✅ Track B Result:")
        print(f"  Off-chain proof : {result['off_chain_proof_id'][:24]}...")
        print(f"  On-chain TX     : {result['on_chain_tx'] or 'Pending oracle setup'}")
        print(f"  Block           : {result['block_number']}")
        print(f"  ECOX amount     : {result['ecox_amount']:.4f} ECOX")
        print(f"  Provider        : {result['provider_used']}")
    else:
        print("\n❌ Track B FAILED")

    print("\nProvider Health:")
    print(json.dumps(bridge.get_health_report(), indent=2))


if __name__ == "__main__":
    asyncio.run(_test())