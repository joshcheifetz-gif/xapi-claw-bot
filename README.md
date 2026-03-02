# xAPI Claw Bot

A lightweight Node.js bot that monitors an xAPI Learning Record Store (LRS) for custom statement events and triggers alerts.

## Quick start (local)

```bash
# 1. Install dependencies
npm install

# 2. Create your config
cp src/config.example.js src/config.js
# Edit src/config.js with your LRS credentials and rules

# 3. Run
npm start
```

Requires **Node.js 18+**. Zero external dependencies.

## Deploy to Railway

1. Push this repo to GitHub (or use `railway init` from the CLI).
2. In the **Railway dashboard**, create a new project and connect your repo.
3. Add these **environment variables** in the Railway service settings:

   | Variable        | Required | Description                          |
   |-----------------|----------|--------------------------------------|
   | `LRS_ENDPOINT`  | Yes      | Your LRS base URL (e.g. `https://lrs.example.com/xapi/`) |
   | `LRS_KEY`       | Yes      | Basic-auth API key                   |
   | `LRS_SECRET`    | Yes      | Basic-auth API secret                |
   | `POLL_INTERVAL` | No       | Milliseconds between polls (default `30000`) |
   | `WEBHOOK_URL`   | No       | Webhook URL for alert delivery (Slack, Discord, etc.) |
   | `LRS_LIMIT`     | No       | Statements per request (default `50`) |

4. Railway will auto-detect the `Procfile` and deploy as a **worker** service (no web port needed).
5. Check the **Deploy Logs** tab to confirm the bot is running.

> **Tip:** Use `railway logs` from the CLI to tail logs in real time.

## How it works

The bot polls your LRS at a configurable interval (default 30 seconds), fetches any new xAPI statements since the last poll, and evaluates each statement against your rules. When a statement matches all the filters in a rule, the alert fires.

## Configuration

For local development, edit `src/config.js`. On Railway, use environment variables — the bot reads them automatically.

### `lrs` — LRS connection

| Key        | Env var        | Description                                    |
|------------|----------------|------------------------------------------------|
| `endpoint` | `LRS_ENDPOINT` | Your LRS base URL                              |
| `key`      | `LRS_KEY`      | Basic-auth username / API key                  |
| `secret`   | `LRS_SECRET`   | Basic-auth password / API secret               |
| `limit`    | `LRS_LIMIT`    | Statements per request (default `50`)          |

### `pollInterval`

Env var: `POLL_INTERVAL`. Milliseconds between polls. Default `30000` (30 seconds).

### `rules` — what to watch for

Each rule is an object with **filter keys** and **alert options**.

**Filter keys** (all optional; a statement must match every filter present):

| Key          | Type                  | Description                                      |
|--------------|-----------------------|--------------------------------------------------|
| `verb`       | `string`              | Exact verb IRI                                   |
| `activity`   | `string`              | Exact activity or activity-type IRI              |
| `actorEmail` | `string`              | Learner email (with or without `mailto:`)        |
| `custom`     | `(statement) => bool` | Arbitrary function for complex matching          |

**Alert options:**

| Key          | Type                     | Description                                     |
|--------------|--------------------------|-------------------------------------------------|
| `name`       | `string`                 | Human-readable rule label (used in log output)  |
| `handler`    | `"console"` \| `"webhook"` | Where to send the alert (default `"console"`)   |
| `webhookUrl` | `string`                 | Required when handler is `"webhook"`            |
| `message`    | `string` \| `(statement) => string` | Alert text (static or dynamic)     |

## Adding custom alert handlers

Pass additional handlers in `config.alertHandlers`:

```js
export default {
  lrs: { /* ... */ },
  rules: [{ name: "my-rule", verb: "...", handler: "email" }],
  alertHandlers: {
    email: async ({ rule, statement, message }) => {
      // your email-sending logic here
    },
  },
};
```

## Architecture

```
xapi-claw-bot/
  Procfile               Railway worker process definition
  nixpacks.toml          Railway/Nixpacks build config
  package.json           Project metadata (zero dependencies)
  src/
    index.js             Entry point — loads config, starts monitor
    config.example.js    Template config (reads env vars for Railway)
    lrs-client.js        xAPI LRS HTTP client (auth, pagination)
    monitor.js           Polling loop, rule evaluation, alert dispatch
```

## License

MIT
