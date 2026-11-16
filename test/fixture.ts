// The only provider-specific test data besides provider.test.ts.
export const ok = { results: [{ title: "T", url: "https://a.test", excerpts: ["h"] }] };

export const kernel = {
  searchPath: "/v1/search",
  fetchPath: "/v1/extract",
  /** Header the API key travels in, and its expected value for the key "kernel-key". */
  authHeader: "x-api-key",
  authValue: "kernel-key",
  reply: { results: [{ title: "Hit", url: "https://example.test/a", excerpts: ["found it"] }] },
  output: "[1] Hit\nhttps://example.test/a\nfound it",
};
