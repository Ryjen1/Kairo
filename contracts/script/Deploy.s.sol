// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {KairoPolicy} from "../src/KairoPolicy.sol";

/**
 * Deploy KairoPolicy to a target chain.
 *
 * Usage (Base Sepolia):
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 */
contract Deploy is Script {
    function run() external returns (KairoPolicy kairo) {
        vm.startBroadcast();
        kairo = new KairoPolicy();
        vm.stopBroadcast();

        console2.log("KairoPolicy deployed at:", address(kairo));
    }
}
