// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable {
    constructor(uint amount) ERC20("MyToken", "MTK") {

        _mint(msg.sender, amount);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        
        _mint(to, amount);
    }
}