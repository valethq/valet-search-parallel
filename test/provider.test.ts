import { expect, test } from "bun:test";
import { fetchTool, searchTool } from "../src/tools";
import { call, deps, fakeApi, textOf } from "./helpers";

const hit = {
  title: "Bun 1.4",
  url: "https://bun.sh/blog",
  publish_date: "2026-10-01",
  excerpts: ["fast", "runtime"],
};

test("web_search_parallel sends objective, keywords and nested advanced_settings", async () => {
  const { client, seen } = fakeApi(() => ({ results: [hit] }));
  const r = await searchTool(deps(client)).invoke(
    {
      query: "find the latest Bun release notes",
      keywords: ["bun release notes", "bun changelog"],
      numResults: 3,
      includeDomains: ["bun.sh"],
      excludeDomains: ["x.com"],
      recency: "week",
      maxCharacters: 1000,
    },
    call(),
  );
  expect(r.isError).toBeUndefined();
  expect(textOf(r)).toBe("[1] Bun 1.4\nhttps://bun.sh/blog\n2026-10-01\nfast\n...\nruntime");
  const [s] = seen;
  expect(s?.path).toBe("/v1/search");
  expect(s?.headers.get("x-api-key")).toBe("k-123");
  expect(s?.body).toMatchObject({
    objective: "find the latest Bun release notes",
    search_queries: ["bun release notes", "bun changelog"],
    mode: "fast",
    max_chars_total: 3000,
    advanced_settings: {
      max_results: 3,
      source_policy: { include_domains: ["bun.sh"], exclude_domains: ["x.com"] },
    },
  });
  const settings = s?.body.advanced_settings as { source_policy: { after_date: string } };
  const after = settings.source_policy.after_date;
  expect(after).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(Date.now() - Date.parse(after)).toBeGreaterThan(6 * 86_400_000);
  expect(Date.now() - Date.parse(after)).toBeLessThan(8.1 * 86_400_000);
});

test("web_search_parallel falls back to the query as the only keyword and omits an empty source_policy", async () => {
  const { client, seen } = fakeApi(() => ({ results: [] }));
  const out = await searchTool(deps(client, { mode: "advanced" })).invoke(
    { query: "x", keywords: ["", 5] },
    call(),
  );
  expect(textOf(out)).toBe("No results.");
  expect(seen[0]?.body).toEqual({
    objective: "x",
    search_queries: ["x"],
    mode: "advanced",
    max_chars_total: 16_000,
    advanced_settings: { max_results: 8 },
  });
});

test("web_search_parallel truncates long excerpts and clamps to 20 results", async () => {
  const { client, seen } = fakeApi(() => ({
    results: [{ url: "https://a.b", excerpts: ["x".repeat(5000)] }],
  }));
  const out = textOf(
    await searchTool(deps(client)).invoke({ query: "q", maxCharacters: 300, numResults: 99 }, call()),
  );
  expect(out.endsWith("...")).toBe(true);
  expect(out.length).toBeLessThan(400);
  const limits = seen[0]?.body.advanced_settings as { max_results: number };
  expect(limits.max_results).toBe(20);
});

test("web_fetch_parallel posts to /v1/extract with full_content and reports errors", async () => {
  const { client, seen } = fakeApi(() => ({
    results: [{ url: "https://a.test", title: "A", full_content: "hello", excerpts: ["ignored"] }],
    errors: [{ url: "https://b.test", error_type: "fetch_error", http_status_code: 404 }],
  }));
  const r = await fetchTool(deps(client)).invoke(
    { urls: ["https://a.test", "https://b.test"], maxCharacters: 500 },
    call(),
  );
  expect(r.isError).toBeUndefined();
  expect(textOf(r)).toBe(
    "[1] A\nhttps://a.test\nhello\n\nCould not fetch:\nhttps://b.test: fetch_error (404)",
  );
  expect(seen[0]?.path).toBe("/v1/extract");
  expect(seen[0]?.body).toEqual({
    urls: ["https://a.test", "https://b.test"],
    advanced_settings: { full_content: { max_chars_per_result: 500 } },
  });
});

test("web_fetch_parallel is an error when nothing comes back", async () => {
  const { client } = fakeApi(() => ({
    results: [],
    errors: [{ url: "https://b.test", error_type: "blocked" }],
  }));
  const r = await fetchTool(deps(client)).invoke({ urls: ["https://b.test"] }, call());
  expect(r.isError).toBe(true);
  expect(textOf(r)).toContain("https://b.test: blocked");
  expect((await fetchTool(deps(client)).invoke({ urls: [] }, call())).isError).toBe(true);
});
