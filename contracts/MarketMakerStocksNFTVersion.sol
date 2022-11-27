// SPDX-License-Identifier: unlicensed
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract DecentralizedOptionMakerStocks is ERC721Enumerable, Ownable, Pausable {
    //for stocks & gold. there are no stock datafeeds on testnet, so testing must be on AVAX Mainnet to work.
    //@dev Documentation: https://docs.chain.link/docs/avalanche-price-feeds/

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "not an Admin!");
        _;
    }
    enum betType {
        long,
        short,
        longStrikePrice,
        shortStrikePrice
    }

    enum status {
        open,
        running,
        closed,
        resolved
    }

    enum Stocks {
        TSLA,
        AAPL,
        AMZN,
        GOLD,
        NFLX,
        GOOGL,
        META
    }

    struct Bet {
        uint256 betId;
        uint256 stockPicked;
        uint256 timeAccepted;
        uint256 timeToResolveBet;
        status currentBetStatus;
        address betMaker;
        address betTaker;
        betType typeOfBet;
        int256 strikePrice;
        int256 priceAtResolving;
        uint256 PayoutRatio;
        uint256 betAmount;
        uint256 betDuration;
        address betWinner;
        //uint256 strikePrice;
    }

    //Payout Ratio of 100 means 1:1. A payout Ratio of 1 means 0.01 : 1 ( meaning you get 0.01 if you win your bet, vs 1 AVAX)
    mapping(uint256 => AggregatorV3Interface) public stockPriceFeeds;

    mapping(uint256 => string) public stockPriceFeedsNAME;

    mapping(uint256 => bool) public stockPriceFeedIsInitalized;

    mapping(uint256 => uint256) public expirationOfBet;

    mapping(address => uint256) public WinningTracker;

    mapping(address => bool) isAdmin;

    mapping(uint256 => Bet) optionNfts;

    Bet[] public runningBets;
    Bet[] public resolvedBets;

    uint256 rakeFee = 1; //in Percent.
    uint256 minimumBetSize = 10000000;
    int256 TimeDeviationTolerance = 60 * 60 * 72;
    uint256 RoundIDRange = 100;
    uint256 timeUnit = 60 * 60 * 24;

    //minimum bet time is 3 hours
    uint256 minimumBetDuration = 60 * 60 * 3;

    uint256 maximumBetDuration = 60 * 60 * 24 * 365;

    uint256 treasuryFeeAvailableToCollect;

    constructor() ERC721("AlethiaOptions", "OPT") {
        //@notice our initial priceFeed initalization
        /*
        address mockTokenDataFeedONE, address mockTokenDataFeedTWO
        changePricefeeds(0x9BBBfe5C63bC70349a63105A2312Fc6169B60504, 0, "TSLA");
        changePricefeeds(0x4E4908dE170506b0795BE21bfb6e012770A635B1, 1, "AAPL");
        changePricefeeds(0x108F85023B5b1a06aC85713A94047F365A163de1, 2, "AMZN");
        changePricefeeds(0x1F41EF93dece881Ad0b98082B2d44D3f6F0C515B, 3, "GOLD");
        changePricefeeds(0x98df0E27B678FafF4CdE48c03C4790f7e2E0754F, 4, "NFLX");
        changePricefeeds(
            0xFf20180F7C97C6030497d1D262d444b25FC5B460,
            5,
            "GOOGL"
        ); 
        changePricefeeds(0xEb1f59749ACc2eBCBcad084FBBDe4E00452fE8d0, 6, "META");
        

        changePricefeeds(mockTokenDataFeedONE, 0, "ONE");
        changePricefeeds(mockTokenDataFeedTWO, 1, "TWO");
        */
    }

    function changePricefeeds(
        address _newPricefeed,
        uint256 _arrayPosition,
        string memory _nameOfFeed
    ) public onlyOwner {
        stockPriceFeeds[_arrayPosition] = AggregatorV3Interface(_newPricefeed);
        stockPriceFeedsNAME[_arrayPosition] = _nameOfFeed;
        stockPriceFeedIsInitalized[_arrayPosition] = true;
    }

    event betCreated(
        address _betCreator,
        uint256 _betAmount,
        uint256 _timeInHours,
        betType _typeOfBet,
        uint256 betId,
        uint256 stockBettedOn
    );
    event betAccepted(
        address betTaker,
        uint256 timeAccepted,
        uint256 timeToBeResolved,
        uint256 betId,
        uint256 stockBettedOn
    );

    event gameResolved(
        address winner,
        uint256 betAmountWon,
        uint256 gameInstanceResolved
    );

    //------------------User Functions------------------

    function createBet(
        betType _typeOfBet,
        uint256 _timeInHours,
        uint256 _stockPicked,
        uint256 _payoutRatio,
        uint256 _expirationDate,
        uint256 _strikePrice
    ) external payable whenNotPaused {
        require(
            stockPriceFeedIsInitalized[_stockPicked],
            "stock isnt initalized!"
        );
        require(msg.value >= minimumBetSize, "Bet is below minimum Size!");

        require(
            minimumBetDuration <= _timeInHours * timeUnit,
            "Bet is below minimum Duration"
        );

        require(
            _timeInHours <= maximumBetDuration,
            "Bet is above maximum Bet Duration!"
        );

        if (_typeOfBet == betType.long || _typeOfBet == betType.short) {
            runningBets.push(
                Bet(
                    runningBets.length,
                    _stockPicked,
                    0,
                    0,
                    status.open,
                    msg.sender,
                    address(0),
                    _typeOfBet,
                    0,
                    0,
                    _payoutRatio,
                    msg.value,
                    _timeInHours,
                    address(0)
                )
            );
        }

        // options with a strike price have the priceAtAccepting pre-set.
        if (
            _typeOfBet == betType.longStrikePrice ||
            _typeOfBet == betType.shortStrikePrice
        ) {
            runningBets.push(
                Bet(
                    runningBets.length,
                    _stockPicked,
                    0,
                    0,
                    status.open,
                    msg.sender,
                    address(0),
                    _typeOfBet,
                    int256(_strikePrice),
                    0,
                    _payoutRatio,
                    msg.value,
                    _timeInHours,
                    address(0)
                )
            );
        }

        //if strikeprice is chosen, change priceAtAccepting. Also parse it differently.

        emit betCreated(
            msg.sender,
            msg.value,
            _timeInHours,
            _typeOfBet,
            runningBets.length - 1,
            _stockPicked
        );

        if (_expirationDate != 0) {
            expirationOfBet[runningBets.length - 1] = _expirationDate;
        }
    }

    function withdrawBet(uint256 _betIDToRevoke) external {
        require(
            runningBets[_betIDToRevoke].currentBetStatus == status.open,
            "Bet already running / closed!"
        );
        require(
            msg.sender == runningBets[_betIDToRevoke].betMaker,
            "You are not the Bet Creator!"
        );

        uint256 amountToRefund = runningBets[_betIDToRevoke].betAmount;

        delete runningBets[_betIDToRevoke];

        payable(msg.sender).transfer(amountToRefund);
    }

    function acceptBet(uint256 _betIDToAccept) external payable whenNotPaused {
        require(
            runningBets[_betIDToAccept].currentBetStatus == status.open,
            "Bet isnt available anymore!"
        );

        require(
            msg.value ==
                (runningBets[_betIDToAccept].betAmount / 100) *
                    runningBets[_betIDToAccept].PayoutRatio,
            "Transfer of AVAX failed!"
        );

        require(
            expirationOfBet[_betIDToAccept] == 0 ||
                expirationOfBet[_betIDToAccept] > block.timestamp,
            "Bet has expired!"
        );

        _safeMint(msg.sender, _betIDToAccept);

        runningBets[_betIDToAccept].betTaker = msg.sender;
        runningBets[_betIDToAccept].currentBetStatus = status.running;

        //@assign price at accept, if not a strikeprice bet
        if (
            runningBets[_betIDToAccept].typeOfBet == betType.long ||
            runningBets[_betIDToAccept].typeOfBet == betType.short
        ) {
            runningBets[_betIDToAccept].strikePrice = getLatestPrice(
                runningBets[_betIDToAccept].stockPicked
            );
        }

        if (runningBets[_betIDToAccept].typeOfBet == betType.longStrikePrice) {
            runningBets[_betIDToAccept].typeOfBet == betType.long;
        }

        if (runningBets[_betIDToAccept].typeOfBet == betType.shortStrikePrice) {
            runningBets[_betIDToAccept].typeOfBet == betType.short;
        }

        runningBets[_betIDToAccept].timeAccepted = block.timestamp;
        runningBets[_betIDToAccept].timeToResolveBet =
            block.timestamp +
            (runningBets[_betIDToAccept].betDuration * timeUnit);

        emit betAccepted(
            msg.sender,
            runningBets[_betIDToAccept].timeAccepted,
            runningBets[_betIDToAccept].timeToResolveBet,
            _betIDToAccept,
            runningBets[_betIDToAccept].stockPicked
        );

        treasuryFeeAvailableToCollect += (((
            runningBets[_betIDToAccept].betAmount
        ) / 100) * rakeFee);

        optionNfts[_betIDToAccept] = runningBets[_betIDToAccept];
    }

    function resolveBet(uint256 _betIdToResolve) public {
        require(
            runningBets[_betIdToResolve].currentBetStatus == status.running,
            "bet isnt running!"
        );

        require(
            block.timestamp >= runningBets[_betIdToResolve].timeToResolveBet,
            "bet hasnt resolved yet!"
        );

        runningBets[_betIdToResolve].currentBetStatus = status.resolved;

        runningBets[_betIdToResolve].priceAtResolving = getHistoricalPrices(
            runningBets[_betIdToResolve].timeToResolveBet,
            runningBets[_betIdToResolve].stockPicked
        );
        require(
            runningBets[_betIdToResolve].priceAtResolving > 0,
            "cannot get historical price!"
        );

        int256 priceChange = runningBets[_betIdToResolve].priceAtResolving -
            runningBets[_betIdToResolve].strikePrice;

        //@notice resolve who won the bet.

        //LONG Option OR Draw
        if (runningBets[_betIdToResolve].typeOfBet == betType.long) {
            if (priceChange >= 0) {
                runningBets[_betIdToResolve].betWinner = runningBets[
                    _betIdToResolve
                ].betMaker;
            } else {
                runningBets[_betIdToResolve].betWinner = ownerOf(
                    _betIdToResolve
                );
            }
        }

        //SHORT Option
        if (runningBets[_betIdToResolve].typeOfBet == betType.short) {
            if (priceChange <= 0) {
                runningBets[_betIdToResolve].betWinner = runningBets[
                    _betIdToResolve
                ].betMaker;
            } else {
                runningBets[_betIdToResolve].betWinner = ownerOf(
                    _betIdToResolve
                );
            }
        }

        uint256 rakeFeeToPay = (((runningBets[_betIdToResolve].betAmount) /
            100) * rakeFee);

        uint256 payoutAmountRatio = (runningBets[_betIdToResolve].betAmount /
            100) * runningBets[_betIdToResolve].PayoutRatio;
        uint256 wonAmount = ((runningBets[_betIdToResolve].betAmount) +
            payoutAmountRatio) - rakeFeeToPay;

        //pay winner
        payable(runningBets[_betIdToResolve].betWinner).transfer(wonAmount);
        emit gameResolved(
            runningBets[_betIdToResolve].betWinner,
            wonAmount,
            _betIdToResolve
        );

        if (
            runningBets[_betIdToResolve].betWinner ==
            runningBets[_betIdToResolve].betMaker
        ) {
            WinningTracker[
                runningBets[_betIdToResolve].betWinner
            ] += payoutAmountRatio;
        } else {
            WinningTracker[
                runningBets[_betIdToResolve].betWinner
            ] += runningBets[_betIdToResolve].betAmount;
        }

        _burn(_betIdToResolve);
        resolvedBets.push(runningBets[_betIdToResolve]);
        delete runningBets[_betIdToResolve];
        delete optionNfts[_betIdToResolve];
        delete expirationOfBet[_betIdToResolve];
    }

    //@notice adminVersion with supplied roundID, in case the bet is very old before resolvement
    function resolveBetAdmin(
        uint256 _betIdToResolve,
        uint80 _roundIDToUse,
        uint256 _stockPriceToFind
    ) external onlyAdmin whenNotPaused {
        require(
            runningBets[_betIdToResolve].currentBetStatus == status.running,
            "bet isnt running!"
        );

        require(
            block.timestamp >= runningBets[_betIdToResolve].timeToResolveBet,
            "bet hasnt resolved yet!"
        );

        require(
            block.timestamp - 3 days >=
                runningBets[_betIdToResolve].timeToResolveBet,
            "minimum waiting period for admin intervention hasnt passed yet!"
        );

        runningBets[_betIdToResolve].currentBetStatus = status.resolved;

        (
            ,
            /*uint80 roundID*/
            int256 price, /*uint startedAt*/ /*uint timeStamp*/ /*uint80 answeredInRound*/
            ,
            ,

        ) = stockPriceFeeds[_stockPriceToFind].getRoundData(_roundIDToUse);

        runningBets[_betIdToResolve].priceAtResolving = price;

        int256 priceChange = runningBets[_betIdToResolve].priceAtResolving -
            runningBets[_betIdToResolve].strikePrice;

        //@notice resolve who won the bet.

        //LONG Option OR Draw
        if (runningBets[_betIdToResolve].typeOfBet == betType.long) {
            if (priceChange >= 0) {
                runningBets[_betIdToResolve].betWinner = runningBets[
                    _betIdToResolve
                ].betMaker;
            } else {
                runningBets[_betIdToResolve].betWinner = ownerOf(
                    _betIdToResolve
                );
            }
        }

        //SHORT Option
        if (runningBets[_betIdToResolve].typeOfBet == betType.short) {
            if (priceChange <= 0) {
                runningBets[_betIdToResolve].betWinner = runningBets[
                    _betIdToResolve
                ].betMaker;
            } else {
                runningBets[_betIdToResolve].betWinner = ownerOf(
                    _betIdToResolve
                );
            }
        }

        uint256 rakeFeeToPay = (((runningBets[_betIdToResolve].betAmount) /
            100) * rakeFee);

        uint256 payoutAmountRatio = (runningBets[_betIdToResolve].betAmount /
            100) * runningBets[_betIdToResolve].PayoutRatio;

        uint256 wonAmount = ((runningBets[_betIdToResolve].betAmount) +
            payoutAmountRatio) - rakeFeeToPay;

        payable(runningBets[_betIdToResolve].betWinner).transfer(wonAmount);
        emit gameResolved(
            runningBets[_betIdToResolve].betWinner,
            wonAmount,
            _betIdToResolve
        );

        if (
            runningBets[_betIdToResolve].betWinner ==
            runningBets[_betIdToResolve].betMaker
        ) {
            WinningTracker[
                runningBets[_betIdToResolve].betWinner
            ] += payoutAmountRatio;
        } else {
            WinningTracker[
                runningBets[_betIdToResolve].betWinner
            ] += runningBets[_betIdToResolve].betAmount;
        }

        _burn(_betIdToResolve);
        resolvedBets.push(runningBets[_betIdToResolve]);
        delete runningBets[_betIdToResolve];
        delete optionNfts[_betIdToResolve];
        delete expirationOfBet[_betIdToResolve];
    }

    //------------------User-View Functions------------------

    function ViewAllOpenBets() public view returns (Bet[] memory) {
        Bet[] memory betsCurrentlyRunning;

        uint256 localIndex;

        for (uint256 i = 0; i < runningBets.length; i++) {
            if (runningBets[i].currentBetStatus == status.open) {
                localIndex++;
            }
        }

        betsCurrentlyRunning = new Bet[](localIndex);
        localIndex = 0;

        for (uint256 i = 0; i < runningBets.length; i++) {
            if (runningBets[i].currentBetStatus == status.open) {
                betsCurrentlyRunning[localIndex] = runningBets[i];
                localIndex++;
            }
        }

        return betsCurrentlyRunning;
    }

    function viewOpenBetsBetmaker(address _playerToSearch)
        public
        view
        returns (Bet[] memory)
    {
        Bet[] memory betsCurrentlyOpen;

        uint256 localIndex;

        for (uint256 i = 0; i < runningBets.length; i++) {
            if (
                runningBets[i].betMaker == _playerToSearch &&
                runningBets[i].currentBetStatus == status.open
            ) {
                localIndex++;
            }
        }

        betsCurrentlyOpen = new Bet[](localIndex);
        localIndex = 0;

        for (uint256 i = 0; i < runningBets.length; i++) {
            if (
                runningBets[i].betMaker == _playerToSearch &&
                runningBets[i].currentBetStatus == status.open
            ) {
                betsCurrentlyOpen[localIndex] = runningBets[i];
                localIndex++;
            }
        }

        return betsCurrentlyOpen;
    }

    function viewAllRunningBetsBetMaker(address _playerToSearch)
        public
        view
        returns (Bet[] memory)
    {
        Bet[] memory betsCurrentlyRunning;

        uint256 localIndex;

        for (uint256 i = 0; i < runningBets.length; i++) {
            if (
                runningBets[i].betMaker == _playerToSearch &&
                runningBets[i].currentBetStatus == status.running
            ) {
                localIndex++;
            }
        }

        betsCurrentlyRunning = new Bet[](localIndex);
        localIndex = 0;

        for (uint256 i = 0; i < runningBets.length; i++) {
            if (
                runningBets[i].betMaker == _playerToSearch &&
                runningBets[i].currentBetStatus == status.running
            ) {
                betsCurrentlyRunning[localIndex] = runningBets[i];
                localIndex++;
            }
        }

        return betsCurrentlyRunning;
    }

    function viewAllRunningBetsBetTaker(address _playerToSearch)
        public
        view
        returns (Bet[] memory)
    {
        Bet[] memory betsCurrentlyRunning;

        uint256 localIndex;

        for (uint256 i = 0; i < runningBets.length; i++) {
            if (
                runningBets[i].betTaker == _playerToSearch &&
                runningBets[i].currentBetStatus == status.running
            ) {
                localIndex++;
            }
        }

        betsCurrentlyRunning = new Bet[](localIndex);
        localIndex = 0;

        for (uint256 i = 0; i < runningBets.length; i++) {
            if (
                runningBets[i].betTaker == _playerToSearch &&
                runningBets[i].currentBetStatus == status.running
            ) {
                betsCurrentlyRunning[localIndex] = runningBets[i];
                localIndex++;
            }
        }

        return betsCurrentlyRunning;
    }

    function ViewAllResolvedBets() public view returns (Bet[] memory) {
        return resolvedBets;
    }

    function viewAllResolvedBetsPlayer(address _playerToSearch)
        public
        view
        returns (Bet[] memory)
    {
        Bet[] memory betsResolved;

        uint256 localIndex;

        for (uint256 i = 0; i < runningBets.length; i++) {
            if (
                resolvedBets[i].betMaker == _playerToSearch ||
                resolvedBets[i].betTaker == _playerToSearch
            ) {
                localIndex++;
            }
        }

        betsResolved = new Bet[](localIndex);
        localIndex = 0;

        for (uint256 i = 0; i < runningBets.length; i++) {
            if (
                resolvedBets[i].betMaker == _playerToSearch ||
                resolvedBets[i].betTaker == _playerToSearch
            ) {
                betsResolved[localIndex] = runningBets[i];
                localIndex++;
            }
        }

        return betsResolved;
    }

    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        Bet memory betMetadata = optionNfts[_tokenId];

        string memory betCreator = Strings.toHexString(
            uint256(uint160(betMetadata.betMaker)),
            20
        );
        string memory expirationDate = Strings.toString(
            betMetadata.timeToResolveBet
        );
        string memory strikePrice = Strings.toString(
            uint256(betMetadata.strikePrice)
        );
        string memory nftBetType;

        if (uint256(betMetadata.typeOfBet) == 0) {
            nftBetType = "long";
        }

        if (uint256(betMetadata.typeOfBet) == 1) {
            nftBetType = "short";
        }

        if (uint256(betMetadata.typeOfBet) == 0) {
            nftBetType = "longStrikePrice";
        }

        if (uint256(betMetadata.typeOfBet) == 0) {
            nftBetType = "shortStrikePrice";
        }

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{ "description": "Alethia Option:",',
                        '"attributes": [ ',
                        '{"trait_type": "tokenId", "value":',
                        _tokenId,
                        "}, ",
                        '{"trait_type": "betType", "value":',
                        nftBetType,
                        "}, ",
                        '{"trait_type": "strikeprice", "value":',
                        strikePrice,
                        "}, ",
                        '{"trait_type": "expirationDate", "value":',
                        expirationDate,
                        "}, ",
                        '{"trait_type": "Option-Underwriter", "value":',
                        betCreator,
                        "}",
                        "]}"
                    )
                )
            )
        );

        string memory output = string(
            abi.encodePacked("data:application/json;base64,", json)
        );

        return output;
    }

    //------------------Chainlink Functions------------------

    function getLatestPrice(uint256 _stockPriceToFind)
        public
        view
        returns (int256)
    {
        (
            ,
            /*uint80 roundID*/
            int256 price, /*uint startedAt*/ /*uint timeStamp*/ /*uint80 answeredInRound*/
            ,
            ,

        ) = stockPriceFeeds[_stockPriceToFind].latestRoundData();
        return price;
    }

    //loop through previous roundIds to get approximate price during resolvement.
    function getHistoricalPrices(
        uint256 timestampToFindPriceFor,
        uint256 _stockPriceToFind
    ) public view returns (int256) {
        (
            uint80 roundID,
            int256 price,
            ,
            /*uint startedAt*/
            uint256 timeStamp, /*uint80 answeredInRound*/

        ) = stockPriceFeeds[_stockPriceToFind].latestRoundData();

        //uint80 latestRoundId = roundID;
        //uint80 targetRoundID = roundID - uint80(RoundIDRange);

        int256 timeStampToWorkWith = int256(timestampToFindPriceFor);

        int256 timeStampRoundToWorkWith = int256(timeStamp);
        //uint phaseId = roundID >> 64; // phaseID, basically which Aggregator Contract is being used for this instance. (5 for example, see history doc)
        //uint aggregatorRoundId = uint64(roundID); // roundID for that specific Aggregator Contract (13078 for example, see history doc)

        //if the aggregator has less than 1000 rounds total, use whatever rounds it has. Otherwise go back to the RoundIDRange

        if (
            (timeStampRoundToWorkWith - timeStampToWorkWith) <=
            TimeDeviationTolerance
        ) {
            return price;
        } else {
            for (uint256 i = 0; i < RoundIDRange; i++) {
                (
                    roundID,
                    price,
                    ,
                    /*uint startedAt*/
                    timeStamp,
                    /*uint80 answeredInRound*/

                ) = stockPriceFeeds[_stockPriceToFind].getRoundData(
                    roundID - uint80(i)
                );

                timeStampRoundToWorkWith = int256(timeStamp);

                if (
                    (timeStampRoundToWorkWith - timeStampToWorkWith) <=
                    TimeDeviationTolerance
                ) {
                    return price;
                }
            }
        }

        revert("bet too old to be resolved without admin! see timelimits");
    }

    //------------------Owner Functions------------------

    function changeRakeFee(uint256 _newRakeFee) external onlyOwner {
        rakeFee = _newRakeFee;
    }

    function changeTimeUnit(uint256 _newtimeUnit) external onlyOwner {
        timeUnit = _newtimeUnit;
    }

    function changeRoundIDRange(uint256 _newHistoricalRange)
        external
        onlyOwner
    {
        RoundIDRange = _newHistoricalRange;
    }

    function changeMinimumBet(uint256 _newMinimumBet) external onlyOwner {
        minimumBetSize = _newMinimumBet;
    }

    function changeMinimumBetDuration(uint256 _newMinBetDuration)
        external
        onlyOwner
    {
        minimumBetDuration = _newMinBetDuration;
    }

    function changeMaximumBetDuration(uint256 _newMaximumBetDuration)
        external
        onlyOwner
    {
        maximumBetDuration = _newMaximumBetDuration;
    }

    function changeTimeTolerance(int256 _newTimeTolerance) external onlyOwner {
        TimeDeviationTolerance = _newTimeTolerance;
    }

    //@notice withdraw any AVAX stored on this contract
    function withdraw(address _recipient) public onlyOwner {
        require(
            treasuryFeeAvailableToCollect != 0,
            "no fees currently availbe to collect!"
        );
        payable(_recipient).transfer(treasuryFeeAvailableToCollect);
        treasuryFeeAvailableToCollect = 0;
    }

    function changeAdminStatus(address _adminStatusToChange, bool _newStatus)
        external
        onlyOwner
    {
        isAdmin[_adminStatusToChange] = _newStatus;
    }

    receive() external payable {}
}
