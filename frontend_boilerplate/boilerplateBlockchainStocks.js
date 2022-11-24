import { useEffect } from "react";
import { useState } from "react";
import { ethers } from "ethers";
import "./App.css";
import contract from "./contracts/ContractRoulette.json";
import tokenContract from "./contracts/TestToken.json";

//placeholder
const contractAddress = "0xa3a388d3c64d55566B522ffdDA28cfb10FdFd2Df";
const abi = contract.abi;

//placeholder
const tokenContractAddress =
  "0xe49337C48eAfBc24fa8E01FAEeff254ca637dFce";
const tokenabi = tokenContract.abi;

//@TODO this enum is used for the stocks: enum Stocks{TSLA,AAPL, AMZN,GOLD,NFLX,GOOGL, META}. So Tsla is 0, AAPL 1 and so on

function App() {
  const [currentAccount, setCurrentAccount] = useState(null);
  const checkWalletIsConnected = async () => {
    const { ethereum } = window;

    if (!ethereum) {
      console.log("Make sure Metamask is installed!");
      return;
    } else {
      console.log("Wallet exists,ready to go");
    }

    const accounts = await ethereum.request({
      method: "eth_accounts",
    });

    if (accounts.length !== 0) {
      const account = accounts[0];
      console.log("found auth. account", account);
      setCurrentAccount(account);
    } else {
      console.log("no auth. account found");
    }
  };

  const connectWalletHandler = async () => {
    const { ethereum } = window;
    if (!ethereum) {
      alert("Install Metamask!");
    }

    try {
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      console.log("Found an  account!Address: ", accounts[0]);
      setCurrentAccount(accounts[0]);
    } catch (err) {
      console.log(err);
    }
  };

  //@notice @dev Token functions arent necessary for v1. Leaving them in for now, the functions will use only native crypto, which is covered inside the web3 calls already.

  //@dev
  //@notice approve tokens to be able to spend them to create/accept bets ! use an input box or something.
  const approveTokens = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        let amountToStake = 100; //@TODO userinput here

        console.log("started");
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();

        console.log(tokenabi);
        const MainTokenContract = new ethers.Contract(
          tokenContractAddress,
          tokenabi,
          signer
        );

        console.log("initalize token approval");
        let tokenApproval = await MainTokenContract.approve(
          contractAddress,
          5e10
        );

        console.log("Approving Tokens...please wait");

        await tokenApproval.wait();

        console.log("tokens approved!");
      } else {
        console.log("Ethereum object doesnt exist");
      }
    } catch (err) {
      console.log(err);
    }
  };

  //@dev
  //@notice User creating Bets.
  //@params betAmount, betType(long/short), betDuration (in hours), Payout Ratio

  const createBet = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        let betAmount = "0.001"; //@TODO userinput here, in total AVAX. Has to be a string

        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const bettingContract = new ethers.Contract(
          contractAddress,
          abi,
          signer
        );

        const betType = 0; //@TODO Userinput here. 0 is long, 1 is short.

        const betDuration = 0; //@TODO Userinput here. Timeunit is 1=  1 hour. Minimum of 1h.

        const stockpicked = 0; ////@TODO this enum is used for the stocks: enum Stocks{TSLA,AAPL, AMZN,GOLD,NFLX,GOOGL, META}. So Tsla is 0, AAPL 1 and so on

        const payoutRatio = 100; //@TODO The Payout Ratio. 100 is 1:1. 1 is 0.01 : 1. 1000 is 10:1

        const expirationDate = 1662220020; //@TODO UNIX Timestamp of when the bet is supposed to expire / become unavailable (if desired, otherwise use 0)

        let BetCreationTransaction = await bettingContract.createBet(
          betType,
          betDuration,
          stockpicked,
          payoutRatio,
          expirationDate,
          { value: ethers.utils.parseEther(betAmount) }
        );

        console.log(
          `Bet created, see transaction: https://rinkeby.etherscan.io/tx/${BetCreationTransaction.hash}`
        );
      } else {
        console.log("Ethereum object doesnt exist");
      }
    } catch (err) {
      console.log(err);
    }
  };

  //@dev
  //@notice user accepts BetInstance

  const acceptBet = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const bettingContract = new ethers.Contract(
          contractAddress,
          abi,
          signer
        );

        const betId = 0; //@TODO check View functions. The ID of the Bet Instance to accept.
        const betAmount = "0.1"; // You calculate the betAmount necessary by getting the BetAmount from the view function and multiply as follows:   betAmount == (runningBets[_betIDToAccept].betAmount / 100) *  runningBets[_betIDToAccept].PayoutRatio,

        let betAcceptanceCreation = await bettingContract.acceptBet(
          betId,
          {
            value: ethers.utils.parseEther(betAmount),
          }
        );

        console.log(
          `Bet accepted, see transaction: https://rinkeby.etherscan.io/tx/${betAcceptanceCreation.hash}`
        );
      } else {
        console.log("Ethereum object doesnt exist");
      }
    } catch (err) {
      console.log(err);
    }
  };

  //@dev
  //@notice BetMaker withdraws open Bet and gets full refund.

  const withdrawBet = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const bettingContract = new ethers.Contract(
          contractAddress,
          abi,
          signer
        );

        const betId = 0; //@TODO check View functions. The ID of the Bet Instance to withdraw. See Open Betmaker View Function

        let betAcceptanceCreation = await bettingContract.withdrawBet(
          betId
        );

        console.log(
          `Bet withdrawn, see transaction: https://rinkeby.etherscan.io/tx/${betAcceptanceCreation.hash}`
        );
      } else {
        console.log("Ethereum object doesnt exist");
      }
    } catch (err) {
      console.log(err);
    }
  };

  //@dev
  //@TODO player can resolve the bets after they ran out. Automatically done for them by the backend if left alone for a while.

  const resolveBet = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const bettingContract = new ethers.Contract(
          contractAddress,
          abi,
          signer
        );

        const betId = 0; //@TODO check View functions. The ID of the Bet Instance to resolve. See Open Betmaker View Function

        let betAcceptanceCreation = await bettingContract.resolveBet(
          betId
        );

        console.log(
          `Bet resolved, see transaction: https://rinkeby.etherscan.io/tx/${betAcceptanceCreation.hash}`
        );
      } else {
        console.log("Ethereum object doesnt exist");
      }
    } catch (err) {
      console.log(err);
    }
  };

  //@dev
  //@notice View Functions

  //Data Structures:
  /*

        enum betType {
        long,
        short
    }

    enum status {
        open,
        running,
        closed,
        resolved
    }

    struct Bet {
        uint betId;
        uint stockPicked;
        uint timeAccepted;
        uint timeToResolveBet;
        status currentBetStatus;
        address betMaker;
        address betTaker;
        betType typeOfBet;
        int priceAtAccepting;
        int priceAtResolving;
        uint PayoutRatio;
        uint betAmount;
        uint betDuration;
        address betWinner;
    }

    enum goes 0,1,2,3,4 by the order of initalization.

    */

  //@dev
  //@TODO shows all openBets available to accept, returned as an array of Bet[] structs

  const viewOpenbets = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const bettingContract = new ethers.Contract(
          contractAddress,
          abi,
          signer
        );

        let openBetsArray = await bettingContract.ViewAllOpenBets(); //output array to parse into UI.
      } else {
        console.log("Ethereum object doesnt exist");
      }
    } catch (err) {
      console.log(err);
    }
  };

  //@dev
  //@TODO shows all runningBets from the User as the Betmaker

  const viewRunningBetsUser = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const bettingContract = new ethers.Contract(
          contractAddress,
          abi,
          signer
        );

        let runningBetsArrayBetMaker =
          await bettingContract.viewAllRunningBetsBetMaker(
            await signer.getAddress()
          ); //output array to parse into UI.
      } else {
        console.log("Ethereum object doesnt exist");
      }
    } catch (err) {
      console.log(err);
    }
  };

  //@dev
  //@TODO shows all runningBets from the User as the BetTaker

  const viewAllRunningBetsBetTaker = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const bettingContract = new ethers.Contract(
          contractAddress,
          abi,
          signer
        );

        let runningBetsArrayBetTaker =
          await bettingContract.viewAllRunningBetsBetTaker(
            await signer.getAddress()
          ); //output array to parse into UI.
      } else {
        console.log("Ethereum object doesnt exist");
      }
    } catch (err) {
      console.log(err);
    }
  };

  const viewAllResolvedBetsUser = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const bettingContract = new ethers.Contract(
          contractAddress,
          abi,
          signer
        );

        let resolvedBetsUserArray =
          await bettingContract.viewAllResolvedBetsPlayer(
            await signer.getAddress()
          ); //output array to parse into UI.
      } else {
        console.log("Ethereum object doesnt exist");
      }
    } catch (err) {
      console.log(err);
    }
  };

  const approveTokensButton = () => {
    return (
      <button
        onClick={approveTokens}
        className="cta-button mint-nft-button"
      >
        Approve Tokens
      </button>
    );
  };

  useEffect(() => {
    checkWalletIsConnected();
  }, []);

  return (
    <div className="main-app">
      <h1>Boilerplate Staking </h1>
    </div>
  );
}

export default App;
