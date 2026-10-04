# Engineering Impact

A single-screen, evidence-led assessment of public engineering contributions. The default snapshot covers **PostHog/posthog, July 6–October 4, 2026**, with 16,064 merged PRs, including 1,741 bot-authored records. The repository-wide capability map includes all 204 human PR authors. Detailed impact assessment covers 19 contributors, 22 distinct outcomes, and 42 PRs; it is deliberately disclosed as a bounded review.

## Run locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. `npm test` checks ranking and timer behavior. `npm run build` first validates dataset identity, coverage, and evidence references, then builds the production app. No GitHub credentials are needed to run or deploy the precomputed dashboard.

## What impact means

Impact is a documented improvement to product capability, system behavior, or another engineer's ability to deliver. Each distinct outcome has one primary dimension: product, reliability, performance, developer experience, leverage, or simplification. Related PRs and subsequent repairs are grouped; PR counts and lines changed do not score.

Significance is an explicit assessment: 1 bounded, 3 substantial subsystem/workflow improvement, 5 broad cross-subsystem benefit or documented critical resolution. Each rating has a written rationale. Authors, contributors, adopters, and reviewers receive credit only for documented material participation. Shared credit is not an allocation of organizational impact.

For every assessed engineer, multiply significance by normalized dimension weight and sum the three strongest distinct outcomes. Recalculate everyone before displaying Top N or Bottom N. Equal totals share a rank and display alphabetically. The Bottom 10 covers only the assessed cohort: it does not rank unassessed contributors as low performers. Each story suggests a grounded leadership follow-up. The Leadership actions panel collects rollout, adoption, validation, and evidence-gap follow-ups.

## Reconfigure the repository

Edit `analysis.config.yaml`: repository, display name, time window, collection settings, and optional capability scope rules. Set `window.end: null` to freeze a new endpoint when collection starts. Set GITHUB_TOKEN in a local `.env.local` (never committed), then:

```sh
npm run collect
npm run screen
node scripts/audit-corpus.mjs
npm run enrich -- 123 456
node --env-file=.env.local scripts/profiles.mjs
```

Collection partitions the complete interval, subdivides searches near GitHub's 1,000-result limit, paginates each partition, and reconciles partition counts against unique IDs and the full-window count. Each run gets its own cache directory. The audit checks contiguous coverage through the endpoint, counts, page numbers, and merge timestamps. Bot records stay in the census but never enter the human leaderboard.

The scraper and interface are repository-independent. **Impact assessment is not automatic.** Screen candidates, inspect descriptions, patches, tests, discussions, substantive review threads, linked issues, adoption, and contradictory follow-ups. Create repository-specific `data/assessments.json`, retrieve its evidence, and run `npm run analyze`. Build validation rejects data from a different repository or snapshot instead of relabeling PostHog's conclusions. Title scopes populate the capability directory only; they never establish impact.

```sh
node --env-file=.env.local scripts/directory-profiles.mjs
node scripts/build-directory.mjs
npm run analyze
npm run validate:data
```

## Evidence and limitations

- `public/impact.json`: versioned outcomes, people, initiatives, attribution, sources, measurements, and collection/review coverage.
- `public/coverage.json`: all partition counts, pagination reconciliation, and corpus SHA-256.
- `public/corpus.json.gz`: complete metadata and descriptions for all 16,064 merged PRs; downloaded only on request, not on initial page load.
- `public/directory.json`: all human authors grouped by configurable PR-title scopes; unmatched scopes remain unclassified. Latest examples show participation, not impact or collaboration.
- `data/assessments.json`: editable assessments and explicit caveats. Raw enrichment remains outside the browser bundle.

Measurements retain workload, units, and attribution. Production results reported by PR authors are not independently reproduced. Implementation is distinguished from rollout; explicit adoption is required for leverage. Public work cannot establish employment, private contributions, overall job performance, revenue, or causality from shared files. Detailed review is selective and further evidence could change rankings.

## Timer and submission

The take-home began October 4, 2026 at **14:30 Pacific / 21:30 UTC**, including planning. Elapsed time uses timestamps, never a capped counter. Local author state survives refresh; public completion is stored in `data/run.json` and `public/completion.json`. Stop only after public verification, then publish the frozen completion record. Public browsers have no author controls.

`npm run export:session -- <absolute session JSONL path>` exports user messages, visible assistant responses, tool calls, and results to `submission/`. It excludes system/developer instructions and private reasoning, redacts locally supplied credentials, and records its cutoff. Session files are not committed or uploaded automatically.
