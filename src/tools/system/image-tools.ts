/**
 * K.I.T. Image Analysis Tools
 * Vision model integration for chart analysis
 */

import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolHandler } from './tool-registry';

// ============================================================================
// Image Analyze Tool
// ============================================================================

export const imageAnalyzeToolDefinition: ToolDefinition = {
  name: 'image_analyze',
  description: 'Analyze an image using a vision model (GPT-4V, Claude Vision, Gemini Vision). Perfect for trading chart analysis, pattern recognition, and visual data extraction.',
  parameters: {
    type: 'object',
    properties: {
      image: {
        type: 'string',
        description: 'Image source: URL (https://...), file path, or base64 data (data:image/png;base64,...)',
      },
      prompt: {
        type: 'string',
        description: 'Analysis prompt. What to look for in the image (e.g., "Analyze this trading chart and identify support/resistance levels, trend direction, and potential entry points")',
      },
      model: {
        type: 'string',
        description: 'Vision model to use: "gpt-4o", "gpt-4-vision-preview", "claude-3-opus", "claude-3-sonnet", "gemini-pro-vision" (default: auto-detect from config)',
        enum: ['gpt-4o', 'gpt-4-vision-preview', 'gpt-4o-mini', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-5-sonnet-20241022', 'gemini-pro-vision', 'gemini-1.5-flash'],
      },
      maxTokens: {
        type: 'number',
        description: 'Maximum tokens in response (default: 1024)',
      },
      detail: {
        type: 'string',
        description: 'Image detail level for OpenAI: "low", "high", "auto" (default: "auto")',
        enum: ['low', 'high', 'auto'],
      },
    },
    required: ['image', 'prompt'],
  },
};

async function imageToBase64(imagePath: string, workspaceDir: string): Promise<{ base64: string; mimeType: string }> {
  // Handle data URLs
  if (imagePath.startsWith('data:image/')) {
    const match = imagePath.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      return { base64: match[2], mimeType: match[1] };
    }
    throw new Error('Invalid data URL format');
  }

  // Handle URLs - download first
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    const response = await fetch(imagePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    return { 
      base64: buffer.toString('base64'), 
      mimeType: contentType.split(';')[0] 
    };
  }

  // Handle file path
  const resolvedPath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(workspaceDir, imagePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Image file not found: ${resolvedPath}`);
  }

  const buffer = fs.readFileSync(resolvedPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  const mimeType = mimeTypes[ext] || 'image/png';

  return { base64: buffer.toString('base64'), mimeType };
}

async function analyzeWithOpenAI(
  imageData: { base64: string; mimeType: string } | string,
  prompt: string,
  model: string,
  maxTokens: number,
  detail: string
): Promise<string> {
  const OpenAI = (await import('openai')).default;
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set in environment');
  }

  const client = new OpenAI({ apiKey });

  const imageUrl = typeof imageData === 'string'
    ? imageData
    : `data:${imageData.mimeType};base64,${imageData.base64}`;

  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl, detail } },
        ] as any,
      },
    ],
  });

  return response.choices[0]?.message?.content || 'No analysis generated';
}

async function analyzeWithAnthropic(
  imageData: { base64: string; mimeType: string },
  prompt: string,
  model: string,
  maxTokens: number
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set in environment');
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageData.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageData.base64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block: any) => block.type === 'text') as any;
  return textBlock?.text || 'No analysis generated';
}

async function analyzeWithGemini(
  imageData: { base64: string; mimeType: string },
  prompt: string,
  model: string
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY not set in environment');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model });

  const result = await genModel.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.base64,
      },
    },
  ]);

  return result.response.text();
}

function detectBestModel(): string {
  if (process.env.OPENAI_API_KEY) return 'gpt-4o';
  if (process.env.ANTHROPIC_API_KEY) return 'claude-3-5-sonnet-20241022';
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) return 'gemini-1.5-flash';
  throw new Error('No vision model API key found. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY');
}

export const imageAnalyzeToolHandler: ToolHandler = async (args, context) => {
  const { 
    image, 
    prompt, 
    model: requestedModel,
    maxTokens = 1024,
    detail = 'auto',
  } = args as {
    image: string;
    prompt: string;
    model?: string;
    maxTokens?: number;
    detail?: string;
  };

  const model = requestedModel || detectBestModel();
  
  // Determine provider from model name
  const isOpenAI = model.startsWith('gpt-');
  const isAnthropic = model.startsWith('claude-');
  const isGemini = model.startsWith('gemini-');

  let analysis: string;
  let imageSource: string;

  // For OpenAI with URLs, we can pass directly
  if (isOpenAI && (image.startsWith('http://') || image.startsWith('https://'))) {
    analysis = await analyzeWithOpenAI(image, prompt, model, maxTokens, detail);
    imageSource = 'url';
  } else {
    // Convert to base64 for all other cases
    const imageData = await imageToBase64(image, context.workspaceDir);
    imageSource = image.startsWith('data:') ? 'base64' : 
                  image.startsWith('http') ? 'url' : 'file';

    if (isOpenAI) {
      analysis = await analyzeWithOpenAI(imageData, prompt, model, maxTokens, detail);
    } else if (isAnthropic) {
      analysis = await analyzeWithAnthropic(imageData, prompt, model, maxTokens);
    } else if (isGemini) {
      analysis = await analyzeWithGemini(imageData, prompt, model);
    } else {
      throw new Error(`Unknown model provider for: ${model}`);
    }
  }

  return {
    success: true,
    model,
    imageSource,
    prompt,
    analysis,
  };
};

// ============================================================================
// Chart Analyze Tool (Specialized for Trading)
// ============================================================================

export const chartAnalyzeToolDefinition: ToolDefinition = {
  name: 'chart_analyze',
  description: 'Specialized chart analysis for trading. Automatically uses optimal prompts for technical analysis.',
  parameters: {
    type: 'object',
    properties: {
      image: {
        type: 'string',
        description: 'Chart image: URL, file path, or base64',
      },
      analysisType: {
        type: 'string',
        description: 'Type of analysis to perform',
        enum: ['full', 'trend', 'levels', 'patterns', 'entry', 'sentiment'],
      },
      symbol: {
        type: 'string',
        description: 'Trading symbol/pair (e.g., BTC/USDT, EUR/USD) for context',
      },
      timeframe: {
        type: 'string',
        description: 'Chart timeframe (e.g., 1h, 4h, 1d) for context',
      },
      additionalContext: {
        type: 'string',
        description: 'Additional context or specific questions',
      },
    },
    required: ['image'],
  },
};

const CHART_PROMPTS: Record<string, string> = {
  full: `Analyze this trading chart comprehensively:
1. **Trend Analysis**: Current trend direction, strength, and potential reversals
2. **Support/Resistance**: Key levels with approximate prices
3. **Patterns**: Any recognizable chart patterns (head & shoulders, triangles, flags, etc.)
4. **Indicators**: If visible, interpret any technical indicators
5. **Volume**: Volume analysis if visible
6. **Trading Signal**: Overall bias (bullish/bearish/neutral) with confidence
7. **Entry Points**: Potential entry zones and invalidation levels
Provide specific price levels where visible.`,

  trend: `Focus on trend analysis for this chart:
- Current trend direction (bullish/bearish/sideways)
- Trend strength (strong/moderate/weak)
- Trend lines and channels
- Moving averages position if visible
- Potential trend reversal signals
- Higher highs/higher lows or lower highs/lower lows pattern`,

  levels: `Identify key price levels in this chart:
- Major resistance levels (with prices if visible)
- Major support levels (with prices if visible)
- Psychological round numbers
- Previous swing highs/lows
- Order blocks or supply/demand zones
- Fibonacci levels if applicable`,

  patterns: `Identify chart patterns:
- Any classical patterns (double top/bottom, head & shoulders, triangles, wedges, flags)
- Candlestick patterns (doji, engulfing, hammer, etc.)
- Pattern completion status
- Target projections based on patterns
- Pattern reliability assessment`,

  entry: `Provide trading entry analysis:
- Best entry zones (specific prices if visible)
- Stop loss placement
- Take profit targets
- Risk/reward ratio
- Entry confirmation signals to watch for
- Invalidation scenarios`,

  sentiment: `Assess market sentiment from this chart:
- Buyer vs seller dominance
- Momentum indicators interpretation
- Volume sentiment if visible
- Candle body analysis
- Overall market psychology
- Fear/greed indication`,
};

export const chartAnalyzeToolHandler: ToolHandler = async (args, context) => {
  const { 
    image, 
    analysisType = 'full',
    symbol,
    timeframe,
    additionalContext,
  } = args as {
    image: string;
    analysisType?: string;
    symbol?: string;
    timeframe?: string;
    additionalContext?: string;
  };

  let prompt = CHART_PROMPTS[analysisType] || CHART_PROMPTS.full;

  // Add context
  if (symbol || timeframe) {
    const contextParts = [];
    if (symbol) contextParts.push(`Symbol: ${symbol}`);
    if (timeframe) contextParts.push(`Timeframe: ${timeframe}`);
    prompt = `Context: ${contextParts.join(', ')}\n\n${prompt}`;
  }

  if (additionalContext) {
    prompt += `\n\nAdditional questions: ${additionalContext}`;
  }

  // Use the generic image analyzer
  const result = await imageAnalyzeToolHandler({
    image,
    prompt,
    maxTokens: 2048,
  }, context) as Record<string, any>;

  return {
    ...result,
    analysisType,
    symbol,
    timeframe,
    isChartAnalysis: true,
  };
};

// ============================================================================
// Screenshot Analyze Tool (Combine browser screenshot + analysis)
// ============================================================================

export const screenshotAnalyzeToolDefinition: ToolDefinition = {
  name: 'screenshot_analyze',
  description: 'Take a screenshot of current browser page and analyze it. Combines browser_screenshot + image_analyze.',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Analysis prompt for the screenshot',
      },
      selector: {
        type: 'string',
        description: 'CSS selector to screenshot specific element (e.g., chart container)',
      },
      fullPage: {
        type: 'boolean',
        description: 'Capture full scrollable page',
      },
      savePath: {
        type: 'string',
        description: 'Optional path to save screenshot',
      },
    },
    required: ['prompt'],
  },
};

export const screenshotAnalyzeToolHandler: ToolHandler = async (args, context) => {
  const { prompt, selector, fullPage = false, savePath } = args as {
    prompt: string;
    selector?: string;
    fullPage?: boolean;
    savePath?: string;
  };

  // Import browser tools
  const { browserScreenshotToolHandler } = await import('./browser-tools');

  // Take screenshot
  const screenshotResult = await browserScreenshotToolHandler({
    selector,
    fullPage,
    path: savePath,
    type: 'png',
  }, context) as any;

  if (!screenshotResult.success) {
    throw new Error('Failed to take screenshot');
  }

  // Get base64 data
  let imageData: string;
  if (screenshotResult.base64) {
    imageData = `data:image/png;base64,${screenshotResult.base64}`;
  } else if (screenshotResult.path) {
    imageData = screenshotResult.path;
  } else {
    throw new Error('No screenshot data available');
  }

  // Analyze the screenshot
  const analysis = await imageAnalyzeToolHandler({
    image: imageData,
    prompt,
    maxTokens: 2048,
  }, context) as Record<string, any>;

  return {
    ...analysis,
    screenshot: {
      saved: !!savePath,
      path: screenshotResult.path,
      size: screenshotResult.size,
    },
  };
};
