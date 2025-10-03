// pages/api/cache/refresh.js
import cache from '../../../lib/simple-cache';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  try {
    // Require login
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { action } = req.query;

    if (action === 'clear') {
      // Clear all cache
      cache.clear();
      return res.json({
        message: "All cache cleared successfully",
        timestamp: new Date().toISOString()
      });
    } else if (action === 'status') {
      // Get cache status
      const status = cache.getStatus();
      return res.json({
        message: "Cache status retrieved",
        ...status
      });
    } else {
      // Default: clear mentor-specific cache keys
      const mentorEmail = session.user.email.toLowerCase().trim();
      const keysToDelete = [
        `mentor-stats:${mentorEmail}`,
        `mapping:bangkit`,
        `mapping:maju`,
        'framework-bank'
      ];

      let deletedCount = 0;
      for (const key of keysToDelete) {
        if (cache.delete(key)) {
          deletedCount++;
        }
      }

      return res.json({
        message: `Cache refresh completed for ${mentorEmail}`,
        deletedKeys: deletedCount,
        clearedKeys: keysToDelete,
        timestamp: new Date().toISOString()
      });
    }

  } catch (e) {
    console.error('Error in cache refresh:', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
}