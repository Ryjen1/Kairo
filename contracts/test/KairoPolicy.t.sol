// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {KairoPolicy} from "../src/KairoPolicy.sol";

contract KairoPolicyTest is Test {
    KairoPolicy internal kairo;

    address internal mei = address(0xBeef);
    address internal bob = address(0xCafe);
    bytes32 internal stewardId;

    function setUp() public {
        kairo = new KairoPolicy();
        stewardId = kairo.agentId("steward");
    }

    function _emptyAero()
        internal
        pure
        returns (KairoPolicy.AerodromeRules memory)
    {
        return
            KairoPolicy.AerodromeRules({
                minAprDeltaBps: 400,
                maxImpermanentLossBps: 200,
                autoClaimUpToUsd6: 50_000_000, // 50 USDC
                poolAllowlist: new address[](0),
                gaugeAllowlist: new address[](0)
            });
    }

    function _setBasicPolicy() internal {
        vm.prank(mei);
        kairo.setPolicy(
            stewardId,
            KairoPolicy.Mode.ALLOW_UNDER_LIMITS,
            250_000_000, // $250
            1_000_000_000, // $1,000
            0,
            _emptyAero()
        );
    }

    function test_setPolicy_emitsAndStores() public {
        vm.prank(mei);
        vm.expectEmit(true, true, false, true);
        emit KairoPolicy.PolicySet(
            mei,
            stewardId,
            KairoPolicy.Mode.ALLOW_UNDER_LIMITS,
            250_000_000,
            1_000_000_000,
            0,
            block.number
        );

        kairo.setPolicy(
            stewardId,
            KairoPolicy.Mode.ALLOW_UNDER_LIMITS,
            250_000_000,
            1_000_000_000,
            0,
            _emptyAero()
        );

        KairoPolicy.Policy memory p = kairo.getPolicy(mei, stewardId);
        assertTrue(p.exists);
        assertTrue(p.active);
        assertFalse(p.revoked);
        assertEq(p.maxSpendUsd6, 250_000_000);
        assertEq(p.dailyCapUsd6, 1_000_000_000);
        assertEq(uint8(p.mode), uint8(KairoPolicy.Mode.ALLOW_UNDER_LIMITS));
        assertEq(p.aerodrome.minAprDeltaBps, 400);
    }

    function test_isActive_returnsTrue_whenFresh() public {
        _setBasicPolicy();
        assertTrue(kairo.isActive(mei, stewardId));
    }

    function test_isActive_returnsFalse_whenRevoked() public {
        _setBasicPolicy();
        vm.prank(mei);
        kairo.revoke(stewardId);
        assertFalse(kairo.isActive(mei, stewardId));
    }

    function test_isActive_returnsFalse_whenExpired() public {
        vm.warp(1000);
        vm.prank(mei);
        kairo.setPolicy(
            stewardId,
            KairoPolicy.Mode.ALLOW_UNDER_LIMITS,
            250_000_000,
            1_000_000_000,
            uint64(block.timestamp + 100),
            _emptyAero()
        );
        assertTrue(kairo.isActive(mei, stewardId));

        vm.warp(block.timestamp + 200);
        assertFalse(kairo.isActive(mei, stewardId));
    }

    function test_revoke_emitsEvent() public {
        _setBasicPolicy();
        vm.prank(mei);
        vm.expectEmit(true, true, false, true);
        emit KairoPolicy.PolicyRevoked(mei, stewardId, block.number);
        kairo.revoke(stewardId);
    }

    function test_revoke_reverts_whenNoPolicy() public {
        vm.prank(mei);
        vm.expectRevert(KairoPolicy.PolicyNotFound.selector);
        kairo.revoke(stewardId);
    }

    function test_reinstate_restoresActive() public {
        _setBasicPolicy();
        vm.prank(mei);
        kairo.revoke(stewardId);
        assertFalse(kairo.isActive(mei, stewardId));

        vm.prank(mei);
        kairo.reinstate(stewardId);
        assertTrue(kairo.isActive(mei, stewardId));
    }

    function test_setPolicy_rejectsZeroCapInNonBlockMode() public {
        vm.prank(mei);
        vm.expectRevert(KairoPolicy.InvalidPolicy.selector);
        kairo.setPolicy(
            stewardId,
            KairoPolicy.Mode.ALLOW_UNDER_LIMITS,
            0,
            1_000_000_000,
            0,
            _emptyAero()
        );
    }

    function test_setPolicy_acceptsZeroCapInBlockMode() public {
        vm.prank(mei);
        kairo.setPolicy(stewardId, KairoPolicy.Mode.BLOCK, 0, 0, 0, _emptyAero());
        KairoPolicy.Policy memory p = kairo.getPolicy(mei, stewardId);
        assertEq(uint8(p.mode), uint8(KairoPolicy.Mode.BLOCK));
    }

    function test_setPolicy_rejectsDailyCapBelowPerActionCap() public {
        vm.prank(mei);
        vm.expectRevert(KairoPolicy.InvalidPolicy.selector);
        kairo.setPolicy(
            stewardId,
            KairoPolicy.Mode.ALLOW_UNDER_LIMITS,
            500_000_000,
            100_000_000,
            0,
            _emptyAero()
        );
    }

    function test_isolation_betweenWallets() public {
        _setBasicPolicy();
        assertTrue(kairo.isActive(mei, stewardId));
        assertFalse(kairo.isActive(bob, stewardId));
    }

    function test_totalUpdates_increments() public {
        assertEq(kairo.totalUpdates(), 0);
        _setBasicPolicy();
        assertEq(kairo.totalUpdates(), 1);
        vm.prank(mei);
        kairo.revoke(stewardId);
        assertEq(kairo.totalUpdates(), 2);
        vm.prank(mei);
        kairo.reinstate(stewardId);
        assertEq(kairo.totalUpdates(), 3);
    }

    function test_aerodromeRules_storedCorrectly() public {
        address[] memory pools = new address[](2);
        pools[0] = address(0xA1);
        pools[1] = address(0xA2);
        address[] memory gauges = new address[](1);
        gauges[0] = address(0xB1);

        vm.prank(mei);
        kairo.setPolicy(
            stewardId,
            KairoPolicy.Mode.ALLOW_UNDER_LIMITS,
            250_000_000,
            1_000_000_000,
            0,
            KairoPolicy.AerodromeRules({
                minAprDeltaBps: 600,
                maxImpermanentLossBps: 150,
                autoClaimUpToUsd6: 100_000_000,
                poolAllowlist: pools,
                gaugeAllowlist: gauges
            })
        );

        KairoPolicy.Policy memory p = kairo.getPolicy(mei, stewardId);
        assertEq(p.aerodrome.minAprDeltaBps, 600);
        assertEq(p.aerodrome.maxImpermanentLossBps, 150);
        assertEq(p.aerodrome.autoClaimUpToUsd6, 100_000_000);
        assertEq(p.aerodrome.poolAllowlist.length, 2);
        assertEq(p.aerodrome.poolAllowlist[0], address(0xA1));
        assertEq(p.aerodrome.gaugeAllowlist[0], address(0xB1));
    }

    function test_agentId_matchesKeccak() public view {
        assertEq(kairo.agentId("steward"), keccak256(bytes("steward")));
    }

    function test_getCaps_returnsExpected() public {
        _setBasicPolicy();
        (
            uint8 mode,
            uint256 maxSpend,
            uint256 dailyCap,
            uint64 expiresAt,
            bool active
        ) = kairo.getCaps(mei, stewardId);
        assertEq(mode, uint8(KairoPolicy.Mode.ALLOW_UNDER_LIMITS));
        assertEq(maxSpend, 250_000_000);
        assertEq(dailyCap, 1_000_000_000);
        assertEq(expiresAt, 0);
        assertTrue(active);
    }

    function test_setPolicy_overwrites() public {
        _setBasicPolicy();
        vm.prank(mei);
        kairo.setPolicy(
            stewardId,
            KairoPolicy.Mode.ASK_EVERY_TIME,
            100_000_000,
            500_000_000,
            0,
            _emptyAero()
        );
        KairoPolicy.Policy memory p = kairo.getPolicy(mei, stewardId);
        assertEq(uint8(p.mode), uint8(KairoPolicy.Mode.ASK_EVERY_TIME));
        assertEq(p.maxSpendUsd6, 100_000_000);
    }
}
