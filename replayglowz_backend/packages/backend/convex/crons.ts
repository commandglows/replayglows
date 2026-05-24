import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run cleanup of old metrics daily at 3 AM Pacific (11 AM UTC)
crons.daily(
  "cleanup old metrics",
  { hourUTC: 11, minuteUTC: 0 },
  internal.metrics.cleanupOldMetrics
);

// Cleanup processed webhook records older than 7 days
crons.daily(
  "cleanup old webhooks",
  { hourUTC: 11, minuteUTC: 5 },
  internal.webhooks.cleanupOldWebhooks
);

// Check subscription feeds for new videos every 15 minutes
crons.interval(
  "check subscription feeds",
  { minutes: 15 },
  internal.feedChecker.checkAllUserFeeds
);

// Cleanup old notifications (older than 30 days)
crons.daily(
  "cleanup old notifications",
  { hourUTC: 11, minuteUTC: 10 },
  internal.notifications.cleanupOldNotifications
);

export default crons;
