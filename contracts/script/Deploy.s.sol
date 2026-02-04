// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentIdentityRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        AgentIdentityRegistry registry = new AgentIdentityRegistry();

        console.log("Registry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}
