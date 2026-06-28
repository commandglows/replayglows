import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { internalAction, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { missingEnvVariableUrl } from "./utils";

const SUMMARY_MODEL = "gpt-5.4-mini";
const MAX_SUMMARY_INPUT_CHARS = 12000;
const SummarySchema = z.object({
  summary: z.string().min(1).max(1200),
});

export const openaiKeySet = query({
  args: {},
  handler: async () => {
    return !!process.env.OPENAI_API_KEY;
  },
});

export const summary = internalAction({
  args: {
    id: v.id("notes"),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { id, title, content }) => {
    const titleText = title.trim();
    const contentText = content.trim().slice(0, MAX_SUMMARY_INPUT_CHARS);
    const prompt = `Title: ${titleText}\n\nNote content:\n${contentText}`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const error = missingEnvVariableUrl(
        "OPENAI_API_KEY",
        "https://platform.openai.com/account/api-keys",
      );
      throw new Error(error);
    }

    try {
      const openai = new OpenAI({ apiKey });
      const output = await openai.responses.parse({
        model: SUMMARY_MODEL,
        input: [
          {
            role: "system",
            content:
              "Return a concise summary of the note. Output must strictly match the schema.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        text: {
          format: zodTextFormat(SummarySchema, "note_summary"),
        },
      });

      const parsedOutput = output.output_parsed;
      if (!parsedOutput?.summary?.trim()) {
        throw new Error("OpenAI returned no valid summary.");
      }

      await ctx.runMutation(internal.openai.saveSummary, {
        id: id,
        summary: parsedOutput.summary.trim(),
      });
    } catch (error) {
      console.error("OpenAI summary generation failed.");
      throw new Error("Failed to generate note summary.");
    }
  },
});

export const saveSummary = internalMutation({
  args: {
    id: v.id("notes"),
    summary: v.string(),
  },
  handler: async (ctx, { id, summary }) => {
    await ctx.db.patch(id, {
      summary: summary,
    });
  },
});
