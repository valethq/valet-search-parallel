# valet-search-parallel

`tools@1` provider with two tools backed by [Parallel](https://parallel.ai) (GA `/v1` Search and Extract APIs):
`web_search_parallel` and `web_fetch_parallel`. No runtime dependencies, just `fetch`. Available to `trusted` and
`owner` runs by default (ARCHITECTURE decision 5: friends get search and fetch); `guest` runs get nothing.

## Setup

Put the API key in `~/.valet/secrets/parallel_api_key` (mode 0600) or set `PARALLEL_API_KEY` for valet. The key is
read on every call, so adding or rotating it needs no restart. Without one, the tools return an error that says so.

## Tools

`web_search_parallel { query, keywords?, numResults?, includeDomains?, excludeDomains?, recency?, maxCharacters? }`

- `POST /v1/search`. `query` is sent as the `objective`: write it as the goal in a sentence. `keywords` are 1-3
  short keyword queries (`search_queries`); without them the query doubles as the only keyword query, which
  Parallel documents as the weakest setup.
- Domains and `recency` (`after_date`) go in `advanced_settings.source_policy`; `numResults` in
  `advanced_settings.max_results`. `maxCharacters` times `numResults` becomes `max_chars_total`.
- Returns numbered results: title, URL, publish date, excerpts.

`web_fetch_parallel { urls, maxCharacters? }`

- `POST /v1/extract` for up to 10 URLs with `full_content`, markdown. URLs Parallel could not fetch are listed
  after the results.

## Config

All optional, under `plugins.valet-search-parallel.config`:

- `secret`: secret name (default `parallel_api_key`)
- `baseUrl`: default `https://api.parallel.ai`
- `mode`: Parallel search mode: `fast` (default, about 700 ms), `turbo` (about 200 ms), `basic` or `advanced`
  (highest quality, slowest)
- `numResults`: default 8, max 20
- `maxCharacters`: per-result excerpt size, default 2000 (`web_fetch_parallel` uses 4x)
- `timeoutMs`: default 30000
- `minRole`: lowest role served, default `trusted`

Config changes apply without a restart.

## Checks

`bun run typecheck`, `bun run lint`, `bun test`.
