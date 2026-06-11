/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as androidPush from "../androidPush.js";
import type * as channelLinks from "../channelLinks.js";
import type * as channels from "../channels.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as diagnostics from "../diagnostics.js";
import type * as feedChecker from "../feedChecker.js";
import type * as feedback from "../feedback.js";
import type * as hidden from "../hidden.js";
import type * as http from "../http.js";
import type * as likes from "../likes.js";
import type * as metrics from "../metrics.js";
import type * as notes from "../notes.js";
import type * as notifications from "../notifications.js";
import type * as openai from "../openai.js";
import type * as playlistOrder from "../playlistOrder.js";
import type * as playlists from "../playlists.js";
import type * as progress from "../progress.js";
import type * as pushDelivery from "../pushDelivery.js";
import type * as settings from "../settings.js";
import type * as subscriptions from "../subscriptions.js";
import type * as transcriptGeneration from "../transcriptGeneration.js";
import type * as transcriptProviders from "../transcriptProviders.js";
import type * as transcriptSecrets from "../transcriptSecrets.js";
import type * as transcripts from "../transcripts.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as videoOrder from "../videoOrder.js";
import type * as videos from "../videos.js";
import type * as virtualFeeds from "../virtualFeeds.js";
import type * as watched from "../watched.js";
import type * as webhooks from "../webhooks.js";
import type * as youtube from "../youtube.js";
import type * as youtubeInteractions from "../youtubeInteractions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  androidPush: typeof androidPush;
  channelLinks: typeof channelLinks;
  channels: typeof channels;
  comments: typeof comments;
  crons: typeof crons;
  diagnostics: typeof diagnostics;
  feedChecker: typeof feedChecker;
  feedback: typeof feedback;
  hidden: typeof hidden;
  http: typeof http;
  likes: typeof likes;
  metrics: typeof metrics;
  notes: typeof notes;
  notifications: typeof notifications;
  openai: typeof openai;
  playlistOrder: typeof playlistOrder;
  playlists: typeof playlists;
  progress: typeof progress;
  pushDelivery: typeof pushDelivery;
  settings: typeof settings;
  subscriptions: typeof subscriptions;
  transcriptGeneration: typeof transcriptGeneration;
  transcriptProviders: typeof transcriptProviders;
  transcriptSecrets: typeof transcriptSecrets;
  transcripts: typeof transcripts;
  users: typeof users;
  utils: typeof utils;
  videoOrder: typeof videoOrder;
  videos: typeof videos;
  virtualFeeds: typeof virtualFeeds;
  watched: typeof watched;
  webhooks: typeof webhooks;
  youtube: typeof youtube;
  youtubeInteractions: typeof youtubeInteractions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
