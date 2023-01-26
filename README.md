Decentralized Marketmaker
----------------------------
Enables you to create options on assets.

Options are resolved completly decentralized using Chainlink Datafeeds & Historical Price Functions

----------------------------

**Option Maker Parameters**



**\_typeOfBet:**

4 Kinds of bets:

-long,
-short,
-longStrikePrice,
-shortStrikePrice

Long, the OptionMaker predicts that the asset goes up. If it goes up/ 0% priceChange, the optionMaker wins the option

Short, the OptionMaker predicts that the asset goes down. If it goes down / 0% priceChange, the optionMAker wins the option

-StrikePrice version. The OptionMaker specifies the Strikeprice instead of fetching it automatically upon accepting.

Example: I want to bet that Tesla will go up

Option 1, long. I create the bet, and once a OptionTaker buys/accepts the Option it will fetch the current Price as the Strike Price.

Option 2, longStrikePrice. I create the bet, and I specify the StrikePrice as 100$.

Why do this? So Traders can create bets that cover very unlikely scenarios and generate premiums for low risk.

**\_timeInHours**

how long will an option run upon accepting?

This decides how long an Option should run upon accepting. There is a minimum ( 3hours) and a maximum (2 years).

**\_stockPicked**

This is the asset that the OptionMaker wants to bet on. Only initalized stocks are available.

mapping(uint256 => string) public stockPriceFeedsNAME; has all the current active stocks in string format. ( TO DO, add a simplre view function to list all)

**\_payoutRatio**

This decides the ratio that the OptionMaker and OptionTaker pays funds.

A Payout Ratio of 100 means a 1:1 bet. A payout Ratio of 1 means 0.01 : 1 ( meaning you get 0.01 if you win your bet, vs your betted 1 )

Example:

I create a bet with a payout ratio of 1, with a msg.value of 1000.

The option-price would be 10 to accept the option.

The taker would win 1000 + get back their initial 10 if they are sucessful. (minus fees)

The maker would win 10 + get back their initial 1000 if they are sucessful ( minus fees)

**ExpirationDate:**

a UNIX timestamp uint at which the option should no longer be available to accept. can be left as 0.


**Options can be cancelled manually any time.**

**Options that have been accepted are locked in!**

---------------------




