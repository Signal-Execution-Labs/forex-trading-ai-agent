# Pine Script Importer

> Import TradingView Pine Script indicators and strategies into K.I.T.

## Overview

Converts Pine Script (v4/v5/v6) to K.I.T. native format:
- Import popular TradingView indicators
- Convert community scripts to K.I.T. skills
- Maintain Pine logic in JavaScript/TypeScript
- Auto-generate alerts and trading signals

## Features

### Supported Pine Versions
- Pine Script v4
- Pine Script v5
- Pine Script v6 (partial - footprint API)

### Conversion Capabilities
- **Variables:** study/indicator variables
- **Inputs:** input.int, input.float, input.string, input.bool
- **Built-ins:** ta.sma, ta.ema, ta.rsi, ta.macd, etc.
- **Plotting:** plot(), plotshape(), plotchar()
- **Alerts:** alertcondition(), alert()
- **Strategies:** strategy.entry(), strategy.exit()

### Conversion Process

1. **Parse:** Analyze Pine Script AST
2. **Map:** Convert functions to K.I.T. equivalents
3. **Generate:** Output TypeScript indicator
4. **Validate:** Test against sample data
5. **Package:** Create K.I.T. skill

## Usage

```bash
# Import from file
kit pine import ./my_indicator.pine

# Import from TradingView URL (public scripts)
kit pine import https://tradingview.com/script/abc123

# Import from clipboard
kit pine import --clipboard

# Convert to specific output
kit pine import ./script.pine --output typescript
kit pine import ./script.pine --output python
```

## Configuration

```yaml
pine_importer:
  default_output: typescript
  preserve_comments: true
  add_jsdoc: true
  validate_after_import: true
  test_data_source: yahoo  # yahoo, coingecko, manual
  
  # Function mappings for unsupported Pine functions
  custom_mappings:
    ta.vwap: kit.indicators.vwap
    request.security: kit.mtf.get
```

## Limitations

Cannot convert:
- **request.security** with complex barmerge (simplified fallback)
- **Pine v6 footprint.* API** (use K.I.T. native instead)
- **Visual elements** (backgrounds, fills - alerts only)
- **Protected scripts** (invite-only indicators)

## Example Conversion

**Pine Script Input:**
```pine
//@version=5
indicator("RSI Alert", overlay=false)
length = input.int(14, "Length")
overbought = input.int(70, "Overbought")
oversold = input.int(30, "Oversold")

rsiValue = ta.rsi(close, length)
plot(rsiValue, "RSI", color.purple)

alertcondition(rsiValue > overbought, "Overbought", "RSI above 70")
alertcondition(rsiValue < oversold, "Oversold", "RSI below 30")
```

**K.I.T. Output:**
```typescript
import { Indicator, config, alert } from '@kit/core';

const RSIAlert = new Indicator({
  name: 'RSI Alert',
  overlay: false,
  inputs: {
    length: config.int(14, 'Length'),
    overbought: config.int(70, 'Overbought'),
    oversold: config.int(30, 'Oversold')
  },
  calculate: (data, inputs) => {
    const rsi = kit.ta.rsi(data.close, inputs.length);
    
    if (rsi > inputs.overbought) {
      alert('Overbought', `RSI above ${inputs.overbought}`);
    }
    if (rsi < inputs.oversold) {
      alert('Oversold', `RSI below ${inputs.oversold}`);
    }
    
    return { rsi };
  }
});

export default RSIAlert;
```

## Best Practices

1. Test converted scripts against TradingView
2. Verify signal timing matches
3. Adjust for data source differences
4. Document any manual adjustments needed
