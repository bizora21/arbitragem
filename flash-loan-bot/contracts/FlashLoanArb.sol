// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// ── Aave V3 ──────────────────────────────────────────────────────────────────

interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

// ── DEX routers ───────────────────────────────────────────────────────────────

// UniswapV2-style: SushiSwap, BaseSwap, etc.
interface IUniV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

// Aerodrome / Velodrome (Solidly-fork): uses Route struct with stable flag
interface IAerodromeRouter {
    struct Route {
        address from;
        address to;
        bool    stable;
        address factory;
    }
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

// Uniswap V3 SwapRouter02 — no deadline field in params
interface IUniV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

// PancakeSwap V3 SmartRouter — has deadline field in params
interface IPCSRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

// ── Main contract ─────────────────────────────────────────────────────────────

contract FlashLoanArb is Ownable {
    using SafeERC20 for IERC20;

    // DEX type constants (kept as uint8 in params to save calldata)
    uint8 public constant DEX_V2        = 0;  // UniV2-style  (swapExactTokensForTokens, address[] path)
    uint8 public constant DEX_V3        = 1;  // UniV3 SwapRouter02 (exactInputSingle, no deadline)
    uint8 public constant DEX_PCS       = 2;  // PancakeSwap SmartRouter (exactInputSingle, with deadline)
    uint8 public constant DEX_AERODROME = 3;  // Aerodrome/Velodrome (Route[] with stable + factory)

    // Aerodrome PoolFactory on Base — used in Route struct
    address public constant AERODROME_FACTORY = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da;

    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    IPool                  public immutable POOL;

    event ArbitrageExecuted(
        address indexed flashToken,
        uint256         flashAmount,
        uint256         profit,
        uint256         timestamp
    );
    event ArbitrageFailed(string reason, uint256 timestamp);

    // Packed params passed through the Aave callback
    struct ArbParams {
        address buyToken;
        address buyRouter;
        address sellRouter;
        uint8   buyDexType;
        uint8   sellDexType;
        uint24  buyPoolFee;   // V3: fee tier; Aerodrome: 0=volatile, 1=stable
        uint24  sellPoolFee;
        uint256 minProfitBps;
    }

    constructor(address addressesProvider) Ownable(msg.sender) {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(addressesProvider);
        POOL               = IPool(IPoolAddressesProvider(addressesProvider).getPool());
    }

    // ── Public entry point (called by bot, onlyOwner) ─────────────────────────

    function executeArbitrage(
        address flashToken,
        uint256 flashAmount,
        address buyToken,
        address buyRouter,
        address sellRouter,
        uint8   buyDexType,
        uint8   sellDexType,
        uint24  buyPoolFee,
        uint24  sellPoolFee,
        uint256 minProfitBps
    ) external onlyOwner {
        bytes memory params = abi.encode(ArbParams({
            buyToken:    buyToken,
            buyRouter:   buyRouter,
            sellRouter:  sellRouter,
            buyDexType:  buyDexType,
            sellDexType: sellDexType,
            buyPoolFee:  buyPoolFee,
            sellPoolFee: sellPoolFee,
            minProfitBps: minProfitBps
        }));

        POOL.flashLoanSimple(address(this), flashToken, flashAmount, params, 0);
    }

    // ── Aave V3 flash loan callback ───────────────────────────────────────────

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(msg.sender  == address(POOL), "Not Aave pool");
        require(initiator   == address(this), "Not self-initiated");

        ArbParams memory p = abi.decode(params, (ArbParams));

        // Step 1: flashToken → buyToken on cheap DEX
        uint256 bought = _swap(asset, p.buyToken, amount, p.buyRouter, p.buyDexType, p.buyPoolFee);

        // Step 2: buyToken → flashToken on expensive DEX
        _swap(p.buyToken, asset, bought, p.sellRouter, p.sellDexType, p.sellPoolFee);

        // Verify we can repay and meet minimum profit
        uint256 totalDebt  = amount + premium;
        uint256 balance    = IERC20(asset).balanceOf(address(this));
        require(balance >= totalDebt, "Unprofitable after swaps");

        uint256 profit     = balance - totalDebt;
        uint256 profitBps  = (profit * 10_000) / amount;
        require(profitBps >= p.minProfitBps, "Below min profit");

        // Approve Aave pool to pull repayment
        IERC20(asset).forceApprove(address(POOL), totalDebt);

        emit ArbitrageExecuted(asset, amount, profit, block.timestamp);
        return true;
    }

    // ── Internal swap dispatcher ──────────────────────────────────────────────

    function _swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address router,
        uint8   dexType,
        uint24  poolFee
    ) internal returns (uint256 amountOut) {
        IERC20(tokenIn).forceApprove(router, amountIn);

        if (dexType == DEX_V2) {
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            uint256[] memory amounts = IUniV2Router(router).swapExactTokensForTokens(
                amountIn,
                0,                       // minOut=0; overall profit check provides protection
                path,
                address(this),
                block.timestamp + 300
            );
            amountOut = amounts[amounts.length - 1];

        } else if (dexType == DEX_V3) {
            amountOut = IUniV3Router(router).exactInputSingle(
                IUniV3Router.ExactInputSingleParams({
                    tokenIn:           tokenIn,
                    tokenOut:          tokenOut,
                    fee:               poolFee,
                    recipient:         address(this),
                    amountIn:          amountIn,
                    amountOutMinimum:  0,
                    sqrtPriceLimitX96: 0
                })
            );

        } else if (dexType == DEX_PCS) {
            amountOut = IPCSRouter(router).exactInputSingle(
                IPCSRouter.ExactInputSingleParams({
                    tokenIn:           tokenIn,
                    tokenOut:          tokenOut,
                    fee:               poolFee,
                    recipient:         address(this),
                    deadline:          block.timestamp + 300,
                    amountIn:          amountIn,
                    amountOutMinimum:  0,
                    sqrtPriceLimitX96: 0
                })
            );

        } else if (dexType == DEX_AERODROME) {
            // poolFee encoding: 0 = volatile pool, 1 = stable pool
            IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
            routes[0] = IAerodromeRouter.Route({
                from:    tokenIn,
                to:      tokenOut,
                stable:  poolFee == 1,
                factory: AERODROME_FACTORY
            });
            uint256[] memory amounts = IAerodromeRouter(router).swapExactTokensForTokens(
                amountIn,
                0,
                routes,
                address(this),
                block.timestamp + 300
            );
            amountOut = amounts[amounts.length - 1];

        } else {
            revert("Unsupported DEX type");
        }
    }

    // ── Owner utilities ───────────────────────────────────────────────────────

    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function withdrawAll(address token) external onlyOwner {
        IERC20(token).safeTransfer(owner(), IERC20(token).balanceOf(address(this)));
    }

    receive() external payable {}
}
