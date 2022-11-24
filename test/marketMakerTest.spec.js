const { expect, expectRevert } = require('chai')
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs')

const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

const timeUnit = 60 * 60 * 24
const betDuration = 24

const rakeFee = 0.01

const minimumStakePeriod = 90

const rewardRatePerRewardPeriod = 0.02

describe('MarketMaker Contract', function () {
  async function deployMarketMaker() {
    const [
      owner,
      randomUser,
      randomUserTwo,
      randomUserThree,
      AdminUser,
    ] = await ethers.getSigners()

    const MarketMakerContract = await ethers.getContractFactory(
      'DecentralizedOptionMakerStocks',
    )

    const mockDataFeed = await ethers.getContractFactory(
      'MockDataFeedChainlinkONE',
    )

    const mockDataFeedTwo = await ethers.getContractFactory(
      'MockDataFeedChainlinkTWO',
    )

    const deployedMarketMakerContract = await MarketMakerContract.deploy()
    const deployedMockContract = await mockDataFeed.deploy()
    const deployedMockContractTwo = await mockDataFeedTwo.deploy()

    await deployedMarketMakerContract.changePricefeeds(
      deployedMockContract.address,
      0,
      'MockOne',
    )

    await deployedMarketMakerContract.changePricefeeds(
      deployedMockContractTwo.address,
      1,
      'MockTwo',
    )

    await deployedMarketMakerContract.changeAdminStatus(AdminUser.address, true)

    // Fixtures can return anything you consider useful for your tests
    return {
      deployedMarketMakerContract,
      deployedMockContract,
      owner,
      randomUser,
      randomUserTwo,
      randomUserThree,
      AdminUser,
    }
  }

  describe('Betting Functions', function () {
    it('should be able to create and withdraw bet', async function () {
      const {
        deployedMarketMakerContract,
        owner,
        randomUser,
        randomUserTwo,
        randomUserThree,
        AdminUser,
      } = await loadFixture(deployMarketMaker)

      const amount = ethers.utils.parseEther('0.1')
      const startAmount = ethers.utils.parseEther('10000')

      expect(await ethers.provider.getBalance(randomUser.address)).to.equal(
        startAmount,
      )

      const Bet = await deployedMarketMakerContract
        .connect(randomUser)
        .createBet(0, 60 * 60, 0, 100, 0, { value: amount })

      const receiptBet = await Bet.wait()

      let gasUsed =
        BigInt(receiptBet.cumulativeGasUsed) *
        BigInt(receiptBet.effectiveGasPrice)

      const withdrawal = await deployedMarketMakerContract
        .connect(randomUser)
        .withdrawBet(0)

      const receipt = await withdrawal.wait()

      gasUsed +=
        BigInt(receipt.cumulativeGasUsed) * BigInt(receipt.effectiveGasPrice)
      gasUsed = BigInt(gasUsed)

      expect(await ethers.provider.getBalance(randomUser.address)).to.equal(
        BigInt(startAmount) - gasUsed,
      )

      // console.log(BigInt(startAmount) - gasUsed);
    })
    it('should be able to create & accept Bet', async function () {
      const {
        deployedMarketMakerContract,
        owner,
        randomUser,
        randomUserTwo,
        randomUserThree,
        AdminUser,
      } = await loadFixture(deployMarketMaker)

      const amount = ethers.utils.parseEther('0.1')
      const startAmount = ethers.utils.parseEther('10000')

      expect(await ethers.provider.getBalance(randomUserTwo.address)).to.equal(
        startAmount,
      )

      const Bet = await deployedMarketMakerContract
        .connect(randomUser)
        .createBet(0, 60 * 60, 0, 100, 0, { value: amount })

      const acceptBet = await deployedMarketMakerContract
        .connect(randomUserTwo)
        .acceptBet(0, { value: amount })

      //gasCostToConsider
      const receiptBet = await acceptBet.wait()
      let gasUsed = BigInt(
        BigInt(receiptBet.cumulativeGasUsed) *
          BigInt(receiptBet.effectiveGasPrice),
      )

      expect(await ethers.provider.getBalance(randomUserTwo.address)).to.equal(
        BigInt(startAmount) - gasUsed - BigInt(amount),
      )
    })

    it('should be able to create,accept & resolve bet', async function () {
      const {
        deployedMarketMakerContract,
        owner,
        randomUser,
        randomUserTwo,
        randomUserThree,
        AdminUser,
      } = await loadFixture(deployMarketMaker)

      const amount = ethers.utils.parseEther('100')
      const startAmount = ethers.utils.parseEther('10000')

      expect(await ethers.provider.getBalance(randomUserTwo.address)).to.equal(
        startAmount,
      )

      const Bet = await deployedMarketMakerContract
        .connect(randomUser)
        .createBet(0, betDuration, 0, 100, 0, { value: amount })

      //gasCostToConsider
      const receiptBet = await Bet.wait()
      let gasUsed = BigInt(
        BigInt(receiptBet.cumulativeGasUsed) *
          BigInt(receiptBet.effectiveGasPrice),
      )

      const acceptBet = await deployedMarketMakerContract
        .connect(randomUserTwo)
        .acceptBet(0, { value: amount })

      //skipping Network Time by BetDuration
      const blockNumBefore = await ethers.provider.getBlockNumber()
      const blockBefore = await ethers.provider.getBlock(blockNumBefore)

      const timestampBefore = blockBefore.timestamp
      await ethers.provider.send('evm_mine', [
        timestampBefore + betDuration * timeUnit,
      ])
      const blockNumAfter = await ethers.provider.getBlockNumber()
      const blockAfter = await ethers.provider.getBlock(blockNumAfter)

      //resolving bet
      const resolveBet = await deployedMarketMakerContract
        .connect(randomUserTwo)
        .resolveBet(0)

      //@dev the bet creator went long. MockOne Datafeed always has rising prices, so the bet creator wins long.
      //@notice we now verify the bet by checking the balances of the creator vs the bet-acceptor.

      expect(await ethers.provider.getBalance(randomUser.address)).to.equal(
        BigInt(startAmount) - gasUsed + BigInt(amount - amount * rakeFee),
      )
    })

    it('should be able to create,accept & resolve bet with a 1:10 ratio', async function () {
      const {
        deployedMarketMakerContract,
        owner,
        randomUser,
        randomUserTwo,
        randomUserThree,
        AdminUser,
      } = await loadFixture(deployMarketMaker)

      const amount = ethers.utils.parseEther('100')
      const amountTaker = ethers.utils.parseEther('1000')
      const startAmount = ethers.utils.parseEther('10000')

      expect(await ethers.provider.getBalance(randomUserTwo.address)).to.equal(
        startAmount,
      )

      const Bet = await deployedMarketMakerContract
        .connect(randomUser)
        .createBet(0, betDuration, 0, 1000, 0, { value: amount })

      //gasCostToConsider
      const receiptBet = await Bet.wait()
      let gasUsed = BigInt(
        BigInt(receiptBet.cumulativeGasUsed) *
          BigInt(receiptBet.effectiveGasPrice),
      )

      const acceptBet = await deployedMarketMakerContract
        .connect(randomUserTwo)
        .acceptBet(0, { value: amountTaker })

      //skipping Network Time by BetDuration
      const blockNumBefore = await ethers.provider.getBlockNumber()
      const blockBefore = await ethers.provider.getBlock(blockNumBefore)

      const timestampBefore = blockBefore.timestamp
      await ethers.provider.send('evm_mine', [
        timestampBefore + betDuration * timeUnit,
      ])
      const blockNumAfter = await ethers.provider.getBlockNumber()
      const blockAfter = await ethers.provider.getBlock(blockNumAfter)

      //resolving bet
      const resolveBet = await deployedMarketMakerContract
        .connect(randomUserTwo)
        .resolveBet(0)

      //@dev the bet creator went long. MockOne Datafeed always has rising prices, so the bet creator wins long.
      //@notice we now verify the bet by checking the balances of the creator vs the bet-acceptor.

      expect(await ethers.provider.getBalance(randomUser.address)).to.equal(
        BigInt(startAmount) - gasUsed + BigInt(amountTaker - amount * rakeFee),
      )
    })

    describe('Betting Edge Cases', function () {
      it('cannot create bet below minimum size / duration, above maximumduration, not an initalized stock', async function () {
        const {
          deployedMarketMakerContract,
          owner,
          randomUser,
          randomUserTwo,
          randomUserThree,
          AdminUser,
        } = await loadFixture(deployMarketMaker)

        const amount = ethers.utils.parseEther('0.1')
        const startAmount = ethers.utils.parseEther('10000')

        await expect(
          deployedMarketMakerContract
            .connect(randomUser)
            .createBet(0, 365 * 60 * 24, 4, 100, 0, { value: amount }),
        ).to.be.revertedWith('stock isnt initalized!')

        await expect(
          deployedMarketMakerContract
            .connect(randomUser)
            .createBet(0, 60 * 60, 0, 100, 0, { value: 100 }),
        ).to.be.revertedWith('Bet is below minimum Size!')

        await expect(
          deployedMarketMakerContract
            .connect(randomUser)
            .createBet(0, 0, 0, 100, 0, { value: amount }),
        ).to.be.revertedWith('Bet is below minimum Duration')

        await expect(
          deployedMarketMakerContract
            .connect(randomUser)
            .createBet(0, 365 * 100000, 0, 100, 0, { value: amount }),
        ).to.be.revertedWith('Bet is above maximum Bet Duration!')
      })
      it('cannot withdraw bet after its running or as a different user', async function () {
        const {
          deployedMarketMakerContract,
          owner,
          randomUser,
          randomUserTwo,
          randomUserThree,
          AdminUser,
        } = await loadFixture(deployMarketMaker)

        const amount = ethers.utils.parseEther('0.1')
        const startAmount = ethers.utils.parseEther('10000')

        expect(await ethers.provider.getBalance(randomUser.address)).to.equal(
          startAmount,
        )

        const Bet = await deployedMarketMakerContract
          .connect(randomUser)
          .createBet(0, 60 * 60, 0, 100, 0, { value: amount })

        await expect(
          deployedMarketMakerContract.connect(randomUserThree).withdrawBet(0),
        ).to.be.revertedWith('You are not the Bet Creator!')

        const acceptBet = await deployedMarketMakerContract
          .connect(randomUserTwo)
          .acceptBet(0, { value: amount })

        await expect(
          deployedMarketMakerContract.connect(randomUser).withdrawBet(0),
        ).to.be.revertedWith('Bet already running / closed!')
      })

      it('cannot accept bet after it has expired', async function () {
        const {
          deployedMarketMakerContract,
          owner,
          randomUser,
          randomUserTwo,
          randomUserThree,
          AdminUser,
        } = await loadFixture(deployMarketMaker)

        const amount = ethers.utils.parseEther('0.1')
        const startAmount = ethers.utils.parseEther('10000')

        expect(await ethers.provider.getBalance(randomUser.address)).to.equal(
          startAmount,
        )

        const blockNumBefore = await ethers.provider.getBlockNumber()
        const blockBefore = await ethers.provider.getBlock(blockNumBefore)

        const timestampBefore = blockBefore.timestamp

        const Bet = await deployedMarketMakerContract
          .connect(randomUser)
          .createBet(0, 60 * 60, 0, 100, timestampBefore, { value: amount })

        const acceptBet = await expect(
          deployedMarketMakerContract
            .connect(randomUserTwo)
            .acceptBet(0, { value: amount }),
        ).to.be.revertedWith('Bet has expired!')
      })
    })
  })

  describe('Admin Functions', function () {
    it('should be able to change all relevant parameters', async function () {
      const {
        deployedMarketMakerContract,
        owner,
        randomUser,
        randomUserTwo,
        randomUserThree,
        AdminUser,
      } = await loadFixture(deployMarketMaker)

      const newTimeTolerance = 240
      const newTimeUnit = 60
      const newRakeFee = 30
      const newMinimumBet = 100000000
      const newMinimumBetDuration = 60 * 60 * 24

      const maximumBetDuration = 10000000
      const newRoundIDRange = 60

      let Transaction = await deployedMarketMakerContract
        .connect(owner)
        .changeRakeFee(newRakeFee)

      Transaction = await deployedMarketMakerContract
        .connect(owner)
        .changeTimeUnit(newTimeUnit)

      Transaction = await deployedMarketMakerContract
        .connect(owner)
        .changeRoundIDRange(newRoundIDRange)

      Transaction = await deployedMarketMakerContract
        .connect(owner)
        .changeMinimumBet(newMinimumBet)

      Transaction = await deployedMarketMakerContract
        .connect(owner)
        .changeMinimumBetDuration(newMinimumBetDuration)

      Transaction = await deployedMarketMakerContract
        .connect(owner)
        .changeMaximumBetDuration(maximumBetDuration)

      Transaction = await deployedMarketMakerContract
        .connect(owner)
        .changeTimeTolerance(newTimeTolerance)
    })

    it('should revert if not owner / not addmin is calling owner/admin functions', async function () {
      const {
        deployedMarketMakerContract,
        owner,
        randomUser,
        randomUserTwo,
        randomUserThree,
        AdminUser,
      } = await loadFixture(deployMarketMaker)

      const newTimeTolerance = 240
      const newTimeUnit = 60
      const newRakeFee = 30
      const newMinimumBet = 100000000
      const newMinimumBetDuration = 60 * 60 * 24

      const maximumBetDuration = 10000000
      const newRoundIDRange = 60

      await expect(
        deployedMarketMakerContract
          .connect(randomUser)
          .changeRakeFee(newRakeFee),
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(
        deployedMarketMakerContract
          .connect(randomUser)
          .changeTimeUnit(newTimeUnit),
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(
        deployedMarketMakerContract
          .connect(randomUser)
          .changeMinimumBet(newTimeUnit),
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(
        deployedMarketMakerContract
          .connect(randomUser)
          .changeMinimumBetDuration(newTimeUnit),
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(
        deployedMarketMakerContract
          .connect(randomUser)
          .changeMaximumBetDuration(newTimeUnit),
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(
        deployedMarketMakerContract
          .connect(randomUser)
          .changeTimeTolerance(newTimeUnit),
      ).to.be.revertedWith('Ownable: caller is not the owner')

      await expect(
        deployedMarketMakerContract
          .connect(randomUser)
          .resolveBetAdmin(0, 10, 0),
      ).to.be.revertedWith('not an Admin!')
    })

    it('admin resolving older bet', async function () {
      const {
        deployedMarketMakerContract,
        owner,
        randomUser,
        randomUserTwo,
        randomUserThree,
        AdminUser,
      } = await loadFixture(deployMarketMaker)
      const amount = ethers.utils.parseEther('100')
      const startAmount = ethers.utils.parseEther('10000')

      expect(await ethers.provider.getBalance(randomUserTwo.address)).to.equal(
        startAmount,
      )

      const Bet = await deployedMarketMakerContract
        .connect(randomUser)
        .createBet(0, betDuration, 0, 100, 0, { value: amount })

      //gasCostToConsider
      const receiptBet = await Bet.wait()
      let gasUsed = BigInt(
        BigInt(receiptBet.cumulativeGasUsed) *
          BigInt(receiptBet.effectiveGasPrice),
      )

      const acceptBet = await deployedMarketMakerContract
        .connect(randomUserTwo)
        .acceptBet(0, { value: amount })

      //skipping Network Time by BetDuration
      const blockNumBefore = await ethers.provider.getBlockNumber()
      const blockBefore = await ethers.provider.getBlock(blockNumBefore)

      const timestampBefore = blockBefore.timestamp
      await ethers.provider.send('evm_mine', [
        timestampBefore + betDuration * timeUnit,
      ])
      const blockNumAfter = await ethers.provider.getBlockNumber()
      const blockAfter = await ethers.provider.getBlock(blockNumAfter)

      //resolving bet by admin

      await expect(
        deployedMarketMakerContract
          .connect(AdminUser)
          .resolveBetAdmin(0, 99, 0),
      ).to.be.revertedWith(
        'minimum waiting period for admin intervention hasnt passed yet!',
      )

      //have to skip the time for the minimum admin intervention time of 3 days after resolvement
      //@notice this is to prevent adminAbuse.

      {
        const minimumWaitingPeriodAdminResolution = 60 * 60 * 24 * 3

        //skipping Network Time by BetDuration
        const blockNumBefore = await ethers.provider.getBlockNumber()
        const blockBefore = await ethers.provider.getBlock(blockNumBefore)

        const timestampBefore = blockBefore.timestamp
        await ethers.provider.send('evm_mine', [
          timestampBefore + minimumWaitingPeriodAdminResolution,
        ])
        const blockNumAfter = await ethers.provider.getBlockNumber()
        const blockAfter = await ethers.provider.getBlock(blockNumAfter)
      }

      await deployedMarketMakerContract
        .connect(AdminUser)
        .resolveBetAdmin(0, 99, 0)

      //@dev the bet creator went long. MockOne Datafeed always has rising prices, so the bet creator wins long.
      //@notice we now verify the bet by checking the balances of the creator vs the bet-acceptor.

      expect(await ethers.provider.getBalance(randomUser.address)).to.equal(
        BigInt(startAmount) - gasUsed + BigInt(amount - amount * rakeFee),
      )
    })

    it('admin collecting only allowed treasuryfee', async function () {
      const {
        deployedMarketMakerContract,
        owner,
        randomUser,
        randomUserTwo,
        randomUserThree,
        AdminUser,
      } = await loadFixture(deployMarketMaker)
      const amount = ethers.utils.parseEther('100')
      const startAmount = ethers.utils.parseEther('10000')

      const startingAmountOwner = await ethers.provider.getBalance(
        owner.address,
      )

      expect(await ethers.provider.getBalance(randomUserTwo.address)).to.equal(
        startAmount,
      )

      const Bet = await deployedMarketMakerContract
        .connect(randomUser)
        .createBet(0, betDuration, 0, 100, 0, { value: amount })

      //gasCostToConsider
      const receiptBet = await Bet.wait()
      let gasUsed = BigInt(
        BigInt(receiptBet.cumulativeGasUsed) *
          BigInt(receiptBet.effectiveGasPrice),
      )

      const acceptBet = await deployedMarketMakerContract
        .connect(randomUserTwo)
        .acceptBet(0, { value: amount })

      //skipping Network Time by BetDuration
      const blockNumBefore = await ethers.provider.getBlockNumber()
      const blockBefore = await ethers.provider.getBlock(blockNumBefore)

      const timestampBefore = blockBefore.timestamp
      await ethers.provider.send('evm_mine', [
        timestampBefore + betDuration * timeUnit,
      ])
      const blockNumAfter = await ethers.provider.getBlockNumber()
      const blockAfter = await ethers.provider.getBlock(blockNumAfter)

      //resolving bet by admin

      await expect(
        deployedMarketMakerContract
          .connect(AdminUser)
          .resolveBetAdmin(0, 99, 0),
      ).to.be.revertedWith(
        'minimum waiting period for admin intervention hasnt passed yet!',
      )

      //have to skip the time for the minimum admin intervention time of 3 days after resolvement
      //@notice this is to prevent adminAbuse.

      {
        const minimumWaitingPeriodAdminResolution = 60 * 60 * 24 * 3

        //skipping Network Time by BetDuration
        const blockNumBefore = await ethers.provider.getBlockNumber()
        const blockBefore = await ethers.provider.getBlock(blockNumBefore)

        const timestampBefore = blockBefore.timestamp
        await ethers.provider.send('evm_mine', [
          timestampBefore + minimumWaitingPeriodAdminResolution,
        ])
        const blockNumAfter = await ethers.provider.getBlockNumber()
        const blockAfter = await ethers.provider.getBlock(blockNumAfter)
      }

      await deployedMarketMakerContract
        .connect(AdminUser)
        .resolveBetAdmin(0, 99, 0)

      //@dev the bet creator went long. MockOne Datafeed always has rising prices, so the bet creator wins long.
      //@notice we now verify the bet by checking the balances of the creator vs the bet-acceptor.

      expect(await ethers.provider.getBalance(randomUser.address)).to.equal(
        BigInt(startAmount) - gasUsed + BigInt(amount - amount * rakeFee),
      )

      const Withdrawal = await deployedMarketMakerContract
        .connect(owner)
        .withdraw(owner.address)

      //gasCostToConsider
      const receiptWithdrawal = await Withdrawal.wait()
      let gasUsedWithdrawal = BigInt(
        BigInt(receiptWithdrawal.cumulativeGasUsed) *
          BigInt(receiptWithdrawal.effectiveGasPrice),
      )

      expect(await ethers.provider.getBalance(owner.address)).to.equal(
        BigInt(startingAmountOwner) -
          gasUsedWithdrawal +
          BigInt(amount * rakeFee),
      )
    })
  })
})
