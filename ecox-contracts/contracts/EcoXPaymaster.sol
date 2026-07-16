// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Day 22 — EcoX Paymaster (ERC-4337)
 * Sponsors gas fees for EcoX users.
 * Users submit carbon proofs without needing MATIC.
 * Paymaster pays gas on their behalf.
 *
 * Security: Only pre-authorized EcoCoin contract functions
 * can be sponsored — prevents total fund drain.
 */

interface IEntryPoint {
    function depositTo(address account) external payable;
    function balanceOf(address account) external view returns (uint256);
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;
}

contract EcoXPaymaster {

    // ─── Errors ───
    error NotOwner();
    error NotEntryPoint();
    error InsufficientDeposit();
    error UnauthorizedTarget();
    error ZeroAddress();

    // ─── State ───
    address public owner;
    address public immutable entryPoint;
    address public ecoCoinContract;

    // Authorized function selectors (only these can be gas-sponsored)
    // mintFromAI(address,uint256,bytes32)
    bytes4 public constant MINT_FROM_AI_SELECTOR =
        bytes4(keccak256("mintFromAI(address,uint256,bytes32,uint256)"));

    // approveMint(address,uint256,bytes32)
    bytes4 public constant APPROVE_MINT_SELECTOR =
        bytes4(keccak256("approveMint(address,uint256,bytes32)"));

    // mintEcoRewardWithZkProof(address,uint256,bytes32,bytes32,(uint256[2],uint256[2][2],uint256[2]))
    bytes4 public constant ZK_MINT_SELECTOR =
        bytes4(keccak256("mintEcoRewardWithZkProof(address,uint256,bytes32,bytes32,(uint256[2],uint256[2][2],uint256[2]))"));

    // Max gas per UserOperation we will sponsor
    uint256 public constant MAX_GAS_SPONSORED = 300_000;

    // Minimum deposit to keep Paymaster active
    uint256 public constant MIN_DEPOSIT = 0.01 ether;

    // Events
    event GasSponsored(address indexed user, bytes4 selector, uint256 gasUsed);
    event DepositAdded(uint256 amount);
    event EcoCoinContractSet(address indexed contractAddr);

    // ─── Modifiers ───
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert NotEntryPoint();
        _;
    }

    // ─── Constructor ───
    constructor(address _entryPoint, address _ecoCoinContract) {
        if (_entryPoint == address(0))     revert ZeroAddress();
        if (_ecoCoinContract == address(0)) revert ZeroAddress();

        owner            = msg.sender;
        entryPoint       = _entryPoint;
        ecoCoinContract  = _ecoCoinContract;
    }

    // ─── Owner Functions ───

    function setEcoCoinContract(address _contract) external onlyOwner {
        if (_contract == address(0)) revert ZeroAddress();
        ecoCoinContract = _contract;
        emit EcoCoinContractSet(_contract);
    }

    function deposit() external payable onlyOwner {
        if (msg.value == 0) revert InsufficientDeposit();
        IEntryPoint(entryPoint).depositTo{value: msg.value}(address(this));
        emit DepositAdded(msg.value);
    }

    function withdraw(uint256 amount) external onlyOwner {
        IEntryPoint(entryPoint).withdrawTo(payable(owner), amount);
    }

    function getDeposit() external view returns (uint256) {
        return IEntryPoint(entryPoint).balanceOf(address(this));
    }

    // ─── ERC-4337 Core: validatePaymasterUserOp ───

    /**
     * Called by EntryPoint before executing a UserOperation.
     * We approve sponsorship ONLY if:
     *   1. Target is our EcoCoin contract
     *   2. Function selector is one of our authorized mint functions
     *   3. We have enough deposit
     *
     * Security: Paymaster is LIMITED to EcoCoin functions only.
     * Even if Paymaster key is compromised, attacker cannot
     * drain funds to arbitrary contracts.
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /*userOpHash*/,
        uint256 maxCost
    ) external onlyEntryPoint returns (bytes memory context, uint256 validationData) {

        // Check deposit is sufficient
        uint256 deposit = IEntryPoint(entryPoint).balanceOf(address(this));
        if (deposit < maxCost + MIN_DEPOSIT) {
            return ("", 1); // 1 = reject
        }

        // Check gas limit
        if (userOp.callGasLimit > MAX_GAS_SPONSORED) {
            return ("", 1);
        }

        // Decode the call target and selector
        (address target, bytes memory callData) = _decodeCall(userOp.callData);

        // Security: Only sponsor calls to EcoCoin contract
        if (target != ecoCoinContract) revert UnauthorizedTarget();

        // Security: Only sponsor authorized mint functions
        bytes4 selector = bytes4(callData);
        if (
            selector != MINT_FROM_AI_SELECTOR &&
            selector != APPROVE_MINT_SELECTOR &&
            selector != ZK_MINT_SELECTOR
        ) {
            revert UnauthorizedTarget();
        }

        // Approved — sponsor this transaction
        return (abi.encode(msg.sender, selector), 0);
    }

    /**
     * Called after UserOperation executes.
     * We emit an event for tracking.
     */
    function postOp(
        PostOpMode /*mode*/,
        bytes calldata context,
        uint256 actualGasCost
    ) external onlyEntryPoint {
        (address user, bytes4 selector) = abi.decode(context, (address, bytes4));
        emit GasSponsored(user, selector, actualGasCost);
    }

    // ─── Internal Helpers ───

    function _decodeCall(bytes calldata callData)
        internal pure
        returns (address target, bytes memory innerCallData)
    {
        // ERC-4337 callData format:
        // execute(address target, uint256 value, bytes calldata data)
        // selector = first 4 bytes
        if (callData.length < 4 + 32 + 32 + 32) {
            return (address(0), "");
        }
        // Skip 4-byte selector + decode first param (target address)
        target        = address(uint160(uint256(bytes32(callData[4:36]))));
        innerCallData = callData[100:]; // skip value param too
    }

    // ─── Receive ETH ───
    receive() external payable {}
}

// ─── Structs (ERC-4337 standard) ───

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes   initCode;
    bytes   callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes   paymasterAndData;
    bytes   signature;
}

enum PostOpMode {
    opSucceeded,
    opReverted,
    postOpReverted
}
