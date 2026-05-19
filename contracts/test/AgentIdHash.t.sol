// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import "forge-std/Test.sol";
import {KairoPolicy} from "../src/KairoPolicy.sol";
contract AgentIdHashTest is Test {
    function test_steward_hash() public {
        KairoPolicy k = new KairoPolicy();
        bytes32 expected = 0x521e318892c3f2f011538a1e033f8c8cd8f85dd97e767cd081efe04f127759d4;
        assertEq(k.agentId("steward"), expected);
    }
}
