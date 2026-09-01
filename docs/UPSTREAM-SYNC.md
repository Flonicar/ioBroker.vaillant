# Upstream sync (TA2k)

This fork tracks [TA2k/ioBroker.vaillant](https://github.com/TA2k/ioBroker.vaillant) while shipping fork-specific improvements (tests, diagnostics, tooling).

## Git remotes

```bash
git remote add upstream https://github.com/TA2k/ioBroker.vaillant.git   # once
git fetch upstream
```

Compare drift:

```bash
git log --oneline master..upstream/master    # upstream commits we do not have yet
git log --oneline upstream/master..master    # fork-only commits
```

**Target:** `master..upstream/master` is empty or only a few days old.

## Rhythm

| Frequency | Action |
|-----------|--------|
| Weekly | `git fetch upstream` and review `git log master..upstream/master` |
| On TA2k release/tag | Merge within 48 h or document why not |
| Monthly | Merge `upstream/master` into `master`, run `npm test`, smoke-test in ioBroker |
| Before fork release | Fetch upstream first, then tag |

## After each merge — review

1. `io-package.json` → `common.news`
2. `package.json` → `version`
3. Diff focus: `main.js`, `admin/jsonConfig.json`, `README.md`
4. Watch TA2k releases on GitHub

## Merge rules (conflicts)

| Area | Rule |
|------|------|
| Login / ALTCHA / token / API URLs | Upstream wins |
| Write endpoints / TA2k bugfixes | Upstream wins |
| Fork README, diagnostics, tests, `test/mocharc.custom.json` | Fork wins (merge manually) |

## CI

GitHub Actions workflow `.github/workflows/upstream-sync-check.yml` runs weekly (and on `master` push) and writes a drift summary to the workflow run. GitHub Issues are disabled in this fork, so drift is reported via the Actions summary only.

## Sync log

| Date | TA2k commit | Fork commit | Notes |
|------|-------------|-------------|-------|
| 2026-03-26 | TA2k 1.0.3 | integrate/upstream-1.0.3 → master | Option A sync; myVaillant login + ALTCHA |
| 2026-09-01 | (check CI) | quality roadmap | lib/* modules, diagnostics, tests, upstream-sync CI |

Update this table after every upstream merge.
