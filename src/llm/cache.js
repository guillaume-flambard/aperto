/**
 * LLM Cache - Caching system for LLM responses
 * Stores responses to avoid repeated API calls
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class LLMCache {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || this.getDefaultCacheDir();
    this.ttl = options.ttl || 7 * 24 * 60 * 60 * 1000; // 7 days default
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB default
  }

  getDefaultCacheDir() {
    // Global cache in user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(homeDir, '.cache', 'aperto', 'llm');
  }

  /**
   * Get cached response
   */
  async get(key) {
    try {
      const cacheFile = this.getCacheFile(key);
      
      if (!await fs.pathExists(cacheFile)) {
        return null;
      }

      const data = await fs.readJson(cacheFile);
      
      // Check TTL
      if (Date.now() - data.timestamp > this.ttl) {
        await fs.remove(cacheFile);
        return null;
      }

      return data.response;
    } catch (error) {
      return null;
    }
  }

  /**
   * Store response in cache
   */
  async set(key, response) {
    try {
      await fs.ensureDir(this.cacheDir);
      
      const cacheFile = this.getCacheFile(key);
      const data = {
        key,
        response,
        timestamp: Date.now(),
        size: JSON.stringify(response).length
      };

      await fs.writeJson(cacheFile, data);
      
      // Cleanup old entries if cache too large
      await this.cleanupIfNeeded();
    } catch (error) {
      // Fail silently - caching is optional
    }
  }

  /**
   * Get cache file path for a key
   */
  getCacheFile(key) {
    // Create subdirectory based on first 2 chars of key for better filesystem performance
    const subDir = key.substring(0, 2);
    return path.join(this.cacheDir, subDir, `${key}.json`);
  }

  /**
   * Clear all cached entries
   */
  async clear() {
    try {
      if (await fs.pathExists(this.cacheDir)) {
        await fs.remove(this.cacheDir);
      }
    } catch (error) {
      // Fail silently
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      if (!await fs.pathExists(this.cacheDir)) {
        return { entries: 0, size: 0 };
      }

      const entries = await this.getAllEntries();
      const totalSize = entries.reduce((sum, e) => sum + (e.size || 0), 0);

      return {
        entries: entries.length,
        size: totalSize,
        sizeHuman: this.formatBytes(totalSize)
      };
    } catch (error) {
      return { entries: 0, size: 0, error: error.message };
    }
  }

  /**
   * Get all cache entries
   */
  async getAllEntries() {
    const entries = [];
    
    try {
      const subDirs = await fs.readdir(this.cacheDir);
      
      for (const subDir of subDirs) {
        const subPath = path.join(this.cacheDir, subDir);
        const stat = await fs.stat(subPath);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(subPath);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              try {
                const data = await fs.readJson(path.join(subPath, file));
                entries.push(data);
              } catch (e) {
                // Skip invalid entries
              }
            }
          }
        }
      }
    } catch (error) {
      // Return empty array on error
    }
    
    return entries;
  }

  /**
   * Cleanup old entries if cache exceeds max size
   */
  async cleanupIfNeeded() {
    try {
      const stats = await this.getStats();
      
      if (stats.size < this.maxSize) {
        return;
      }

      // Get all entries sorted by timestamp (oldest first)
      const entries = await this.getAllEntries();
      entries.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest entries until under 80% of max size
      const targetSize = this.maxSize * 0.8;
      let currentSize = stats.size;

      for (const entry of entries) {
        if (currentSize <= targetSize) {
          break;
        }

        const cacheFile = this.getCacheFile(entry.key);
        await fs.remove(cacheFile);
        currentSize -= (entry.size || 0);
      }
    } catch (error) {
      // Fail silently
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = { LLMCache };
