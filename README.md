# csv-reader-speed-01

A faster drop-in for make.fun's own csv-reader 1.0.0 — reads broken CSV files exactly as csv-reader does, but ~2.9x faster on CPU time.

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/humanfreedom/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/humanfreedom/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

Entry for [make.fun bounty csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121) — "Read broken CSV files faster, 21 November 2026".

## How it works

`solve.js` is a dependency-free ES module whose `run(input)` returns csv-reader's answer `{columns, rows, errors}` for every input `{text, header}`. Single left-to-right scan: `indexOf` jumps between delimiters, field values sliced out of the text (never built char-by-char). Unquoted fields found with only 2 `indexOf` calls; stray CRs detected by scanning already-sliced short content; quoted fields sliced directly when clean, segment-built only when they hold escapes or newlines.

`main.ts` is the house driver (sets `--no-incremental-marking`, reads `/input/cases.json`, writes `/output/answers.json`).

## Verified

- 6/6 practice cases match the reference exactly (kit grader: `passed: 1`, eligible ranked yes / prize yes).
- 200/200 cases match the reference exactly (6 practice + 74 hand-written edge cases + 120 generated cases).
- ~2.9x faster than the house baseline csv-reader 1.0.0 on the practice set (470 ms vs 1,362 ms CPU, trimmed mean).

Built with [make.fun](https://make.fun) — referral code `nm9jhbw8`.
