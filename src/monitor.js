/**
 * Monitor — polls the LRS on an interval, applies user-defined rules to each
 * new statement, and dispatches alerts through pluggable alert handlers.
 */

import { LrsClient } from "./lrs-client.js";

// ─── Built-in alert handlers ────────────────────────────────────────────────

function consoleAlertHandler({ rule, statement, message }) {
  const ts = statement.timestamp || statement.stored || new Date().toISOString();
  console.log(`\x1b[33m[ALERT]\x1b[0m ${ts}  rule=\x1b[36m${rule.name}\x1b[0m  ${message}`);
}

async function webhookAlertHandler({ rule, statement, message }) {
  const url = rule.webhookUrl;
  if (!url) { console.error(`[webhook] No webhookUrl for rule "${rule.name}"`); return; }
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rule: rule.name, message, statement }) });
  } catch (err) { console.error(`[webhook] Failed for rule "${rule.name}":`, err.message); }
}

async function telegramAlertHandler({ rule, statement, message }) {
  const token = rule.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = rule.telegramChatId || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { console.error(`[telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID for rule "${rule.name}"`); return; }
  const ts = statement.timestamp || statement.stored || new Date().toISOString();
  const text = `🦀 *Claw Bot Alert*\n*Rule:* ${rule.name}\n*Time:* ${ts}\n*Details:* ${message}`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    if (!res.ok) { const body = await res.text().catch(() => ""); console.error(`[telegram] API error [${res.status}] for rule "${rule.name}": ${body}`); }
  } catch (err) { console.error(`[telegram] Failed for rule "${rule.name}":`, err.message); }
}

const BUILT_IN_HANDLERS = { console: consoleAlertHandler, webhook: webhookAlertHandler, telegram: telegramAlertHandler };

export class Monitor {
  constructor(config) {
    this.client = new LrsClient(config.lrs);
    this.pollInterval = config.pollInterval ?? 30_000;
    this.rules = (config.rules ?? []).map((r) => this.#compileRule(r));
    this.alertHandlers = { ...BUILT_IN_HANDLERS, ...(config.alertHandlers ?? {}) };
    this.cursor = new Date().toISOString();
    this._timer = null;
  }

  #compileRule(def) {
    const matchers = [];
    if (def.verb) { const iri = def.verb; matchers.push((s) => s.verb?.id === iri); }
    if (def.activity) { const iri = def.activity; matchers.push((s) => s.object?.id === iri || s.object?.definition?.type === iri); }
    if (def.actorEmail) { const mailto = def.actorEmail.startsWith("mailto:") ? def.actorEmail : `mailto:${def.actorEmail}`; matchers.push((s) => s.actor?.mbox === mailto); }
    if (typeof def.custom === "function") { matchers.push(def.custom); }
    return { ...def, match: (statement) => matchers.every((fn) => fn(statement)) };
  }

  start() {
    console.log(`\x1b[32m[claw-bot]\x1b[0m Monitoring started — polling every ${this.pollInterval / 1000}s`);
    console.log(`\x1b[32m[claw-bot]\x1b[0m ${this.rules.length} rule(s) loaded`);
    this.#poll();
    this._timer = setInterval(() => this.#poll(), this.pollInterval);
  }

  stop() { if (this._timer) { clearInterval(this._timer); this._timer = null; } console.log(`\x1b[32m[claw-bot]\x1b[0m Monitoring stopped`); }

  async #poll() {
    try {
      let count = 0;
      for await (const statement of this.client.streamStatements({ since: this.cursor })) {
        count++; this.#evaluate(statement);
        const stored = statement.stored ?? statement.timestamp;
        if (stored && stored > this.cursor) { this.cursor = stored; }
      }
      if (count > 0) { console.log(`\x1b[90m[claw-bot] Processed ${count} new statement(s)\x1b[0m`); }
    } catch (err) { console.error(`\x1b[31m[claw-bot] Poll error:\x1b[0m`, err.message); }
  }

  #evaluate(statement) {
    for (const rule of this.rules) {
      if (rule.match(statement)) {
        const message = typeof rule.message === "function" ? rule.message(statement) : rule.message ?? "Rule matched";
        const handlerName = rule.handler ?? "console";
        const handler = this.alertHandlers[handlerName];
        if (handler) { handler({ rule, statement, message }); }
        else { console.error(`[claw-bot] Unknown handler "${handlerName}" for rule "${rule.name}"`); }
      }
    }
  }
}
