# Changelog

## 0.2.0 — 2026-10-19

- Replace the single-page form with searchable agent cards, status filters, and separate agent/settings dialogs.
- Show pending changes and a change summary before applying configuration.
- Validate individual fields, prevent duplicate agent/device names, and protect unfinished forms from accidental dismissal.
- Integrate device discovery into the agent editor and invalidate results when the URL changes.
- Use Grafana theme colors, responsive layouts, accessible labels, and native confirmation dialogs.
- Distinguish configuration application failures from historical failed revisions.

## 0.1.1 — 2026-10-19

- Adopt the official `@grafana/create-plugin@7.13.0` scaffold generated with WSL2.
- Retain the existing MTConnect UI, configuration backend, plugin ID, and backend executable name.
- Keep Windows development and Linux GitHub Actions release builds independently reproducible.

## 0.1.0

- Initial agent management UI, configuration revisions, probe endpoint and Admin authorization.
