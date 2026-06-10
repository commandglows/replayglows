import { v } from "convex/values";
import { action, mutation, query, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireReplayGlowzAccess } from "./access";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getEncryptionKey() {
  const secret = process.env.TRANSCRIPT_SECRET_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Missing TRANSCRIPT_SECRET_ENCRYPTION_KEY environment variable.");
  }
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return await crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (value) => String.fromCharCode(value)).join(""));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function encryptValue(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await getEncryptionKey(),
    encoder.encode(value)
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decryptValue(payload: string) {
  const [ivRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted transcript secret payload.");
  }
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivRaw) },
    await getEncryptionKey(),
    base64ToBytes(encryptedRaw)
  );
  return decoder.decode(decrypted);
}

function maskValue(value: string) {
  const visible = value.slice(-4);
  return `••••${visible}`;
}

export const getSecretsStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("transcriptProviderSecrets")
      .withIndex("by_user_and_provider", (q) => q.eq("userId", userId))
      .collect();

    return rows.map((row) => ({
      provider: row.provider,
      maskedValue: row.maskedValue,
      updatedAt: row.updatedAt,
    }));
  },
});

export const upsertSecret = mutation({
  args: {
    provider: v.union(v.literal("openai"), v.literal("deepgram")),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const encryptedValue = await encryptValue(args.apiKey.trim());
    const existing = await ctx.db
      .query("transcriptProviderSecrets")
      .withIndex("by_user_and_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedValue,
        maskedValue: maskValue(args.apiKey.trim()),
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("transcriptProviderSecrets", {
      userId,
      provider: args.provider,
      encryptedValue,
      maskedValue: maskValue(args.apiKey.trim()),
      updatedAt: Date.now(),
    });
  },
});

export const deleteSecret = mutation({
  args: {
    provider: v.union(v.literal("openai"), v.literal("deepgram")),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("transcriptProviderSecrets")
      .withIndex("by_user_and_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getDecryptedSecret = internalQuery({
  args: {
    userId: v.string(),
    provider: v.union(v.literal("openai"), v.literal("deepgram")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("transcriptProviderSecrets")
      .withIndex("by_user_and_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", args.provider)
      )
      .first();

    if (!existing) return null;

    return {
      provider: existing.provider,
      apiKey: await decryptValue(existing.encryptedValue),
      maskedValue: existing.maskedValue,
      updatedAt: existing.updatedAt,
    };
  },
});

export const testSecret = action({
  args: {
    provider: v.union(v.literal("openai"), v.literal("deepgram")),
  },
  handler: async (ctx, args) => {
    const userId = await requireReplayGlowzAccess(ctx);
    if (!userId) throw new Error("Unauthorized");

    const stored = await ctx.runQuery(internal.transcriptSecrets.getDecryptedSecret, {
      userId,
      provider: args.provider,
    });

    if (!stored?.apiKey) {
      throw new Error("No API key saved for this provider.");
    }

    if (args.provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${stored.apiKey}`,
        },
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "OpenAI API key test failed.");
      }
      return { provider: args.provider, ok: true };
    }

    const response = await fetch("https://api.deepgram.com/v1/projects", {
      headers: {
        Authorization: `Token ${stored.apiKey}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || "Deepgram API key test failed.");
    }

    return { provider: args.provider, ok: true };
  },
});
