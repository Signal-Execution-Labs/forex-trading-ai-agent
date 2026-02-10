/**
 * K.I.T. Web Tools
 * Web search and fetch tools like OpenClaw
 * 
 * Tools:
 * - web_search: Search the web using Brave Search API
 * - web_fetch: Fetch and extract readable content from a URL
 */

import { ToolDefinition, ToolHandler } from './tool-registry';

// ============================================================================
// Types
// ============================================================================

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description: string;
    }>;
  };
  query?: {
    original: string;
  };
}

interface WebSearchResult {
  query: string;
  results: BraveSearchResult[];
  totalResults: number;
  provider: string;
}

interface WebFetchResult {
  url: string;
  finalUrl?: string;
  title?: string;
  content: string;
  contentType: string;
  truncated: boolean;
  charCount: number;
}

// ============================================================================
// Web Search Tool
// ============================================================================

export const webSearchToolDefinition: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web using Brave Search API. Returns titles, URLs, and snippets for fast research.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
      },
      count: {
        type: 'number',
        description: 'Number of results to return (1-10, default: 5)',
      },
      country: {
        type: 'string',
        description: '2-letter country code for region-specific results (e.g., "DE", "US", "ALL"). Default: "US"',
      },
      freshness: {
        type: 'string',
        description: 'Filter results by time: "pd" (past day), "pw" (past week), "pm" (past month), "py" (past year)',
        enum: ['pd', 'pw', 'pm', 'py'],
      },
    },
    required: ['query'],
  },
};

export const webSearchToolHandler: ToolHandler = async (args, _context) => {
  const { 
    query, 
    count = 5, 
    country = 'US',
    freshness,
  } = args as {
    query: string;
    count?: number;
    country?: string;
    freshness?: string;
  };

  // Get API key from environment
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new Error('BRAVE_API_KEY not configured. Please set it in your .env file.');
  }

  // Build search URL
  const params = new URLSearchParams({
    q: query,
    count: Math.min(10, Math.max(1, count)).toString(),
    country: country.toUpperCase(),
    text_decorations: 'false',
    search_lang: 'en',
  });

  if (freshness) {
    params.set('freshness', freshness);
  }

  const url = `https://api.search.brave.com/res/v1/web/search?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid BRAVE_API_KEY. Please check your API key.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as BraveSearchResponse;
    
    const results: BraveSearchResult[] = (data.web?.results || []).map(result => ({
      title: result.title,
      url: result.url,
      description: result.description,
    }));

    const searchResult: WebSearchResult = {
      query: data.query?.original || query,
      results,
      totalResults: results.length,
      provider: 'brave',
    };

    return searchResult;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Web search failed: ${String(error)}`);
  }
};

// ============================================================================
// Web Fetch Tool
// ============================================================================

export const webFetchToolDefinition: ToolDefinition = {
  name: 'web_fetch',
  description: 'Fetch and extract readable content from a URL. Converts HTML to clean markdown/text.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'HTTP or HTTPS URL to fetch',
      },
      extractMode: {
        type: 'string',
        description: 'Extraction mode: "markdown" (default) or "text"',
        enum: ['markdown', 'text'],
      },
      maxChars: {
        type: 'number',
        description: 'Maximum characters to return (default: 50000)',
      },
    },
    required: ['url'],
  },
};

export const webFetchToolHandler: ToolHandler = async (args, _context) => {
  const { 
    url, 
    extractMode = 'markdown',
    maxChars = 50000,
  } = args as {
    url: string;
    extractMode?: 'markdown' | 'text';
    maxChars?: number;
  };

  // Validate URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('URL must start with http:// or https://');
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'text/html';
    const html = await response.text();
    
    // Extract readable content
    let content: string;
    let title: string | undefined;

    if (contentType.includes('text/html')) {
      const extracted = extractReadableContent(html, extractMode);
      content = extracted.content;
      title = extracted.title;
    } else if (contentType.includes('text/plain') || contentType.includes('application/json')) {
      content = html;
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    // Truncate if needed
    const truncated = content.length > maxChars;
    if (truncated) {
      content = content.slice(0, maxChars) + '\n\n[... content truncated ...]';
    }

    const result: WebFetchResult = {
      url,
      finalUrl: response.url !== url ? response.url : undefined,
      title,
      content,
      contentType,
      truncated,
      charCount: content.length,
    };

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch URL: ${error.message}`);
    }
    throw new Error(`Failed to fetch URL: ${String(error)}`);
  }
};

// ============================================================================
// HTML to Markdown/Text Extraction
// ============================================================================

interface ExtractedContent {
  title?: string;
  content: string;
}

function extractReadableContent(html: string, mode: 'markdown' | 'text'): ExtractedContent {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : undefined;

  // Remove scripts, styles, and other non-content elements
  let content = html
    // Remove scripts
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Remove styles
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove head
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    // Remove nav
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    // Remove footer
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    // Remove header (site header, not h1-h6)
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    // Remove aside
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    // Remove forms
    .replace(/<form[\s\S]*?<\/form>/gi, '');

  if (mode === 'markdown') {
    content = htmlToMarkdown(content);
  } else {
    content = htmlToText(content);
  }

  // Clean up whitespace
  content = content
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return { title, content };
}

function htmlToMarkdown(html: string): string {
  let md = html
    // Headers
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n')
    // Bold
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**')
    // Italic
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*')
    // Code blocks
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
    // Inline code
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    // Links - extract href and text
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Images - extract src and alt
    .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
    // Blockquotes
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, p1) => {
      return '\n' + p1.trim().split('\n').map((line: string) => '> ' + line).join('\n') + '\n';
    })
    // Unordered lists
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '\n$1\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    // Ordered lists (simplified)
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '\n$1\n')
    // Paragraphs and divs
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '\n$1\n')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Horizontal rules
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

  return md;
}

function htmlToText(html: string): string {
  let text = html
    // Add newlines for block elements
    .replace(/<(p|div|h[1-6]|li|br|hr)[^>]*>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    // Remove all HTML tags
    .replace(/<[^>]+>/g, '');
  
  // Decode entities
  text = decodeHtmlEntities(text);
  
  return text;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}
