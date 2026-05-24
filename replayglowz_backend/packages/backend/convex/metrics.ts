import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getUserId } from "./utils";

// =============================================================================
// YOUTUBE API QUOTA COSTS
// =============================================================================

export const YOUTUBE_QUOTA_COSTS = {
  "playlists.list": 1,
  "playlistItems.list": 1,
  "videos.list": 1,
  "channels.list": 1,
  "subscriptions.list": 1,
  "search.list": 100,
  "playlists.insert": 50,
  "playlists.delete": 50,
  "playlistItems.insert": 50,
  "playlistItems.delete": 50,
  "playlistItems.update": 50,
  "playlists.update": 50,
} as const;

export type YouTubeEndpoint = keyof typeof YOUTUBE_QUOTA_COSTS;

export const DAILY_QUOTA_LIMIT = 10000;

// Metrics retention period (30 days in milliseconds)
const METRICS_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the start of today in Pacific Time (YouTube quota resets at midnight PT)
 */
function getTodayStartPacific(): number {
  const now = new Date();
  // Create a date string in Pacific Time
  const pacificString = now.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });
  const pacificDate = new Date(pacificString);
  // Set to start of day
  pacificDate.setHours(0, 0, 0, 0);
  // Convert back to UTC timestamp
  const pacificOffset = now.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
  });
  // Extract offset (e.g., "GMT-8" or "GMT-7")
  const offsetMatch = pacificOffset.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -8;
  // Adjust for timezone offset
  return pacificDate.getTime() - offsetHours * 60 * 60 * 1000;
}

/**
 * Get date string in YYYY-MM-DD format for Pacific Time
 */
function getDateStringPacific(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function getProjectDailyQuotaLimit(): number {
  const raw = process.env.YOUTUBE_PROJECT_DAILY_QUOTA;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DAILY_QUOTA_LIMIT;
}

// =============================================================================
// INTERNAL MUTATIONS (for use by actions)
// =============================================================================

/**
 * Internal mutation to log an API call (called from actions)
 */
export const logApiCallInternal = internalMutation({
  args: {
    userId: v.string(),
    endpoint: v.string(),
    quotaUnits: v.number(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    responseTimeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("apiMetrics", {
      userId: args.userId,
      endpoint: args.endpoint,
      quotaUnits: args.quotaUnits,
      success: args.success,
      errorMessage: args.errorMessage,
      responseTimeMs: args.responseTimeMs,
      timestamp: Date.now(),
    });
  },
});

/**
 * Clean up old metrics (keep 30 days)
 */
export const cleanupOldMetrics = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - METRICS_RETENTION_MS;

    const oldMetrics = await ctx.db
      .query("apiMetrics")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .collect();

    let deleted = 0;
    for (const metric of oldMetrics) {
      await ctx.db.delete(metric._id);
      deleted++;
    }

    return { deleted };
  },
});

// =============================================================================
// PUBLIC MUTATIONS
// =============================================================================

/**
 * Log an API call (for manual logging if needed)
 */
export const logApiCall = mutation({
  args: {
    endpoint: v.string(),
    quotaUnits: v.number(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    responseTimeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    await ctx.db.insert("apiMetrics", {
      userId,
      endpoint: args.endpoint,
      quotaUnits: args.quotaUnits,
      success: args.success,
      errorMessage: args.errorMessage,
      responseTimeMs: args.responseTimeMs,
      timestamp: Date.now(),
    });
  },
});

// =============================================================================
// QUERIES
// =============================================================================

// Plan-based quota limits
const PLAN_QUOTA_LIMITS = {
  free: 1000,
  pro: 10000,
  team: 50000,
} as const;

async function getQuotaUsageForUser(ctx: any, userId: string) {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_user_id", (q: any) => q.eq("userId", userId))
    .first();

  const plan = subscription?.plan ?? "free";
  const productLimit = PLAN_QUOTA_LIMITS[plan as keyof typeof PLAN_QUOTA_LIMITS];
  const projectLimit = getProjectDailyQuotaLimit();
  const limit = Math.min(productLimit, projectLimit);
  const todayStart = getTodayStartPacific();

  const todayMetrics = await ctx.db
    .query("apiMetrics")
    .withIndex("by_user_and_timestamp", (q: any) =>
      q.eq("userId", userId).gte("timestamp", todayStart)
    )
    .collect();

  const used = todayMetrics.reduce((sum: number, m: any) => sum + m.quotaUnits, 0);
  const percentage = Math.round((used / limit) * 100);

  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    percentage: Math.min(percentage, 100),
    plan,
    productLimit,
    projectLimit,
  };
}

/**
 * Get today's quota usage for the current user
 */
export const getTodayQuotaUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      return { used: 0, limit: PLAN_QUOTA_LIMITS.free, percentage: 0 };
    }

    return getQuotaUsageForUser(ctx, userId);
  },
});

/**
 * Internal quota usage read for quota-aware actions.
 */
export const getQuotaUsageForUserInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return getQuotaUsageForUser(ctx, args.userId);
  },
});

/**
 * Get quota usage history (last N days)
 */
export const getQuotaHistory = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    const days = args.days ?? 7;
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const metrics = await ctx.db
      .query("apiMetrics")
      .withIndex("by_user_and_timestamp", (q) =>
        q.eq("userId", userId).gte("timestamp", startTime)
      )
      .collect();

    // Group by date (Pacific Time)
    const byDate = new Map<string, number>();

    // Initialize all days to 0
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateString = getDateStringPacific(date.getTime());
      byDate.set(dateString, 0);
    }

    // Sum up quota units per day
    for (const metric of metrics) {
      const dateString = getDateStringPacific(metric.timestamp);
      const current = byDate.get(dateString) ?? 0;
      byDate.set(dateString, current + metric.quotaUnits);
    }

    // Convert to array sorted by date
    return Array.from(byDate.entries())
      .map(([date, units]) => ({ date, units }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

/**
 * Get recent API calls for the current user
 */
export const getRecentApiCalls = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    const limit = args.limit ?? 50;

    const metrics = await ctx.db
      .query("apiMetrics")
      .withIndex("by_user_and_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return metrics.map((m) => ({
      id: m._id,
      endpoint: m.endpoint,
      quotaUnits: m.quotaUnits,
      success: m.success,
      errorMessage: m.errorMessage,
      responseTimeMs: m.responseTimeMs,
      timestamp: m.timestamp,
    }));
  },
});
