# Changelog

## 0.4.51 — 2026-11-23

- Flag panels whose data points are unavailable after a schema change and allow other panels to be saved.
- Open the signal catalog on the selected machine's schema from the dashboard editor.

## 0.4.49 — 2026-11-23

- Replace the standalone User Guide page with an in-place overlay modal offering separate Table of Contents and Chapter views.

## 0.4.48 — 2026-11-23

- Add a User Guide info-icon link next to each plugin page heading.

## 0.4.47 — 2026-11-23

- Give dashboard stars distinct accessible names and larger touch targets.

## 0.4.46 — 2026-11-23

- Choose each machine's default dashboard from the dashboard cards.
- Review the User Guide procedures and add common tasks for signal selection and Fleet configuration.

## 0.4.45 — 2026-11-23

- Left-align wrapped chapter links in the User Guide.

## 0.4.44 — 2026-11-23

- Remove the house symbol from the Fleet Home button.

## 0.4.43 — 2026-11-23

- Style the Fleet Home link like the other navigation buttons and remove internal scrolling.

## 0.4.42 — 2026-11-23

- Rewrite User Guide text in impersonal style and update Fleet card description.

## 0.4.41 — 2026-11-23

- Add signal captions and a Home link to Fleet.
- Show agent reachability and move Monitoring links to the lower-right corner of machine cards.

## 0.4.40 — 2026-11-23

- Fix search input prefix alignment and box-sizing in the User Guide.

## 0.4.39 — 2026-11-23

- Simplify User Guide layout and typography, removing synthetic UI mockups and redundant role banners.
- Fix sticky sidebar offset below Grafana navbar on desktop and search input horizontal overflow on mobile.

## 0.4.38 — 2026-11-22

- Add a role-aware, wiki-style User Guide with annotated UI visuals and search.
- Make the User Guide accessible to Viewer and anonymous users with role-filtered content.

## 0.4.37 — 2026-11-22

- Add the Fleet dashboard and a compact machine overview panel using default dashboard order.

## 0.4.36 — 2026-11-22

- Add optional state timelines beneath current state panels.
- Use the panel editor categories in Monitoring and fit up to four charts per row.

## 0.4.35 — 2026-11-22

- Use a compact machine and dashboard chooser on mobile Monitoring.
- Align Signal Catalog with Home on mobile dashboard and panel editor pages.

## 0.4.34 — 2026-11-22

- Color catalog signals and panel signal labels by their standard MTConnect branch.

## 0.4.33 — 2026-11-22

- Copy an existing schema and its mappings when creating a schema.
- Default new mappings to machine data points and keep display unit headers visible.

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
