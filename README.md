# flight-perf

**Flight Performance Calculator** — A modern, lightweight, offline-first web application for small aircraft performance calculations.

**Live app:** [volium.github.io/flight-perf](https://volium.github.io/flight-perf/)

---

## Overview

`flight-perf` computes takeoff distance, landing distance, climb performance, cruise performance, weight & balance, density altitude, crosswind components, and fuel planning for general aviation aircraft.

### Calculators

| Calculator | Description |
|-----------|-------------|
| **Takeoff** | Ground roll & obstacle clearance distance with safety margins |
| **Landing** | Ground roll & obstacle clearance distance with safety margins |
| **Climb** | Time to climb, ROC interpolation (1D or 2D), cruise climb transition |
| **Cruise** | TAS from altitude × RPM (2D/3D), density-corrected fuel flow, endurance, range |
| **W&B** | Station weights, CG in %MAC or arm (inches), envelope chart (SVG), dual envelopes |
| **Density Alt** | Pressure altitude, density altitude, ISA deviation |
| **Crosswind** | Head/tail/crosswind components with SVG diagram, dual runway display |
| **Fuel** | Trip fuel, reserves, usable fuel, endurance, range |

### Key Features

- **100% Offline** — Works without internet after initial load (PWA with Service Worker).
- **Fleet Management** — Add multiple aircraft to your fleet, each linked to a type profile. Switch between aircraft from the header dropdown.
- **Aircraft Type Profiles** — Extensible JSON-based profiles supporting reference tables, 2D/3D interpolation tables, and formulas. Two bundled profiles: Sling LSA and Cessna 172S.
- **Type/Instance Architecture** — Type profiles contain shared POH data for a make/model. Instances contain per-airplane data (registration, empty weight from weigh report). The merger combines them into a runtime profile for the calculators.
- **Global Unit Preferences** — Set altitude (ft/m), distance (ft/m), altimeter (inHg/hPa), temperature (°C/°F), weight (kg/lbs), and fuel (L/US gal) once in Settings — all calculators adapt. Values convert with smart rounding when switching units.
- **Safety Margins** — Configurable percentage or fixed distance margins with round-up option.
- **Responsive** — Designed for desktop monitors, tablets, and phones.
- **Dark Mode** — Automatic (follows system) or manual toggle.
- **Google Drive Backup** — Manual backup/restore of fleet, custom types, and preferences to a hidden Google Drive folder. No backend required.
- **Zero Dependencies** — Pure HTML, CSS, and JavaScript. No frameworks, no build step.
- **GitHub Pages** — Static hosting, no backend.

## Documentation

- **[PLAN.md](PLAN.md)** — Full project plan, architecture, data schemas, development phases, and open decisions.
- **[Profile Schema](profiles/schema/type-profile-v1.md)** — Aircraft type profile schema reference.

## Quick Start

```bash
git clone https://github.com/volium/flight-perf.git
cd flight-perf
npm install   # install dev dependencies (vitest for testing)
```

The app uses ES Modules, which require an HTTP server — opening `index.html` directly via `file://` will not work. Choose one of the options below to serve the app locally.

### Option 1: Python (`http.server`)

Python 3 is pre-installed on macOS. No additional setup required:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser.

### Option 2: Node.js (`npx serve`)

```bash
npx serve .
```

Open the URL shown in the terminal (typically `http://localhost:3000`).

### Option 3: VS Code Live Server

If you use VS Code, install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension and click **Go Live** in the status bar.

### Running Tests

```bash
npm test              # run all tests once
npm run test:watch    # watch mode (re-runs on file save)
npx vitest run tests/engine/   # run a specific directory
npx vitest run tests/calc/climb.test.js   # run a single file
```

### Development Notes

- **Service Worker caching**: During development, the SW caches files aggressively. If you change profile JSON files or add new modules, bump `CACHE_VERSION` in `sw.js` and `BUNDLED_DATA_VERSION` in `js/data/profile-loader.js`, then hard-refresh (Cmd+Shift+R).
- **IndexedDB**: Bundled profiles are seeded into IndexedDB on first load. To force re-seeding, clear IndexedDB via DevTools → Application → IndexedDB → delete `flightperf`.
- **No build step**: All source files are served directly. No transpilation or bundling required.

## Project Status

🟢 **Phase 3E Complete** — Google Drive backup/restore (manual backup/restore of fleet, custom types, and preferences to Google Drive appDataFolder). See [PLAN.md](PLAN.md) for the full roadmap.

**Next up:** Phase 3D (Profile Creation Wizard), Phase 4 (Calculation Improvements), Phase 5 (Flight Planning Integration).

## Aircraft Profiles

Profiles are JSON files stored in `profiles/types/`. See the [Profile Schema](profiles/schema/type-profile-v1.md) for the full specification.

### Bundled Profiles

| Profile | Aircraft | Key Features |
|---------|----------|-------------|
| `sling-lsa.json` | Sling LSA (Rotax 912 iS) | %MAC CG, metric-primary, reference_table takeoff/landing |
| `cessna-172s.json` | Cessna 172S Skyhawk SP (IO-360-L2A) | Arm-based CG, imperial, 3D takeoff (weight×alt×temp), dual envelopes |

### Adding a New Profile

1. Create a JSON file following the [schema](profiles/schema/type-profile-v1.md).
2. Place it in `profiles/types/`.
3. Add it to `BUNDLED_TYPE_URLS` in `js/data/profile-loader.js`.
4. Add it to `APP_SHELL` in `sw.js`.
5. Bump `BUNDLED_DATA_VERSION` in `js/data/profile-loader.js`.

## Architecture

```
UI Layer                Calc Layer              Engine Layer
-----------             -----------             -------------------
takeoff    ---------->  takeoff    ---------->  interpolation (1D/2D/3D)
landing                 landing                 margins
climb                   climb                   perf-common
cruise                  cruise                  units
W&B                     W&B
density                 density
crosswind               crosswind               Data Layer
fuel                    fuel                    -------------------
fleet                                           db.js (IndexedDB)
settings                                        profile-loader
                                                profile-merger
        getProfile() <------------------------  profile-validator
                                                fuel-types
                                                unit-preferences
                                                storage (localStorage)

Storage
-------------------
Service Worker (PWA cache)      IndexedDB (types, fleet)
```

### Key Patterns

- **Type/Instance Split**: Type profiles (POH data) are shared. Instances (per-airplane) override empty weight/CG. The merger combines them into a runtime profile that calc modules consume unchanged.
- **Method-Aware Calculators**: Takeoff/landing support `reference_table` (surface lookup) and `table_interpolation` (multi-dimensional grid). The UI adapts inputs based on the method.
- **Plain Numbers in Data**: All `table_interpolation` data arrays use plain numbers with a `units` declaration at the section level — no ValueWithUnit wrappers in data rows.

## Technology

- **Zero production dependencies** — pure HTML5, CSS3 (custom properties), and vanilla JavaScript (ES Modules).
- **~6,500 lines of JS** across 32 source modules + 20 test files (441 tests).
- **~880 lines of CSS** with CSS custom properties for theming (light/dark).
- **PWA** — Service Worker caches all assets for offline use; installable on mobile and desktop.
- **Vitest** — Test framework with `@/` alias for `js/` directory. `fake-indexeddb` for IDB tests.
- **No build step** — serve the files directly from any HTTP server.

## License

MIT

---

> ⚠️ **Disclaimer**: This application is a planning and reference tool only. It is NOT a certified instrument and should NOT be used as the sole source for flight-critical decisions. Always refer to your aircraft's official Pilot Operating Handbook (POH) and apply pilot judgment.
