# Inventory as Canonical Posters Sheet (Plan)

Goal: consolidate poster source of truth into the Inventory sheet and remove reliance on a separate "Movie Posters" tab. Poster ID column will live in Inventory (hidden, ideally column B), and all readers/writers must target that sheet.

## Tasks
- Point CONFIG.SHEETS.MOVIE_POSTERS to the Inventory sheet (or remove references and use a single key).
- Ensure Inventory has a Poster ID column (hidden) used as the canonical ID for all flows.
- Update all code paths that read/write posters (form sync, ledger, boards, announcements, inventory sync, dedup, health/analytics) to use Inventory as the poster source.
- Stop creating/formatting the "Movie Posters" sheet in setup; migrate existing data from Movie Posters to Inventory.
- Add repair/migration logic so existing deployments move poster IDs and active status correctly.

## Open Questions
- Should we keep a deprecated stub for Movie Posters for backward compatibility (read-only) or remove outright?
- Do we need a migration flag/property to avoid re-migrating on subsequent runs?
- Any downstream sheets or Data Studio connectors that expect the old sheet name?
