// lib/simple-cache.js
// Simple in-memory cache with TTL (Time-To-Live)

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  // Set item with TTL in milliseconds
  set(key, value, ttlMs = 600000) { // Default 10 minutes
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set the value
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttlMs
    });

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttlMs);

    this.timers.set(key, timer);

    console.log(`📦 Cache SET: ${key} (TTL: ${ttlMs}ms)`);
    return true;
  }

  // Get item (returns null if expired or not found)
  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      console.log(`❌ Cache MISS: ${key} (not found)`);
      return null;
    }

    // Check if expired
    const age = Date.now() - item.timestamp;
    if (age > item.ttl) {
      console.log(`⏰ Cache EXPIRED: ${key} (age: ${age}ms, ttl: ${item.ttl}ms)`);
      this.delete(key);
      return null;
    }

    console.log(`✅ Cache HIT: ${key} (age: ${age}ms, remaining: ${item.ttl - age}ms)`);
    return item.value;
  }

  // Delete item
  delete(key) {
    // Clear timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    // Remove from cache
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`🗑️ Cache DELETE: ${key}`);
    }
    return deleted;
  }

  // Clear all cache
  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cache.clear();
    console.log(`🧹 Cache CLEARED: All items removed`);
  }

  // Get cache status
  getStatus() {
    const items = [];
    for (const [key, item] of this.cache.entries()) {
      const age = Date.now() - item.timestamp;
      const remaining = Math.max(0, item.ttl - age);
      items.push({
        key,
        age,
        remaining,
        expired: remaining <= 0
      });
    }

    return {
      size: this.cache.size,
      items,
      timestamp: new Date().toISOString()
    };
  }

  // Check if item exists and is valid
  has(key) {
    return this.get(key) !== null;
  }

  // Get or Set pattern (cache-aside)
  async getOrSet(key, asyncFetcher, ttlMs = 600000) {
    // Try to get from cache first
    let value = this.get(key);

    if (value !== null) {
      return { value, fromCache: true };
    }

    // Not in cache, fetch data
    console.log(`🔄 Cache FETCH: ${key} (not in cache, calling fetcher)`);
    try {
      value = await asyncFetcher();
      this.set(key, value, ttlMs);
      return { value, fromCache: false };
    } catch (error) {
      console.error(`❌ Cache FETCH ERROR: ${key}:`, error);
      throw error;
    }
  }
}

// Global cache instance
const globalCache = new SimpleCache();

// Export both the class and a global instance
export { SimpleCache };
export default globalCache;