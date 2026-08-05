import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireReplayGlowsAccess } from "./access";

export const getChannel = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("channels")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const createChannel = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("channels")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
    if (existing) throw new Error("Channel already exists");

    const channelId = await ctx.db.insert("channels", {
      userId,
      name: args.name,
      description: args.description,
      avatarUrl: args.avatarUrl,
    });
    return channelId;
  },
});

export const updateChannel = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowsAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const channel = await ctx.db
      .query("channels")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
    if (!channel) throw new Error("Channel not found");

    await ctx.db.patch(channel._id, {
      name: args.name,
      description: args.description,
      avatarUrl: args.avatarUrl,
    });
  },
});
