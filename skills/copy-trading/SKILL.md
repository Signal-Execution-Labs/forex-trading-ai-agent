# Copy Trading

eToro/ZuluTrade-style signal copying with smart execution.

## Features

### Leader Discovery
- **Performance Metrics** - Sharpe, Sortino, Max DD, Win Rate
- **Risk Scoring** - Conservative to Aggressive (1-10)
- **Style Tags** - Scalper, Swing, Position, Algo
- **Verified Track Record** - Minimum 6 months history

### Copy Modes

1. **Proportional** - Copy trades at same % of portfolio
2. **Fixed Size** - Use fixed position size regardless
3. **Risk-Adjusted** - Scale based on your risk tolerance
4. **Selective** - Only copy certain asset types

### Risk Management

- **Max Allocation** - Limit exposure per leader
- **Drawdown Stop** - Pause if leader hits DD threshold
- **Correlation Filter** - Avoid copying correlated leaders
- **Time Filter** - Only copy during specific hours

### Execution

- **Latency Optimization** - Sub-second execution
- **Slippage Protection** - Max slippage limits
- **Gap Protection** - Skip if price moved too much
- **Retry Logic** - Smart retry on failures

## Commands

```
kit copy discover --min-sharpe 1.5 --max-dd 20
kit copy follow <leader-id> --mode proportional --allocation 10%
kit copy unfollow <leader-id>
kit copy status
kit copy history --leader <id>
kit copy leaderboard --timeframe 30d
```

## Social Features

- Comment on leader trades
- Ask leaders questions
- Share your own signals
- Build follower base
