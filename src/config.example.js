const env = process.env;

export default {
  lrs: {
    endpoint: env.LRS_ENDPOINT || "https://your-lrs.example.com/xapi/",
    key: env.LRS_KEY || "YOUR_LRS_KEY",
    secret: env.LRS_SECRET || "YOUR_LRS_SECRET",
    limit: parseInt(env.LRS_LIMIT || "50", 10),
  },
  pollInterval: parseInt(env.POLL_INTERVAL || "30000", 10),
  rules: [
    {
      name: "course-completion",
      verb: "http://adlnet.gov/expapi/verbs/completed",
      message: (s) => `${s.actor?.name ?? "Unknown"} completed "${s.object?.definition?.name?.["en-US"] ?? s.object?.id}"`,
      handler: "console",
    },
    {
      name: "failed-assessment",
      verb: "http://adlnet.gov/expapi/verbs/failed",
      message: (s) => `${s.actor?.name ?? "Unknown"} failed "${s.object?.definition?.name?.["en-US"] ?? s.object?.id}"`,
      handler: "webhook",
      webhookUrl: env.WEBHOOK_URL || "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
    },
    {
      name: "telegram-completion",
      verb: "http://adlnet.gov/expapi/verbs/completed",
      message: (s) => `${s.actor?.name ?? "Unknown"} completed "${s.object?.definition?.name?.["en-US"] ?? s.object?.id}"`,
      handler: "telegram",
    },
    {
      name: "low-score",
      custom: (s) => { const scaled = s.result?.score?.scaled; return scaled !== undefined && scaled < 0.6; },
      message: (s) => `Low score: ${s.actor?.name ?? "Unknown"} scored ${Math.round((s.result?.score?.scaled ?? 0) * 100)}% on "${s.object?.definition?.name?.["en-US"] ?? s.object?.id}"`,
      handler: "console",
    },
  ],
};
