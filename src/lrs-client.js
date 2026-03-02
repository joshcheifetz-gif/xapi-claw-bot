/**
 * LRS Client — handles xAPI connection, authentication, and statement fetching.
 *
 * Implements the xAPI Statement API (GET /statements) with Basic Auth and
 * supports cursor-based pagination via the "more" property.
 */

export class LrsClient {
  /**
   * @param {Object} config
   * @param {string} config.endpoint  – LRS statements endpoint, e.g. "https://lrs.example.com/xapi/"
   * @param {string} config.key       – Basic-auth username / key
   * @param {string} config.secret    – Basic-auth password / secret
   * @param {number} [config.limit]   – Max statements per request (default 50)
   */
  constructor({ endpoint, key, secret, limit = 50 }) {
    // Normalise the endpoint to always end with /statements
    this.baseUrl = endpoint.replace(/\/+$/, "");
    if (!this.baseUrl.endsWith("/statements")) {
      this.baseUrl += "/statements";
    }
    this.authHeader =
      "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
    this.limit = limit;
  }

  async getStatements(params = {}) {
    const url = new URL(this.baseUrl);
    url.searchParams.set("ascending", "true");
    url.searchParams.set("limit", String(params.limit ?? this.limit));
    if (params.since) url.searchParams.set("since", params.since);
    if (params.verb) url.searchParams.set("verb", params.verb);
    if (params.activity) url.searchParams.set("activity", params.activity);
    if (params.agent) url.searchParams.set("agent", params.agent);
    if (params.related_activities) url.searchParams.set("related_activities", "true");
    if (params.related_agents) url.searchParams.set("related_agents", "true");
    const res = await fetch(url.toString(), {
      headers: { Authorization: this.authHeader, "X-Experience-API-Version": "1.0.3", Accept: "application/json" },
    });
    if (!res.ok) { const body = await res.text().catch(() => ""); throw new Error(`LRS request failed [${res.status} ${res.statusText}]: ${body}`); }
    const data = await res.json();
    return { statements: data.statements ?? [], more: data.more || null };
  }

  async getMore(moreUrl) {
    const url = moreUrl.startsWith("http") ? moreUrl : new URL(moreUrl, this.baseUrl).toString();
    const res = await fetch(url, {
      headers: { Authorization: this.authHeader, "X-Experience-API-Version": "1.0.3", Accept: "application/json" },
    });
    if (!res.ok) { const body = await res.text().catch(() => ""); throw new Error(`LRS 'more' request failed [${res.status} ${res.statusText}]: ${body}`); }
    const data = await res.json();
    return { statements: data.statements ?? [], more: data.more || null };
  }

  async *streamStatements(params = {}) {
    let result = await this.getStatements(params);
    for (const s of result.statements) yield s;
    while (result.more) { result = await this.getMore(result.more); for (const s of result.statements) yield s; }
  }
}
