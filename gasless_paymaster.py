"""
Day 22 — ERC-4337 Paymaster Manager (Python side)
Handles UserOperation creation and submission
User ko gas fees ka pata nahi chalega
"""

import os
import json
import hashlib
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct
from dotenv import load_dotenv

load_dotenv()
PIMLICO_API_KEY = os.getenv("PIMLICO_API_KEY")
BUNDLER_URL     = f"https://api.pimlico.io/v2/80002/rpc?apikey={PIMLICO_API_KEY}"
PRIVATE_KEY     = os.getenv("ORACLE_PRIVATE_KEY")
WALLET_ADDR     = os.getenv("ADMIN_WALLET_ADDRESS")
CHAIN_ID        = int(os.getenv("CHAIN_ID", 80002))
ECOX_CONTRACT   = "0xc26A215ada91C7A51001a2c11B5348D532B28c93"

ENTRY_POINT_V06 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"

w3 = Web3(Web3.HTTPProvider('https://rpc-amoy.polygon.technology'))


class UserOperationBuilder:

    def __init__(self):
        self.entry_point = ENTRY_POINT_V06

    def build_mint_userop(
        self,
        sender_wallet: str,
        recipient: str,
        co2_tonnes: float,
        proof_fingerprint: str,
        confidence_bps: int = 9500,
        paymaster_address: str = None
    ) -> dict:

        abi_path = os.path.join(
            "ecox-contracts", "artifacts", "contracts",
            "EcoCoin.sol", "EcoCoin.json"
        )
        with open(abi_path) as f:
            abi = json.load(f)["abi"]

        contract = w3.eth.contract(
            address=Web3.to_checksum_address(ECOX_CONTRACT),
            abi=abi
        )

        ecox_amount = int(co2_tonnes * 1000 * 10**18)
        action_id   = bytes.fromhex(proof_fingerprint[:64])

        # Fix: mintFromAI now takes 4 arguments (with confidence_bps)
        call_data = contract.encode_abi(
            "mintFromAI",
            args=[
                Web3.to_checksum_address(recipient),
                ecox_amount,
                action_id,
                confidence_bps
            ]
        )

        nonce = self._get_nonce(sender_wallet)

        user_op = {
            "sender":               Web3.to_checksum_address(sender_wallet),
            "nonce":                hex(nonce),
            "initCode":             "0x",
            "callData":             call_data.hex() if isinstance(call_data, bytes) else call_data,
            "callGasLimit":         hex(200000),
            "verificationGasLimit": hex(100000),
            "preVerificationGas":   hex(21000),
            "maxFeePerGas":         hex(w3.eth.gas_price),
            "maxPriorityFeePerGas": hex(w3.to_wei(1, "gwei")),
            "paymasterAndData":     paymaster_address or "0x",
            "signature":            "0x"
        }

        return user_op

    def _get_nonce(self, sender: str) -> int:
        try:
            entry_abi = [{
                "inputs": [
                    {"name": "sender", "type": "address"},
                    {"name": "key",    "type": "uint192"}
                ],
                "name": "getNonce",
                "outputs": [{"name": "", "type": "uint256"}],
                "type": "function"
            }]
            entry_contract = w3.eth.contract(
                address=Web3.to_checksum_address(self.entry_point),
                abi=entry_abi
            )
            return entry_contract.functions.getNonce(
                Web3.to_checksum_address(sender), 0
            ).call()
        except Exception:
            return w3.eth.get_transaction_count(
                Web3.to_checksum_address(sender)
            )

    def sign_user_op(self, user_op: dict, private_key: str) -> dict:
        user_op_hash = self._hash_user_op(user_op)
        message      = encode_defunct(hexstr=user_op_hash)
        signed       = Account.sign_message(message, private_key=private_key)
        user_op["signature"] = "0x" + signed.signature.hex()
        return user_op

    def _hash_user_op(self, user_op: dict) -> str:
        packed = (
            f"{user_op['sender']}"
            f"{user_op['nonce']}"
            f"{user_op['callData']}"
            f"{user_op['callGasLimit']}"
            f"{user_op['maxFeePerGas']}"
        )
        return "0x" + hashlib.sha256(packed.encode()).hexdigest()


class PaymasterStatus:

    @staticmethod
    def check_entry_point() -> dict:
        code = w3.eth.get_code(Web3.to_checksum_address(ENTRY_POINT_V06))
        return {
            "entry_point": ENTRY_POINT_V06,
            "deployed":    len(code) > 2,
            "code_size":   len(code),
            "network":     "Polygon Amoy",
            "chain_id":    CHAIN_ID
        }

    @staticmethod
    def get_gasless_flow() -> dict:
        return {
            "step_1":   "User submits carbon proof (no MATIC needed)",
            "step_2":   "UserOperation built by EcoX backend",
            "step_3":   "Bundler (Pimlico) picks up UserOperation",
            "step_4":   "Paymaster validates + sponsors gas",
            "step_5":   "EntryPoint executes mintFromAI",
            "step_6":   "User receives ECOX — never touched MATIC",
            "bundler":  BUNDLER_URL[:50] + "...",
            "security": "Paymaster only sponsors EcoCoin functions",
        }


if __name__ == "__main__":

    print("\n[ERC-4337] Checking EntryPoint...")
    status = PaymasterStatus.check_entry_point()
    print(json.dumps(status, indent=2))

    print("\n[ERC-4337] Gasless flow:")
    flow = PaymasterStatus.get_gasless_flow()
    for k, v in flow.items():
        print(f"  {k}: {v}")

    print("\n[ERC-4337] Building sample UserOperation...")
    builder = UserOperationBuilder()
    user_op = builder.build_mint_userop(
        sender_wallet=WALLET_ADDR,
        recipient=WALLET_ADDR,
        co2_tonnes=0.0025,
        proof_fingerprint="a" * 64,
        confidence_bps=9500
    )

    print("\nUserOperation:")
    print(f"  sender           : {user_op['sender'][:16]}...")
    print(f"  nonce            : {user_op['nonce']}")
    print(f"  callGasLimit     : {user_op['callGasLimit']}")
    print(f"  maxFeePerGas     : {user_op['maxFeePerGas']}")
    print(f"  paymasterAndData : {user_op['paymasterAndData']}")
    print(f"  callData         : {user_op['callData'][:24]}...")

    if PRIVATE_KEY:
        user_op = builder.sign_user_op(user_op, PRIVATE_KEY)
        print(f"  signature        : {user_op['signature'][:24]}...")
        print("\n✅ UserOperation built and signed!")
    else:
        print("\n⚠️  No PRIVATE_KEY — skipping signature")