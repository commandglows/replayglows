import { v } from "convex/values";
import { internalQuery, QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";

export const REPLAYGLOWS_PRODUCT_ID = "replayglows";
export const REPLAYGLOWS_LEGACY_PRODUCT_IDS = ["replayglowz", "tubeflow"];
export const DEFAULT_FREE_ACCESS_REASON = "default_free_entitlement";
const DEFAULT_FREE_SNAPSHOT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type DbCtx = QueryCtx | MutationCtx;
type ProductAccessDecision = {
  hasAccess: boolean;
  accountRecognized: boolean;
  productId: string;
  matchedProductId?: string;
  globalUserId?: string;
  reasonCode?: string;
};

function isActiveAccessStatus(status: string) {
  return status === "active" || status === "trialing";
}

function acceptedProductIds(productId = REPLAYGLOWS_PRODUCT_ID, legacyProductIds = REPLAYGLOWS_LEGACY_PRODUCT_IDS) {
  return [productId, ...legacyProductIds];
}

async function getReplayGlowsAccessDecisionFromDb(
  ctx: DbCtx,
  userId: string,
  productId = REPLAYGLOWS_PRODUCT_ID,
  legacyProductIds = REPLAYGLOWS_LEGACY_PRODUCT_IDS,
): Promise<ProductAccessDecision> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
    .first();

  let revokedSnapshot:
    | {
        productId: string;
        reasonCode?: string;
        globalUserId?: string;
      }
    | null = null;
  const now = Date.now();

  for (const acceptedProductId of acceptedProductIds(productId, legacyProductIds)) {
    const snapshot = await ctx.db
      .query("productAccessSnapshots")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", acceptedProductId),
      )
      .first();

    if (!snapshot || snapshot.expiresAt <= now) continue;

    if (isActiveAccessStatus(snapshot.status)) {
      return {
        hasAccess: true,
        accountRecognized: true,
        productId,
        matchedProductId: acceptedProductId,
        globalUserId: snapshot.globalUserId,
      };
    }

    if (snapshot.status === "revoked") {
      revokedSnapshot = {
        productId: acceptedProductId,
        reasonCode:
          snapshot.reasonCode === DEFAULT_FREE_ACCESS_REASON
            ? undefined
            : snapshot.reasonCode,
        globalUserId: snapshot.globalUserId,
      };
    }
  }

  if (revokedSnapshot) {
    return {
      hasAccess: false,
      accountRecognized: true,
      productId,
      matchedProductId: revokedSnapshot.productId,
      globalUserId: revokedSnapshot.globalUserId,
      reasonCode: revokedSnapshot.reasonCode ?? "product_access_revoked",
    };
  }

  return {
    hasAccess: false,
    accountRecognized: user !== null,
    productId,
    reasonCode: user === null ? "account_not_found" : "missing_product_entitlement",
  };
}

export async function ensureDefaultReplayGlowsAccessSnapshot(ctx: MutationCtx, userId: string) {
  const now = Date.now();
  const existing = await ctx.db
    .query("productAccessSnapshots")
    .withIndex("by_user_product", (q) =>
      q.eq("userId", userId).eq("productId", REPLAYGLOWS_PRODUCT_ID),
    )
    .first();

  if (existing) {
    if (existing.status === "revoked") return existing._id;
    if (
      existing.source !== "legacy" ||
      existing.reasonCode !== DEFAULT_FREE_ACCESS_REASON ||
      !isActiveAccessStatus(existing.status)
    ) {
      return existing._id;
    }
    await ctx.db.patch(existing._id, {
      expiresAt: Math.max(existing.expiresAt, now + DEFAULT_FREE_SNAPSHOT_TTL_MS),
      updatedAt: now,
    });
    return existing._id;
  }

  for (const legacyProductId of REPLAYGLOWS_LEGACY_PRODUCT_IDS) {
    const legacySnapshot = await ctx.db
      .query("productAccessSnapshots")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", legacyProductId),
      )
      .first();
    if (legacySnapshot?.status === "revoked") return legacySnapshot._id;
  }

  return await ctx.db.insert("productAccessSnapshots", {
    userId,
    productId: REPLAYGLOWS_PRODUCT_ID,
    source: "legacy",
    status: "active",
    reasonCode: DEFAULT_FREE_ACCESS_REASON,
    expiresAt: now + DEFAULT_FREE_SNAPSHOT_TTL_MS,
    createdAt: now,
    updatedAt: now,
  });
}

export async function requireReplayGlowsAccess(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  const userId = identity?.subject;
  if (!userId) throw new Error("Unauthorized");

  const decision =
    "db" in ctx
      ? await getReplayGlowsAccessDecisionFromDb(ctx, userId)
      : await ctx.runQuery((internal as any).access.getReplayGlowsAccessDecision, {
          userId,
          productId: REPLAYGLOWS_PRODUCT_ID,
          legacyProductIds: REPLAYGLOWS_LEGACY_PRODUCT_IDS,
        });

  if (!decision.hasAccess) {
    throw new Error(decision.reasonCode ?? "product_access_inactive");
  }

  return userId;
}

export const getReplayGlowsAccessDecision = internalQuery({
  args: {
    userId: v.string(),
    productId: v.optional(v.string()),
    legacyProductIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await getReplayGlowsAccessDecisionFromDb(
      ctx,
      args.userId,
      args.productId ?? REPLAYGLOWS_PRODUCT_ID,
      args.legacyProductIds && args.legacyProductIds.length > 0
        ? args.legacyProductIds
        : REPLAYGLOWS_LEGACY_PRODUCT_IDS,
    );
  },
});

export async function getProductAccessStatusForUser(
  ctx: QueryCtx,
  userId: string,
  productId = REPLAYGLOWS_PRODUCT_ID,
  legacyProductIds = REPLAYGLOWS_LEGACY_PRODUCT_IDS,
) {
  return await getReplayGlowsAccessDecisionFromDb(ctx, userId, productId, legacyProductIds);
}
