# Changelog

## 0.4.32 — 2026-11-22

- Edit MTConnect display labels in the catalog and use them in Monitoring.

## 0.4.31 — 2026-11-22

- Add separate searches for signals and data points in the catalog.
- Keep column headers and add controls visible while scrolling the desktop catalog.

## 0.4.30 — 2026-11-22

- Truncate long signal labels and data point paths to fit their catalog cells.
- Simplify inline catalog actions and reorganize schema settings controls.

## 0.4.29 — 2026-11-22

- Show signals and schema data points in one table, with inline mapping controls and separate schema settings.
- Place the dashboard editor link below Home in the signal catalog.

## 0.4.28 — 2026-11-22

- List only Viewer accounts as KFGyR operators on the access management page.

## 0.4.27 — 2026-11-22

- Allow Grafana Viewer accounts in the configured operator team to manage KFGyR settings.
- Add an administrator page for managing membership of the operator team.
- Keep Monitoring and Data Export accessible to viewers.

## 0.4.26 — 2026-11-20

- Update the Monitoring dashboard action immediately when switching machines.
- Show the machine before the dashboard name in the copy dropdown.

## 0.4.25 — 2026-11-20

- Open dashboard creation from Monitoring when the machine has no dashboard.
- Validate that a dashboard belongs to the selected machine before opening the panel editor.
- Create a dashboard from an existing dashboard on the same machine schema.

## 0.4.24 — 2026-11-20

- Enlarged and aligned the titles of the plugin pages.
- Removed the icon next to the machine name in Monitoring.
- Set Monitoring to show the last five minutes and refresh every five seconds by default.

## 0.4.23 — 2026-11-20

- Add a prominent title above the main menu and show matching menu icons in app page headings.
- Rename the schema management page to Jelkatalógus throughout the user interface.

## 0.3.0 — 2026-10-19

- Move configuration, validation, revision storage and MTConnect probing to the authenticated relay-runner API.
- Keep Admin authorization in the Grafana backend and store runner credentials in secureJsonData.
- Add automatic runner LAN detection and bounded, asynchronous, cancellable MTConnect network discovery.
- Add runner connection settings and preserve optimistic concurrency and startup-failure rollback.
- Remove the Grafana configuration volume dependency; support remote runners.

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
