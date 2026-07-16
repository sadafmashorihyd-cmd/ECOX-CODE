// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IZkVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata input
    ) external view returns (bool);
}

interface IQuantumLock {
    function recordContribution(
        address user,
        uint256 mintAmount,
        uint256 co2NanoGrams
    ) external;
}

contract EcoCoin is ERC20, ERC20Burnable, Ownable2Step, ReentrancyGuard, Pausable {

    error ZeroAddressForbidden();
    error UnauthorizedOracle();
    error DuplicateActionHash();
    error InvalidZeroKnowledgeProof();
    error ExceedsMaxSupplyCeiling();
    error ExceedsMaxPerMintLimit();
    error ApprovalExpiredError();
    error RateLimitExceeded(address wallet, uint256 dailyCount);
    error ConfidenceScoreTooLow(uint256 score, uint256 minimum);
    error MultisigRequired();
    error InsufficientMultisigApprovals(uint256 got, uint256 needed);

    uint256 public constant BURN_TAX_BPS       = 100;
    uint256 public constant BPS_DENOMINATOR    = 10000;
    uint256 public constant MAX_SUPPLY         = 500_000_000 * 10**18;
    uint256 public constant MAX_PER_MINT       = 50_000 * 10**18;
    uint256 public constant APPROVAL_TIMEOUT   = 1 hours;
    uint256 public constant REQUIRED_APPROVALS = 2;
    uint256 public constant MAX_MINTS_PER_DAY  = 10;
    uint256 public constant DAY_IN_SECONDS     = 86400;
    uint256 public constant MIN_CONFIDENCE_BPS = 9000;
    uint256 public constant MULTISIG_THRESHOLD = 2;

    mapping(address => mapping(uint256 => uint256)) private _dailyMintCount;

    uint256 public minConfidenceBps = MIN_CONFIDENCE_BPS;
    mapping(bytes32 => uint256) public actionConfidenceScore;

    struct GovernanceAction {
        bytes32 actionHash;
        uint256 approvalCount;
        uint256 createdAt;
        bool    executed;
        mapping(address => bool) hasApproved;
    }
    mapping(bytes32 => GovernanceAction) private _governanceActions;

    mapping(address => bool) public authorizedOracles;
    uint256 public oracleCount;

    // QuantumLock 2050 connection
    address public quantumLockAddress;
    mapping(bytes32 => uint256) public actionCO2NanoGrams;

    event QuantumLockUpdated(address indexed oldAddr, address indexed newAddr);
    event ContributionSentToQuantumLock(address indexed user, uint256 amount, uint256 co2);

    struct ZkProof {
        uint256[2]    a;
        uint256[2][2] b;
        uint256[2]    c;
    }

    address public zkVerifierAddress;

    mapping(address => bool)    private _isExemptFromTax;
    mapping(bytes32 => bool)    private _processedImageHashes;
    mapping(bytes32 => uint256) private _mintApprovals;
    mapping(bytes32 => mapping(address => bool)) private _hasApproved;
    mapping(bytes32 => uint256) private _approvalExpiry;

    event EcoRewardMinted(address indexed recipient, uint256 amount, bytes32 indexed imageHash, uint256 confidenceScore);
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event ZkVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event MintApproved(bytes32 indexed actionId, address indexed oracle, uint256 approvals);
    event ApprovalExpired(bytes32 indexed actionId);
    event RateLimitHit(address indexed wallet, uint256 dailyCount);
    event GovernanceActionProposed(bytes32 indexed actionHash);
    event GovernanceActionExecuted(bytes32 indexed actionHash);
    event MinConfidenceUpdated(uint256 oldMin, uint256 newMin);

    constructor(address initialOwner)
        ERC20("EcoCoin", "ECOX")
        Ownable(initialOwner)
    {}

    function setQuantumLock(address _quantumLock) external onlyOwner {
        if (_quantumLock == address(0)) revert ZeroAddressForbidden();
        address old = quantumLockAddress;
        quantumLockAddress = _quantumLock;
        emit QuantumLockUpdated(old, _quantumLock);
    }

    function _sendToQuantumLock(
        address recipient,
        uint256 mintAmount,
        uint256 co2NanoGrams
    ) internal {
        if (quantumLockAddress == address(0)) return;
        try IQuantumLock(quantumLockAddress).recordContribution(
            recipient, mintAmount, co2NanoGrams
        ) {
            emit ContributionSentToQuantumLock(recipient, mintAmount, co2NanoGrams);
        } catch {}
    }

    function addOracle(address oracle) external onlyOwner {
        if (oracle == address(0)) revert ZeroAddressForbidden();
        if (!authorizedOracles[oracle]) {
            authorizedOracles[oracle] = true;
            _isExemptFromTax[oracle]  = true;
            oracleCount++;
            emit OracleAdded(oracle);
        }
    }

    function removeOracle(address oracle) external onlyOwner {
        if (authorizedOracles[oracle]) {
            authorizedOracles[oracle] = false;
            _isExemptFromTax[oracle]  = false;
            oracleCount--;
            emit OracleRemoved(oracle);
        }
    }

    function setZkVerifier(address newVerifier) external onlyOwner {
        if (newVerifier == address(0)) revert ZeroAddressForbidden();
        address old = zkVerifierAddress;
        zkVerifierAddress = newVerifier;
        emit ZkVerifierUpdated(old, newVerifier);
    }

    function proposeMinConfidenceUpdate(uint256 newMinBps) external {
        if (!authorizedOracles[msg.sender]) revert UnauthorizedOracle();
        bytes32 actionHash = keccak256(
            abi.encodePacked("setMinConfidence", newMinBps, block.timestamp / DAY_IN_SECONDS)
        );
        GovernanceAction storage action = _governanceActions[actionHash];
        if (action.createdAt == 0) {
            action.actionHash = actionHash;
            action.createdAt  = block.timestamp;
            emit GovernanceActionProposed(actionHash);
        }
        if (!action.hasApproved[msg.sender]) {
            action.hasApproved[msg.sender] = true;
            action.approvalCount++;
        }
        if (action.approvalCount >= MULTISIG_THRESHOLD && !action.executed) {
            action.executed  = true;
            uint256 old      = minConfidenceBps;
            minConfidenceBps = newMinBps;
            emit MinConfidenceUpdated(old, newMinBps);
            emit GovernanceActionExecuted(actionHash);
        }
    }

    function _checkAndUpdateRateLimit(address wallet) internal {
        uint256 today = block.timestamp / DAY_IN_SECONDS;
        uint256 count = _dailyMintCount[wallet][today];
        if (count >= MAX_MINTS_PER_DAY) {
            emit RateLimitHit(wallet, count);
            revert RateLimitExceeded(wallet, count);
        }
        _dailyMintCount[wallet][today]++;
    }

    function getDailyMintCount(address wallet) external view returns (uint256) {
        uint256 today = block.timestamp / DAY_IN_SECONDS;
        return _dailyMintCount[wallet][today];
    }

    function _checkConfidence(bytes32 actionId, uint256 confidenceBps) internal {
        if (confidenceBps < minConfidenceBps)
            revert ConfidenceScoreTooLow(confidenceBps, minConfidenceBps);
        actionConfidenceScore[actionId] = confidenceBps;
    }

    function approveMint(
        address recipient,
        uint256 amount,
        bytes32 actionId
    ) external nonReentrant whenNotPaused {
        if (!authorizedOracles[msg.sender]) revert UnauthorizedOracle();
        if (recipient == address(0))         revert ZeroAddressForbidden();
        if (amount > MAX_PER_MINT)           revert ExceedsMaxPerMintLimit();
        if (_processedImageHashes[actionId]) revert DuplicateActionHash();
        if (_hasApproved[actionId][msg.sender]) return;

        if (_approvalExpiry[actionId] != 0 &&
            block.timestamp > _approvalExpiry[actionId]) {
            _mintApprovals[actionId]  = 0;
            _approvalExpiry[actionId] = 0;
            emit ApprovalExpired(actionId);
        }
        if (_mintApprovals[actionId] == 0)
            _approvalExpiry[actionId] = block.timestamp + APPROVAL_TIMEOUT;

        _hasApproved[actionId][msg.sender] = true;
        _mintApprovals[actionId]++;
        emit MintApproved(actionId, msg.sender, _mintApprovals[actionId]);

        if (_mintApprovals[actionId] >= REQUIRED_APPROVALS) {
            if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupplyCeiling();
            _checkAndUpdateRateLimit(recipient);
            _processedImageHashes[actionId] = true;
            _mint(recipient, amount);
            _sendToQuantumLock(recipient, amount, actionCO2NanoGrams[actionId]);
            emit EcoRewardMinted(recipient, amount, actionId, 10000);
        }
    }

    function mintFromAI(
        address recipient,
        uint256 amount,
        bytes32 actionId,
        uint256 confidenceBps
    ) external nonReentrant whenNotPaused {
        if (!authorizedOracles[msg.sender]) revert UnauthorizedOracle();
        if (recipient == address(0))         revert ZeroAddressForbidden();
        if (amount > MAX_PER_MINT)           revert ExceedsMaxPerMintLimit();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupplyCeiling();
        if (_processedImageHashes[actionId]) revert DuplicateActionHash();

        _checkConfidence(actionId, confidenceBps);
        _checkAndUpdateRateLimit(recipient);

        _processedImageHashes[actionId] = true;
        _mint(recipient, amount);

        uint256 co2Nano = amount / 1000;
        _sendToQuantumLock(recipient, amount, co2Nano);

        emit EcoRewardMinted(recipient, amount, actionId, confidenceBps);
    }

    function mintEcoRewardWithZkProof(
        address recipient,
        uint256 amount,
        bytes32 imageHash,
        bytes32 nullifier,
        ZkProof calldata proof,
        uint256 confidenceBps
    ) external nonReentrant whenNotPaused {
        if (!authorizedOracles[msg.sender]) revert UnauthorizedOracle();
        if (recipient == address(0))         revert ZeroAddressForbidden();
        if (amount > MAX_PER_MINT)           revert ExceedsMaxPerMintLimit();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupplyCeiling();
        if (_processedImageHashes[imageHash]) revert DuplicateActionHash();

        _checkConfidence(imageHash, confidenceBps);
        _checkAndUpdateRateLimit(recipient);

        if (zkVerifierAddress != address(0)) {
            uint256[2] memory publicInput = [uint256(imageHash), uint256(nullifier)];
            bool isValid = IZkVerifier(zkVerifierAddress).verifyProof(
                proof.a, proof.b, proof.c, publicInput
            );
            if (!isValid) revert InvalidZeroKnowledgeProof();
        }

        _processedImageHashes[imageHash] = true;
        _mint(recipient, amount);
        _sendToQuantumLock(recipient, amount, amount / 1000);
        emit EcoRewardMinted(recipient, amount, imageHash, confidenceBps);
    }

    function proposePause() external {
        if (!authorizedOracles[msg.sender]) revert UnauthorizedOracle();
        bytes32 actionHash = keccak256(abi.encodePacked("pause", block.timestamp / 3600));
        GovernanceAction storage action = _governanceActions[actionHash];
        if (action.createdAt == 0) {
            action.createdAt = block.timestamp;
            emit GovernanceActionProposed(actionHash);
        }
        if (!action.hasApproved[msg.sender]) {
            action.hasApproved[msg.sender] = true;
            action.approvalCount++;
        }
        if (action.approvalCount >= MULTISIG_THRESHOLD && !action.executed) {
            action.executed = true;
            _pause();
            emit GovernanceActionExecuted(actionHash);
        }
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _update(address from, address to, uint256 value)
        internal override(ERC20)
    {
        if (
            from == address(0) ||
            to   == address(0) ||
            _isExemptFromTax[from] ||
            _isExemptFromTax[to]
        ) {
            super._update(from, to, value);
            return;
        }
        uint256 burnAmount = (value * BURN_TAX_BPS) / BPS_DENOMINATOR;
        uint256 sendAmount = value - burnAmount;
        _burn(from, burnAmount);
        super._update(from, to, sendAmount);
    }
}
