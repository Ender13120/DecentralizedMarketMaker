// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

//@dev has rising prices over the time.

contract MockDataFeedChainlinkTWO is AggregatorV3Interface {
    constructor() {
        fillMockPricesData();

    }

    function fillMockPricesData() public {



        for(uint i= 0;i< 100;i++){

            roundDataPrices memory newMockRound;
            newMockRound.roundId = uint80(i);
            newMockRound.answer = int256(100000 - (i + 1 * 3) );
            newMockRound.answeredInRound = uint80(block.timestamp - 600 +( (i + 1 * 3)));





            roundDataHistory.push(newMockRound);



        }
    }

    roundDataPrices[] public roundDataHistory;

    struct roundDataPrices{

            uint80 roundId;
            int256 answer;
            uint256 startedAt;
            uint256 updatedAt;
            uint80 answeredInRound;

    }


  

    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {


        return (roundDataHistory[_roundId].roundId, roundDataHistory[_roundId].answer,roundDataHistory[_roundId].startedAt,roundDataHistory[_roundId].updatedAt, roundDataHistory[_roundId].answeredInRound);
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {   
        
        return (roundDataHistory[roundDataHistory.length -1].roundId, roundDataHistory[roundDataHistory.length -1].answer,roundDataHistory[roundDataHistory.length -1].startedAt,roundDataHistory[roundDataHistory.length -1].updatedAt, roundDataHistory[roundDataHistory.length -1].answeredInRound);
    }



      //no need to mock
    function decimals() external view returns (uint8) {}

    function description() external view returns (string memory) {}

    function version() external view returns (uint256) {}
}
