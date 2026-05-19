// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title KairoPolicy
 * @notice Immutable, on-chain registry of agent policies. Wallets register a
 *         policy per (wallet, agentId) that bounds what their autonomous agent
 *         can do. The policy is the source of truth; the off-chain engine reads
 *         from here and refuses to forward any action that exceeds these rules.
 *
 *         v1 stores universal rules (mode, spend cap, daily cap, allowed pools
 *         and gauges) plus Aerodrome-specific LP rules (APR delta threshold,
 *         IL tolerance, auto-claim limit). Future protocol-specific rule
 *         packages can be added as new struct fields without breaking existing
 *         policies (storage layout is append-only).
 *
 *         Non-custodial by design: this contract holds nothing. It is a
 *         registry of intent. Funds stay in the user's wallet.
 */
contract KairoPolicy {
    /* -------------------------------------------------------------------------- */
    /*                                   Types                                    */
    /* -------------------------------------------------------------------------- */

    enum Mode {
        ASK_EVERY_TIME,
        ALLOW_UNDER_LIMITS,
        BLOCK
    }

    /// @dev Aerodrome-specific rule slice. Optional per policy.
    struct AerodromeRules {
        /// @notice Min projected APR delta required for auto-rebalance, in basis points.
        uint32 minAprDeltaBps;
        /// @notice Max tolerable simulated impermanent loss, in basis points.
        uint32 maxImpermanentLossBps;
        /// @notice Reward claims under this USD amount (6dp) auto-approve.
        uint256 autoClaimUpToUsd6;
        /// @notice Pools the agent may touch. Empty = no allowlist.
        address[] poolAllowlist;
        /// @notice Gauges the agent may vote for. Empty = no allowlist.
        address[] gaugeAllowlist;
    }

    struct Policy {
        bool exists;
        Mode mode;
        bool active;
        bool revoked;
        /// @notice Max spend per single action, in USDC atomic units (6dp).
        uint256 maxSpendUsd6;
        /// @notice Rolling 24h spend cap, in USDC atomic units (6dp).
        uint256 dailyCapUsd6;
        /// @notice Unix seconds after which this policy expires. 0 = never.
        uint64 expiresAt;
        /// @notice Block at which this policy was last updated. Used to detect stale
        ///         off-chain caches.
        uint256 updatedAtBlock;
        AerodromeRules aerodrome;
    }

    /* -------------------------------------------------------------------------- */
    /*                                   Storage                                  */
    /* -------------------------------------------------------------------------- */

    /// @notice (wallet, agentId) -> policy. agentId is keccak256("steward") etc.
    mapping(address => mapping(bytes32 => Policy)) internal policies;

    /// @notice Lifetime counter of policy updates. Useful for indexer cursors.
    uint256 public totalUpdates;

    /* -------------------------------------------------------------------------- */
    /*                                   Events                                   */
    /* -------------------------------------------------------------------------- */

    event PolicySet(
        address indexed wallet,
        bytes32 indexed agentId,
        Mode mode,
        uint256 maxSpendUsd6,
        uint256 dailyCapUsd6,
        uint64 expiresAt,
        uint256 updatedAtBlock
    );

    event PolicyRevoked(
        address indexed wallet,
        bytes32 indexed agentId,
        uint256 updatedAtBlock
    );

    event PolicyReinstated(
        address indexed wallet,
        bytes32 indexed agentId,
        uint256 updatedAtBlock
    );

    /* -------------------------------------------------------------------------- */
    /*                                   Errors                                   */
    /* -------------------------------------------------------------------------- */

    error PolicyNotFound();
    error PolicyExpired();
    error InvalidPolicy();

    /* -------------------------------------------------------------------------- */
    /*                                  Mutations                                 */
    /* -------------------------------------------------------------------------- */

    /// @notice Create or replace the caller's policy for `agentId`.
    /// @dev Anyone can call this for themselves. Funds are not at risk.
    function setPolicy(
        bytes32 agentId,
        Mode mode,
        uint256 maxSpendUsd6,
        uint256 dailyCapUsd6,
        uint64 expiresAt,
        AerodromeRules calldata aero
    ) external {
        if (maxSpendUsd6 == 0 && mode != Mode.BLOCK) revert InvalidPolicy();
        if (dailyCapUsd6 < maxSpendUsd6) revert InvalidPolicy();

        Policy storage p = policies[msg.sender][agentId];
        p.exists = true;
        p.mode = mode;
        p.active = true;
        p.revoked = false;
        p.maxSpendUsd6 = maxSpendUsd6;
        p.dailyCapUsd6 = dailyCapUsd6;
        p.expiresAt = expiresAt;
        p.updatedAtBlock = block.number;
        p.aerodrome = aero;

        unchecked {
            ++totalUpdates;
        }

        emit PolicySet(
            msg.sender,
            agentId,
            mode,
            maxSpendUsd6,
            dailyCapUsd6,
            expiresAt,
            block.number
        );
    }

    /// @notice Revoke this agent's authority. Off-chain engine refuses to forward.
    function revoke(bytes32 agentId) external {
        Policy storage p = policies[msg.sender][agentId];
        if (!p.exists) revert PolicyNotFound();
        p.revoked = true;
        p.active = false;
        p.updatedAtBlock = block.number;

        unchecked {
            ++totalUpdates;
        }

        emit PolicyRevoked(msg.sender, agentId, block.number);
    }

    /// @notice Re-activate a previously-revoked policy without changing its rules.
    function reinstate(bytes32 agentId) external {
        Policy storage p = policies[msg.sender][agentId];
        if (!p.exists) revert PolicyNotFound();
        p.revoked = false;
        p.active = true;
        p.updatedAtBlock = block.number;

        unchecked {
            ++totalUpdates;
        }

        emit PolicyReinstated(msg.sender, agentId, block.number);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    Reads                                   */
    /* -------------------------------------------------------------------------- */

    /// @notice Return the full policy for (wallet, agentId).
    function getPolicy(
        address wallet,
        bytes32 agentId
    ) external view returns (Policy memory) {
        return policies[wallet][agentId];
    }

    /// @notice True if the policy is set, active, and not expired.
    function isActive(
        address wallet,
        bytes32 agentId
    ) external view returns (bool) {
        Policy storage p = policies[wallet][agentId];
        if (!p.exists || p.revoked || !p.active) return false;
        if (p.expiresAt != 0 && uint64(block.timestamp) >= p.expiresAt) return false;
        return true;
    }

    /// @notice Convenience accessor for the universal rules.
    function getCaps(
        address wallet,
        bytes32 agentId
    )
        external
        view
        returns (
            uint8 mode,
            uint256 maxSpendUsd6,
            uint256 dailyCapUsd6,
            uint64 expiresAt,
            bool active
        )
    {
        Policy storage p = policies[wallet][agentId];
        if (!p.exists) revert PolicyNotFound();
        bool stillActive =
            p.active && !p.revoked && (p.expiresAt == 0 || uint64(block.timestamp) < p.expiresAt);
        return (
            uint8(p.mode),
            p.maxSpendUsd6,
            p.dailyCapUsd6,
            p.expiresAt,
            stillActive
        );
    }

    /// @notice Helper: hash an agent identifier string (e.g. "steward") to bytes32.
    /// @dev Pure helper to keep clients and indexers aligned on the agentId encoding.
    function agentId(string calldata name) external pure returns (bytes32) {
        return keccak256(bytes(name));
    }
}
