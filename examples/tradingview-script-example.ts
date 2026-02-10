/**
 * TradingView Script Generator Example
 * 
 * This example shows how to use K.I.T. to generate Pine Script code
 * for TradingView indicators and strategies.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Path to the Pine Script generator
const GENERATOR_PATH = '../skills/tradingview-script/pine_generator.py';

/**
 * Example 1: Generate a simple RSI indicator
 */
async function generateRSIIndicator() {
    console.log('\n📜 Example 1: Generate RSI Indicator\n');
    
    const { stdout } = await execAsync(
        `python3 ${GENERATOR_PATH} indicator --type rsi --name "K.I.T. RSI" --length 14 --overbought 70 --oversold 30`
    );
    
    console.log('Generated Pine Script:');
    console.log(stdout);
}

/**
 * Example 2: Generate a Bollinger Bands indicator
 */
async function generateBollingerBands() {
    console.log('\n📜 Example 2: Generate Bollinger Bands\n');
    
    const { stdout } = await execAsync(
        `python3 ${GENERATOR_PATH} indicator --type bollinger --name "K.I.T. BB" --length 20 --multiplier 2.0`
    );
    
    console.log('Generated Pine Script:');
    console.log(stdout);
}

/**
 * Example 3: Generate a Moving Average Crossover Strategy
 */
async function generateMAStrategy() {
    console.log('\n📜 Example 3: Generate MA Crossover Strategy\n');
    
    const { stdout } = await execAsync(
        `python3 ${GENERATOR_PATH} strategy ` +
        `--name "K.I.T. MA Cross" ` +
        `--indicators "ema:9,ema:21" ` +
        `--entry "ta.crossover(ema_9, ema_21)" ` +
        `--exit "ta.crossunder(ema_9, ema_21)" ` +
        `--sl-pct 2.0 ` +
        `--tp-pct 4.0`
    );
    
    console.log('Generated Pine Script:');
    console.log(stdout);
}

/**
 * Example 4: Generate from natural language description
 */
async function generateFromDescription() {
    console.log('\n📜 Example 4: Generate from Description\n');
    
    const description = "Create a strategy that buys when RSI is below 30 and price is at the lower Bollinger Band";
    
    const { stdout } = await execAsync(
        `python3 ${GENERATOR_PATH} describe --prompt "${description}"`
    );
    
    console.log('Generated Pine Script:');
    console.log(stdout);
}

/**
 * Example 5: Save generated script to file
 */
async function saveToFile() {
    console.log('\n📜 Example 5: Save to File\n');
    
    const outputPath = './output/my_strategy.pine';
    
    await execAsync(
        `python3 ${GENERATOR_PATH} indicator --type macd --name "K.I.T. MACD" --output ${outputPath}`
    );
    
    console.log(`✅ Script saved to ${outputPath}`);
}

// Run examples
async function main() {
    console.log('=' .repeat(60));
    console.log('K.I.T. TradingView Script Generator Examples');
    console.log('=' .repeat(60));
    
    try {
        await generateRSIIndicator();
        await generateBollingerBands();
        await generateMAStrategy();
        await generateFromDescription();
        // await saveToFile(); // Uncomment to test file saving
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
