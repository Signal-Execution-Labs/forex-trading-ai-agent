/**
 * K.I.T. Memory Manager
 * Inspired by OpenClaw's Memory System
 * 
 * Features:
 * - MEMORY.md for long-term curated memory
 * - memory/YYYY-MM-DD.md for daily notes
 * - Vector search with embeddings
 * - Hybrid search (BM25 + Vector)
 * - memory_search and memory_get tools
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'eventemitter3';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface MemoryConfig {
  workspaceDir: string;
  embeddings: EmbeddingConfig;
  sync: SyncConfig;
  search: SearchConfig;
}

export interface EmbeddingConfig {
  provider: 'openai' | 'local' | 'none';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  dimensions?: number;
}

export interface SyncConfig {
  watch: boolean;
  debounceMs: number;
  autoIndex: boolean;
}

export interface SearchConfig {
  maxResults: number;
  minScore: number;
  hybrid: {
    enabled: boolean;
    vectorWeight: number;
    textWeight: number;
  };
}

export interface MemoryChunk {
  id: string;
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  embedding?: number[];
  hash: string;
}

export interface SearchResult {
  chunk: MemoryChunk;
  score: number;
  snippet: string;
  source: string;
}

export interface MemoryFile {
  path: string;
  relativePath: string;
  lastModified: Date;
  hash: string;
  chunks: MemoryChunk[];
}

export interface MemoryIndex {
  version: number;
  files: Record<string, MemoryFile>;
  embeddings: {
    provider: string;
    model: string;
    dimensions: number;
  };
  lastUpdated: Date;
}

// ============================================================================
// Memory Manager
// ============================================================================

export class MemoryManager extends EventEmitter {
  private config: MemoryConfig;
  private index: MemoryIndex;
  private indexPath: string;
  private watcher?: fs.FSWatcher;
  private syncDebounce?: NodeJS.Timeout;
  private embedQueue: MemoryChunk[] = [];
  private isProcessingEmbeds = false;
  
  // Chunking config
  private readonly CHUNK_TARGET_TOKENS = 400;
  private readonly CHUNK_OVERLAP_TOKENS = 80;
  private readonly APPROX_CHARS_PER_TOKEN = 4;
  
  constructor(agentId: string, config: Partial<MemoryConfig> = {}) {
    super();
    
    const defaultWorkspace = path.join(
      process.env.HOME || '',
      '.kit',
      'workspace'
    );
    
    this.config = {
      workspaceDir: config.workspaceDir || defaultWorkspace,
      embeddings: config.embeddings || { provider: 'none' },
      sync: config.sync || {
        watch: true,
        debounceMs: 1500,
        autoIndex: true,
      },
      search: config.search || {
        maxResults: 10,
        minScore: 0.5,
        hybrid: {
          enabled: true,
          vectorWeight: 0.7,
          textWeight: 0.3,
        },
      },
    };
    
    this.indexPath = path.join(
      process.env.HOME || '',
      '.kit',
      'memory',
      `${agentId}.json`
    );
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Load or initialize index
    this.index = this.loadIndex();
    
    // Start watching if enabled
    if (this.config.sync.watch) {
      this.startWatching();
    }
    
    // Initial sync if auto-index enabled
    if (this.config.sync.autoIndex) {
      this.sync().catch(err => {
        console.error('Initial memory sync failed:', err);
      });
    }
  }
  
  // ==========================================================================
  // Memory Tools API
  // ==========================================================================
  
  /**
   * Search memory (memory_search tool)
   */
  async search(query: string, options?: {
    maxResults?: number;
    minScore?: number;
  }): Promise<SearchResult[]> {
    const maxResults = options?.maxResults || this.config.search.maxResults;
    const minScore = options?.minScore || this.config.search.minScore;
    
    // Get all chunks
    const chunks = this.getAllChunks();
    if (chunks.length === 0) {
      return [];
    }
    
    let results: SearchResult[];
    
    if (this.config.search.hybrid.enabled && this.config.embeddings.provider !== 'none') {
      results = await this.hybridSearch(query, chunks, maxResults);
    } else if (this.config.embeddings.provider !== 'none') {
      results = await this.vectorSearch(query, chunks, maxResults);
    } else {
      results = this.textSearch(query, chunks, maxResults);
    }
    
    return results.filter(r => r.score >= minScore);
  }
  
  /**
   * Get memory file content (memory_get tool)
   */
  async get(filePath: string, options?: {
    startLine?: number;
    lines?: number;
  }): Promise<string | null> {
    // Validate path is within workspace
    const normalizedPath = this.normalizePath(filePath);
    if (!this.isValidMemoryPath(normalizedPath)) {
      return null;
    }
    
    const fullPath = path.join(this.config.workspaceDir, normalizedPath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    if (options?.startLine !== undefined) {
      const start = Math.max(0, options.startLine - 1);
      const count = options.lines || 50;
      return lines.slice(start, start + count).join('\n');
    }
    
    return content;
  }
  
  /**
   * Write to daily memory
   */
  async writeDailyNote(content: string): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const filePath = path.join(
      this.config.workspaceDir,
      'memory',
      `${date}.md`
    );
    
    // Ensure memory directory exists
    const memoryDir = path.dirname(filePath);
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }
    
    // Append with timestamp
    const timestamp = new Date().toLocaleTimeString();
    const entry = `\n## ${timestamp}\n\n${content}\n`;
    
    await fs.promises.appendFile(filePath, entry, 'utf-8');
    this.emit('memory.write', { path: filePath, content: entry });
    
    // Trigger sync
    this.scheduledSync();
  }
  
  /**
   * Write to MEMORY.md
   */
  async writeLongTermMemory(content: string, append: boolean = true): Promise<void> {
    const filePath = path.join(this.config.workspaceDir, 'MEMORY.md');
    
    if (append && fs.existsSync(filePath)) {
      const existing = await fs.promises.readFile(filePath, 'utf-8');
      await fs.promises.writeFile(filePath, existing + '\n\n' + content, 'utf-8');
    } else {
      await fs.promises.writeFile(filePath, content, 'utf-8');
    }
    
    this.emit('memory.write', { path: filePath, content });
    this.scheduledSync();
  }
  
  // ==========================================================================
  // Indexing
  // ==========================================================================
  
  /**
   * Sync memory files with index
   */
  async sync(): Promise<void> {
    const memoryPaths = this.findMemoryFiles();
    const updatedFiles: string[] = [];
    
    for (const filePath of memoryPaths) {
      const relativePath = path.relative(this.config.workspaceDir, filePath);
      const stat = fs.statSync(filePath);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const hash = this.hashContent(content);
      
      const existing = this.index.files[relativePath];
      
      // Check if file needs reindexing
      if (!existing || existing.hash !== hash) {
        const chunks = this.chunkContent(content, relativePath);
        
        this.index.files[relativePath] = {
          path: filePath,
          relativePath,
          lastModified: stat.mtime,
          hash,
          chunks,
        };
        
        // Queue chunks for embedding
        if (this.config.embeddings.provider !== 'none') {
          this.embedQueue.push(...chunks.filter(c => !c.embedding));
        }
        
        updatedFiles.push(relativePath);
      }
    }
    
    // Remove deleted files
    const currentPaths = new Set(memoryPaths.map(p => 
      path.relative(this.config.workspaceDir, p)
    ));
    
    for (const indexedPath of Object.keys(this.index.files)) {
      if (!currentPaths.has(indexedPath)) {
        delete this.index.files[indexedPath];
      }
    }
    
    // Process embedding queue
    await this.processEmbedQueue();
    
    // Save index
    this.saveIndex();
    
    if (updatedFiles.length > 0) {
      this.emit('memory.sync', { updated: updatedFiles });
    }
  }
  
  /**
   * Find all memory markdown files
   */
  private findMemoryFiles(): string[] {
    const files: string[] = [];
    
    // MEMORY.md
    const mainMemory = path.join(this.config.workspaceDir, 'MEMORY.md');
    if (fs.existsSync(mainMemory)) {
      files.push(mainMemory);
    }
    
    // memory/*.md
    const memoryDir = path.join(this.config.workspaceDir, 'memory');
    if (fs.existsSync(memoryDir)) {
      const memoryFiles = fs.readdirSync(memoryDir)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(memoryDir, f));
      files.push(...memoryFiles);
    }
    
    return files;
  }
  
  /**
   * Chunk content into searchable pieces
   */
  private chunkContent(content: string, filePath: string): MemoryChunk[] {
    const lines = content.split('\n');
    const chunks: MemoryChunk[] = [];
    
    const targetChars = this.CHUNK_TARGET_TOKENS * this.APPROX_CHARS_PER_TOKEN;
    const overlapChars = this.CHUNK_OVERLAP_TOKENS * this.APPROX_CHARS_PER_TOKEN;
    
    let currentChunk: string[] = [];
    let currentLength = 0;
    let startLine = 1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLength = line.length + 1; // +1 for newline
      
      currentChunk.push(line);
      currentLength += lineLength;
      
      // Check if we should create a chunk
      if (currentLength >= targetChars) {
        const chunkContent = currentChunk.join('\n');
        chunks.push({
          id: this.generateChunkId(filePath, startLine),
          content: chunkContent,
          filePath,
          startLine,
          endLine: i + 1,
          hash: this.hashContent(chunkContent),
        });
        
        // Calculate overlap
        const overlapLines: string[] = [];
        let overlapLength = 0;
        
        for (let j = currentChunk.length - 1; j >= 0 && overlapLength < overlapChars; j--) {
          overlapLines.unshift(currentChunk[j]);
          overlapLength += currentChunk[j].length + 1;
          startLine = i + 1 - overlapLines.length + 1;
        }
        
        currentChunk = overlapLines;
        currentLength = overlapLength;
      }
    }
    
    // Final chunk
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      chunks.push({
        id: this.generateChunkId(filePath, startLine),
        content: chunkContent,
        filePath,
        startLine,
        endLine: lines.length,
        hash: this.hashContent(chunkContent),
      });
    }
    
    return chunks;
  }
  
  // ==========================================================================
  // Search
  // ==========================================================================
  
  /**
   * Hybrid search combining vector and text
   */
  private async hybridSearch(
    query: string,
    chunks: MemoryChunk[],
    maxResults: number
  ): Promise<SearchResult[]> {
    const vectorResults = await this.vectorSearch(query, chunks, maxResults * 2);
    const textResults = this.textSearch(query, chunks, maxResults * 2);
    
    // Merge results
    const scoreMap = new Map<string, { vector: number; text: number }>();
    
    for (const result of vectorResults) {
      scoreMap.set(result.chunk.id, { 
        vector: result.score, 
        text: 0 
      });
    }
    
    for (const result of textResults) {
      const existing = scoreMap.get(result.chunk.id);
      if (existing) {
        existing.text = result.score;
      } else {
        scoreMap.set(result.chunk.id, { vector: 0, text: result.score });
      }
    }
    
    // Calculate combined scores
    const { vectorWeight, textWeight } = this.config.search.hybrid;
    const total = vectorWeight + textWeight;
    
    const combined: SearchResult[] = [];
    const allChunksMap = new Map(chunks.map(c => [c.id, c]));
    
    for (const [chunkId, scores] of scoreMap) {
      const chunk = allChunksMap.get(chunkId);
      if (!chunk) continue;
      
      const combinedScore = (
        scores.vector * (vectorWeight / total) +
        scores.text * (textWeight / total)
      );
      
      combined.push({
        chunk,
        score: combinedScore,
        snippet: this.createSnippet(chunk.content),
        source: `${chunk.filePath}#L${chunk.startLine}-${chunk.endLine}`,
      });
    }
    
    return combined
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }
  
  /**
   * Vector search using embeddings
   */
  private async vectorSearch(
    query: string,
    chunks: MemoryChunk[],
    maxResults: number
  ): Promise<SearchResult[]> {
    // Get query embedding
    const queryEmbedding = await this.getEmbedding(query);
    if (!queryEmbedding) {
      return this.textSearch(query, chunks, maxResults);
    }
    
    // Calculate cosine similarity for all chunks
    const results: SearchResult[] = [];
    
    for (const chunk of chunks) {
      if (!chunk.embedding) continue;
      
      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      
      results.push({
        chunk,
        score: similarity,
        snippet: this.createSnippet(chunk.content),
        source: `${chunk.filePath}#L${chunk.startLine}-${chunk.endLine}`,
      });
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }
  
  /**
   * Text search using simple keyword matching
   */
  private textSearch(
    query: string,
    chunks: MemoryChunk[],
    maxResults: number
  ): SearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTerms.length === 0) return [];
    
    const results: SearchResult[] = [];
    
    for (const chunk of chunks) {
      const contentLower = chunk.content.toLowerCase();
      
      // Count matching terms
      let matchCount = 0;
      let totalOccurrences = 0;
      
      for (const term of queryTerms) {
        const regex = new RegExp(term, 'gi');
        const matches = contentLower.match(regex);
        if (matches) {
          matchCount++;
          totalOccurrences += matches.length;
        }
      }
      
      if (matchCount > 0) {
        // BM25-like scoring
        const termFrequency = totalOccurrences / chunk.content.length;
        const coverage = matchCount / queryTerms.length;
        const score = (termFrequency * 1000 + coverage) / 2;
        
        results.push({
          chunk,
          score: Math.min(score, 1), // Normalize to 0-1
          snippet: this.createSnippet(chunk.content, queryTerms[0]),
          source: `${chunk.filePath}#L${chunk.startLine}-${chunk.endLine}`,
        });
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }
  
  // ==========================================================================
  // Embeddings
  // ==========================================================================
  
  /**
   * Process embedding queue
   */
  private async processEmbedQueue(): Promise<void> {
    if (this.isProcessingEmbeds || this.embedQueue.length === 0) {
      return;
    }
    
    this.isProcessingEmbeds = true;
    
    try {
      const batch = this.embedQueue.splice(0, 100); // Process 100 at a time
      
      for (const chunk of batch) {
        const embedding = await this.getEmbedding(chunk.content);
        if (embedding) {
          chunk.embedding = embedding;
        }
      }
    } catch (error) {
      console.error('Failed to process embeddings:', error);
    } finally {
      this.isProcessingEmbeds = false;
      
      // Continue if more in queue
      if (this.embedQueue.length > 0) {
        setTimeout(() => this.processEmbedQueue(), 100);
      }
    }
  }
  
  /**
   * Get embedding for text
   */
  private async getEmbedding(text: string): Promise<number[] | null> {
    if (this.config.embeddings.provider === 'none') {
      return null;
    }
    
    if (this.config.embeddings.provider === 'openai') {
      return this.getOpenAIEmbedding(text);
    }
    
    // Add other providers here
    return null;
  }
  
  /**
   * Get embedding from OpenAI
   */
  private async getOpenAIEmbedding(text: string): Promise<number[] | null> {
    const apiKey = this.config.embeddings.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    
    try {
      const response = await fetch(
        this.config.embeddings.baseUrl || 'https://api.openai.com/v1/embeddings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.embeddings.model || 'text-embedding-3-small',
            input: text,
          }),
        }
      );
      
      const data = await response.json() as any;
      return data.data?.[0]?.embedding || null;
    } catch (error) {
      console.error('Failed to get OpenAI embedding:', error);
      return null;
    }
  }
  
  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  // ==========================================================================
  // Watching
  // ==========================================================================
  
  /**
   * Start watching memory files
   */
  private startWatching(): void {
    const memoryDir = path.join(this.config.workspaceDir, 'memory');
    const mainMemory = path.join(this.config.workspaceDir, 'MEMORY.md');
    
    // Watch memory directory
    if (fs.existsSync(memoryDir)) {
      this.watcher = fs.watch(memoryDir, { recursive: true }, (event, filename) => {
        if (filename?.endsWith('.md')) {
          this.scheduledSync();
        }
      });
    }
    
    // Watch MEMORY.md specifically
    if (fs.existsSync(mainMemory)) {
      fs.watch(mainMemory, () => this.scheduledSync());
    }
  }
  
  /**
   * Schedule a sync with debouncing
   */
  private scheduledSync(): void {
    if (this.syncDebounce) {
      clearTimeout(this.syncDebounce);
    }
    
    this.syncDebounce = setTimeout(() => {
      this.sync().catch(err => {
        console.error('Scheduled sync failed:', err);
      });
    }, this.config.sync.debounceMs);
  }
  
  // ==========================================================================
  // Persistence
  // ==========================================================================
  
  /**
   * Load index from disk
   */
  private loadIndex(): MemoryIndex {
    try {
      if (fs.existsSync(this.indexPath)) {
        const data = fs.readFileSync(this.indexPath, 'utf-8');
        const index = JSON.parse(data);
        
        // Check if embeddings config matches
        if (
          index.embeddings?.provider !== this.config.embeddings.provider ||
          index.embeddings?.model !== this.config.embeddings.model
        ) {
          // Config changed, need to reindex
          return this.createEmptyIndex();
        }
        
        return index;
      }
    } catch (error) {
      console.error('Failed to load memory index:', error);
    }
    
    return this.createEmptyIndex();
  }
  
  /**
   * Create empty index
   */
  private createEmptyIndex(): MemoryIndex {
    return {
      version: 1,
      files: {},
      embeddings: {
        provider: this.config.embeddings.provider,
        model: this.config.embeddings.model || '',
        dimensions: this.config.embeddings.dimensions || 1536,
      },
      lastUpdated: new Date(),
    };
  }
  
  /**
   * Save index to disk
   */
  private saveIndex(): void {
    try {
      this.index.lastUpdated = new Date();
      fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save memory index:', error);
    }
  }
  
  // ==========================================================================
  // Helpers
  // ==========================================================================
  
  /**
   * Get all chunks from index
   */
  private getAllChunks(): MemoryChunk[] {
    return Object.values(this.index.files).flatMap(f => f.chunks);
  }
  
  /**
   * Create a snippet from content
   */
  private createSnippet(content: string, highlight?: string): string {
    const maxLength = 700;
    let snippet = content.slice(0, maxLength);
    
    if (content.length > maxLength) {
      snippet = snippet.slice(0, snippet.lastIndexOf(' ')) + '...';
    }
    
    return snippet;
  }
  
  /**
   * Generate chunk ID
   */
  private generateChunkId(filePath: string, startLine: number): string {
    const hash = crypto.createHash('md5')
      .update(`${filePath}:${startLine}`)
      .digest('hex')
      .slice(0, 12);
    return `chunk_${hash}`;
  }
  
  /**
   * Hash content
   */
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }
  
  /**
   * Normalize path
   */
  private normalizePath(filePath: string): string {
    // Remove leading workspace path if present
    if (filePath.startsWith(this.config.workspaceDir)) {
      return path.relative(this.config.workspaceDir, filePath);
    }
    return filePath;
  }
  
  /**
   * Check if path is valid memory path
   */
  private isValidMemoryPath(relativePath: string): boolean {
    // Only allow MEMORY.md and memory/**/*.md
    if (relativePath === 'MEMORY.md') return true;
    if (relativePath.startsWith('memory/') && relativePath.endsWith('.md')) return true;
    return false;
  }
  
  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      path.dirname(this.indexPath),
      path.join(this.config.workspaceDir, 'memory'),
    ];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    if (this.watcher) {
      this.watcher.close();
    }
    if (this.syncDebounce) {
      clearTimeout(this.syncDebounce);
    }
  }
}

// Export factory function
export function createMemoryManager(
  agentId: string,
  config?: Partial<MemoryConfig>
): MemoryManager {
  return new MemoryManager(agentId, config);
}
