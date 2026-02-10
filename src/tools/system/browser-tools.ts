/**
 * K.I.T. Browser Automation Tools
 * Playwright-based browser control for chart analysis and web automation
 */

/// <reference lib="dom" />
import { ToolDefinition, ToolHandler } from './tool-registry';

// Lazy-load playwright to avoid crashes if not installed
let playwright: any = null;
let browserInstance: any = null;
let browserContext: any = null;
let activePage: any = null;

async function getPlaywright() {
  if (!playwright) {
    try {
      playwright = await import('playwright');
    } catch (error) {
      throw new Error(
        'Playwright not installed. Run: npm install playwright && npx playwright install chromium'
      );
    }
  }
  return playwright;
}

async function ensureBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    const pw = await getPlaywright();
    browserInstance = await pw.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    browserContext = await browserInstance.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
  }
  return { browser: browserInstance, context: browserContext };
}

async function getOrCreatePage() {
  const { context } = await ensureBrowser();
  if (!activePage || activePage.isClosed()) {
    activePage = await context.newPage();
  }
  return activePage;
}

// ============================================================================
// Browser Open Tool
// ============================================================================

export const browserOpenToolDefinition: ToolDefinition = {
  name: 'browser_open',
  description: 'Open a URL in the browser. Creates a new browser session if needed. Returns page title and URL.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to open (must include protocol, e.g., https://)',
      },
      waitFor: {
        type: 'string',
        description: 'Wait condition: "load", "domcontentloaded", "networkidle" (default: "load")',
        enum: ['load', 'domcontentloaded', 'networkidle'],
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
      },
    },
    required: ['url'],
  },
};

export const browserOpenToolHandler: ToolHandler = async (args, _context) => {
  const { url, waitFor = 'load', timeout = 30000 } = args as {
    url: string;
    waitFor?: 'load' | 'domcontentloaded' | 'networkidle';
    timeout?: number;
  };

  const page = await getOrCreatePage();
  
  await page.goto(url, {
    waitUntil: waitFor,
    timeout,
  });

  const title = await page.title();
  const currentUrl = page.url();

  return {
    success: true,
    url: currentUrl,
    title,
    message: `Opened ${currentUrl}`,
  };
};

// ============================================================================
// Browser Navigate Tool
// ============================================================================

export const browserNavigateToolDefinition: ToolDefinition = {
  name: 'browser_navigate',
  description: 'Navigate to a URL or perform navigation actions (back, forward, reload).',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Navigation action: "goto", "back", "forward", "reload"',
        enum: ['goto', 'back', 'forward', 'reload'],
      },
      url: {
        type: 'string',
        description: 'URL for "goto" action',
      },
      waitFor: {
        type: 'string',
        description: 'Wait condition: "load", "domcontentloaded", "networkidle"',
        enum: ['load', 'domcontentloaded', 'networkidle'],
      },
    },
    required: ['action'],
  },
};

export const browserNavigateToolHandler: ToolHandler = async (args, _context) => {
  const { action, url, waitFor = 'load' } = args as {
    action: 'goto' | 'back' | 'forward' | 'reload';
    url?: string;
    waitFor?: 'load' | 'domcontentloaded' | 'networkidle';
  };

  const page = await getOrCreatePage();

  switch (action) {
    case 'goto':
      if (!url) throw new Error('URL required for goto action');
      await page.goto(url, { waitUntil: waitFor });
      break;
    case 'back':
      await page.goBack({ waitUntil: waitFor });
      break;
    case 'forward':
      await page.goForward({ waitUntil: waitFor });
      break;
    case 'reload':
      await page.reload({ waitUntil: waitFor });
      break;
  }

  return {
    success: true,
    action,
    url: page.url(),
    title: await page.title(),
  };
};

// ============================================================================
// Browser Screenshot Tool
// ============================================================================

export const browserScreenshotToolDefinition: ToolDefinition = {
  name: 'browser_screenshot',
  description: 'Take a screenshot of the current page. Perfect for capturing trading charts for analysis.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path to save screenshot (optional, returns base64 if not provided)',
      },
      fullPage: {
        type: 'boolean',
        description: 'Capture full scrollable page (default: false)',
      },
      selector: {
        type: 'string',
        description: 'CSS selector to screenshot specific element',
      },
      type: {
        type: 'string',
        description: 'Image format: "png" or "jpeg" (default: "png")',
        enum: ['png', 'jpeg'],
      },
      quality: {
        type: 'number',
        description: 'JPEG quality 0-100 (only for jpeg)',
      },
    },
    required: [],
  },
};

export const browserScreenshotToolHandler: ToolHandler = async (args, context) => {
  const { 
    path: filePath, 
    fullPage = false, 
    selector, 
    type = 'png',
    quality 
  } = args as {
    path?: string;
    fullPage?: boolean;
    selector?: string;
    type?: 'png' | 'jpeg';
    quality?: number;
  };

  const page = await getOrCreatePage();

  const screenshotOptions: any = {
    fullPage,
    type,
  };

  if (quality && type === 'jpeg') {
    screenshotOptions.quality = quality;
  }

  let buffer: Buffer;

  if (selector) {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    buffer = await element.screenshot(screenshotOptions);
  } else {
    buffer = await page.screenshot(screenshotOptions);
  }

  if (filePath) {
    const fs = await import('fs');
    const path = await import('path');
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(context.workspaceDir, filePath);
    
    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(resolvedPath, buffer);
    
    return {
      success: true,
      path: resolvedPath,
      type,
      size: buffer.length,
      url: page.url(),
    };
  }

  return {
    success: true,
    base64: buffer.toString('base64'),
    type,
    size: buffer.length,
    url: page.url(),
  };
};

// ============================================================================
// Browser Snapshot Tool (DOM/Content)
// ============================================================================

export const browserSnapshotToolDefinition: ToolDefinition = {
  name: 'browser_snapshot',
  description: 'Get page content, DOM structure, or accessibility tree. Useful for understanding page structure before clicking.',
  parameters: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        description: 'Snapshot mode: "html" (full HTML), "text" (visible text), "aria" (accessibility tree), "links" (all links)',
        enum: ['html', 'text', 'aria', 'links'],
      },
      selector: {
        type: 'string',
        description: 'CSS selector to snapshot specific element (default: body)',
      },
      maxLength: {
        type: 'number',
        description: 'Maximum content length to return (default: 50000)',
      },
    },
    required: [],
  },
};

export const browserSnapshotToolHandler: ToolHandler = async (args, _context) => {
  const { mode = 'text', selector = 'body', maxLength = 50000 } = args as {
    mode?: 'html' | 'text' | 'aria' | 'links';
    selector?: string;
    maxLength?: number;
  };

  const page = await getOrCreatePage();

  let content: string;

  switch (mode) {
    case 'html':
      content = await page.$eval(selector, (el: any) => el.outerHTML);
      break;
    
    case 'text':
      content = await page.$eval(selector, (el: any) => el.textContent || '');
      break;
    
    case 'aria':
      // Get accessibility snapshot
      const accessibilitySnapshot = await page.accessibility.snapshot();
      content = JSON.stringify(accessibilitySnapshot, null, 2);
      break;
    
    case 'links':
      const links = await page.$$eval('a[href]', (anchors: any[]) => 
        anchors.map((a: any) => ({
          text: a.textContent?.trim().slice(0, 100),
          href: a.href,
        }))
      );
      content = JSON.stringify(links, null, 2);
      break;
    
    default:
      content = await page.$eval(selector, (el: any) => el.textContent || '');
  }

  const truncated = content.length > maxLength;
  if (truncated) {
    content = content.slice(0, maxLength) + '...[truncated]';
  }

  return {
    success: true,
    mode,
    url: page.url(),
    title: await page.title(),
    content,
    truncated,
    length: content.length,
  };
};

// ============================================================================
// Browser Click Tool
// ============================================================================

export const browserClickToolDefinition: ToolDefinition = {
  name: 'browser_click',
  description: 'Click on an element by CSS selector, text content, or coordinates.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of element to click',
      },
      text: {
        type: 'string',
        description: 'Click element containing this text',
      },
      x: {
        type: 'number',
        description: 'X coordinate for click (used with y)',
      },
      y: {
        type: 'number',
        description: 'Y coordinate for click (used with x)',
      },
      button: {
        type: 'string',
        description: 'Mouse button: "left", "right", "middle" (default: "left")',
        enum: ['left', 'right', 'middle'],
      },
      clickCount: {
        type: 'number',
        description: 'Number of clicks: 1 for single, 2 for double (default: 1)',
      },
      delay: {
        type: 'number',
        description: 'Delay between mousedown and mouseup in ms',
      },
    },
    required: [],
  },
};

export const browserClickToolHandler: ToolHandler = async (args, _context) => {
  const { 
    selector, 
    text, 
    x, 
    y, 
    button = 'left',
    clickCount = 1,
    delay = 0,
  } = args as {
    selector?: string;
    text?: string;
    x?: number;
    y?: number;
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    delay?: number;
  };

  const page = await getOrCreatePage();

  const clickOptions = {
    button,
    clickCount,
    delay,
  };

  if (selector) {
    await page.click(selector, clickOptions);
    return { success: true, clicked: selector, method: 'selector' };
  }

  if (text) {
    await page.click(`text="${text}"`, clickOptions);
    return { success: true, clicked: text, method: 'text' };
  }

  if (x !== undefined && y !== undefined) {
    await page.mouse.click(x, y, clickOptions);
    return { success: true, clicked: { x, y }, method: 'coordinates' };
  }

  throw new Error('Must provide selector, text, or coordinates (x, y)');
};

// ============================================================================
// Browser Type Tool
// ============================================================================

export const browserTypeToolDefinition: ToolDefinition = {
  name: 'browser_type',
  description: 'Type text into an input field or editable element.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector of input element',
      },
      text: {
        type: 'string',
        description: 'Text to type',
      },
      clear: {
        type: 'boolean',
        description: 'Clear existing content before typing (default: false)',
      },
      delay: {
        type: 'number',
        description: 'Delay between key presses in ms (default: 0)',
      },
      pressEnter: {
        type: 'boolean',
        description: 'Press Enter after typing (default: false)',
      },
    },
    required: ['selector', 'text'],
  },
};

export const browserTypeToolHandler: ToolHandler = async (args, _context) => {
  const { 
    selector, 
    text, 
    clear = false,
    delay = 0,
    pressEnter = false,
  } = args as {
    selector: string;
    text: string;
    clear?: boolean;
    delay?: number;
    pressEnter?: boolean;
  };

  const page = await getOrCreatePage();

  if (clear) {
    await page.fill(selector, '');
  }

  await page.type(selector, text, { delay });

  if (pressEnter) {
    await page.press(selector, 'Enter');
  }

  return {
    success: true,
    selector,
    typed: text.length,
    pressedEnter: pressEnter,
  };
};

// ============================================================================
// Browser Wait Tool
// ============================================================================

export const browserWaitToolDefinition: ToolDefinition = {
  name: 'browser_wait',
  description: 'Wait for an element, navigation, or timeout.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector to wait for',
      },
      state: {
        type: 'string',
        description: 'Element state: "attached", "visible", "hidden", "detached" (default: "visible")',
        enum: ['attached', 'visible', 'hidden', 'detached'],
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
      },
      navigation: {
        type: 'boolean',
        description: 'Wait for navigation to complete',
      },
      ms: {
        type: 'number',
        description: 'Simple wait for N milliseconds',
      },
    },
    required: [],
  },
};

export const browserWaitToolHandler: ToolHandler = async (args, _context) => {
  const { 
    selector, 
    state = 'visible',
    timeout = 30000,
    navigation = false,
    ms,
  } = args as {
    selector?: string;
    state?: 'attached' | 'visible' | 'hidden' | 'detached';
    timeout?: number;
    navigation?: boolean;
    ms?: number;
  };

  const page = await getOrCreatePage();

  if (ms) {
    await page.waitForTimeout(ms);
    return { success: true, waited: ms, type: 'timeout' };
  }

  if (navigation) {
    await page.waitForNavigation({ timeout });
    return { success: true, type: 'navigation', url: page.url() };
  }

  if (selector) {
    await page.waitForSelector(selector, { state, timeout });
    return { success: true, selector, state, type: 'selector' };
  }

  throw new Error('Must provide selector, navigation, or ms');
};

// ============================================================================
// Browser Close Tool
// ============================================================================

export const browserCloseToolDefinition: ToolDefinition = {
  name: 'browser_close',
  description: 'Close the browser or current page.',
  parameters: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: '"page" to close current page, "browser" to close entire browser',
        enum: ['page', 'browser'],
      },
    },
    required: [],
  },
};

export const browserCloseToolHandler: ToolHandler = async (args, _context) => {
  const { target = 'page' } = args as { target?: 'page' | 'browser' };

  if (target === 'browser') {
    if (browserInstance) {
      await browserInstance.close();
      browserInstance = null;
      browserContext = null;
      activePage = null;
    }
    return { success: true, closed: 'browser' };
  }

  if (activePage && !activePage.isClosed()) {
    await activePage.close();
    activePage = null;
  }
  return { success: true, closed: 'page' };
};

// ============================================================================
// Browser Evaluate Tool
// ============================================================================

export const browserEvaluateToolDefinition: ToolDefinition = {
  name: 'browser_evaluate',
  description: 'Execute JavaScript in the browser context. Use for custom interactions or data extraction.',
  parameters: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: 'JavaScript code to execute (will be wrapped in async function)',
      },
    },
    required: ['script'],
  },
};

export const browserEvaluateToolHandler: ToolHandler = async (args, _context) => {
  const { script } = args as { script: string };

  const page = await getOrCreatePage();

  const result = await page.evaluate(script);

  return {
    success: true,
    result,
    url: page.url(),
  };
};
