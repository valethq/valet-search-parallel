import type { Hit, Provider } from "./types";

interface ParallelResult {
  url: string;
  title?: string | null;
  publish_date?: string | null;
  excerpts?: string[];
  full_content?: string | null;
}

interface SearchResponse {
  results?: ParallelResult[];
}

interface ExtractResponse extends SearchResponse {
  errors?: { url: string; error_type?: string; http_status_code?: number | null }[];
}

const RECENCY_MS = { day: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000, year: 365 * 86_400_000 };

const hit = (r: ParallelResult): Hit => ({
  title: r.title,
  url: r.url,
  date: r.publish_date,
  text: r.full_content || r.excerpts?.join("\n...\n"),
});

export const provider: Provider = {
  id: "parallel",
  label: "Parallel",
  secret: "parallel_api_key",
  baseUrl: "https://api.parallel.ai",
  modes: ["fast", "turbo", "basic", "advanced"],
  defaultMode: "fast",
  maxResults: 20,
  searchProps: {
    keywords: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description:
        "1-3 short keyword queries (3-6 words each) to go with `query`. Write `query` as the goal in a full sentence; Parallel works best with both.",
    },
  },
  headers: (key) => ({ "x-api-key": key }),
  async search(req, http) {
    const keywords = Array.isArray(req.input.keywords)
      ? req.input.keywords.filter((k): k is string => typeof k === "string" && k.trim() !== "").slice(0, 3)
      : [];
    const policy: Record<string, unknown> = {};
    if (req.includeDomains) policy.include_domains = req.includeDomains;
    if (req.excludeDomains) policy.exclude_domains = req.excludeDomains;
    if (req.recency)
      policy.after_date = new Date(Date.now() - RECENCY_MS[req.recency]).toISOString().slice(0, 10);
    const body = {
      objective: req.query,
      search_queries: keywords.length > 0 ? keywords : [req.query],
      mode: req.mode,
      max_chars_total: req.maxCharacters * req.numResults,
      advanced_settings: {
        max_results: req.numResults,
        ...(Object.keys(policy).length > 0 && { source_policy: policy }),
      },
    };
    const res = (await http.post("/v1/search", body, req.signal)) as SearchResponse;
    return { hits: (res.results ?? []).map(hit) };
  },
  async fetch(req, http) {
    const body = {
      urls: req.urls,
      advanced_settings: { full_content: { max_chars_per_result: req.maxCharacters } },
    };
    const res = (await http.post("/v1/extract", body, req.signal)) as ExtractResponse;
    return {
      hits: (res.results ?? []).map(hit),
      failed: (res.errors ?? []).map(
        (e) => `${e.url}: ${e.error_type ?? "error"}${e.http_status_code ? ` (${e.http_status_code})` : ""}`,
      ),
    };
  },
};
