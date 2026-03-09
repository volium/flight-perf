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
| **Climb** | Time to climb, ROC interpolation, cruise climb transition |
| **Cruise** | TAS/IAS from altitude × RPM, density-corrected fuel flow, endurance, range |
| **W&B** | Station weights, CG in %MAC or arm, envelope chart (SVG) |
| **Density Alt** | Pressure altitude, density altitude, ISA deviation |
| **Crosswind** | Head/tail/crosswind components with SVG diagram, dual runway display |
| **Fuel** | Trip fuel, reserves, usable fuel, endurance, range |

### Key Features

- **100% Offline** — Works without internet after initial load (PWA with Service Worker).
- **Aircraft Profiles** — Extensible JSON-based profiles supporting reference tables, interpolation tables, and formulas.
- **Global Unit Preferences** — Set altitude (ft/m), distance (ft/m), altimeter (inHg/hPa), temperature (°C/°F), weight (kg/lbs), and fuel (L/US gal) once in Settings — all calculators adapt. Values convert with smart rounding when switching units.
- **Safety Margins** — Configurable percentage or fixed distance margins with round-up option.
- **Responsive** — Designed for desktop monitors, tablets, and phones.
- **Dark Mode** — Automatic (follows system) or manual toggle.
- **Zero Dependencies** — Pure HTML, CSS, and JavaScript. No frameworks, no build step.
- **GitHub Pages** — Static hosting, no backend.

## Documentation

- **[PLAN.md](PLAN.md)** — Full project plan, architecture, data schemas, development phases, and open decisions.

## Quick Start

```bash
git clone https://github.com/volium/flight-perf.git
cd flight-perf
```

The app uses ES Modules, which require an HTTP server — opening `index.html` directly via `file://` will not work. Choose one of the options below to serve the app locally.

### Option 1: Node.js (`npx serve`)

If you don't have Node.js installed, install it first via [Homebrew](https://brew.sh/) (macOS):

```bash
# Install Homebrew (skip if already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js (includes npm and npx)
brew install node
```

Then serve the app:

```bash
npx serve .
```

Open the URL shown in the terminal (typically `http://localhost:3000`).

### Option 2: Python (`http.server`)

Python 3 is pre-installed on macOS. No additional setup required:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser.

### Option 3: PHP built-in server

If PHP is available on your system:

```bash
php -S localhost:8000
```

Open `http://localhost:8000` in your browser.

### Option 4: VS Code Live Server

If you use VS Code, install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension and click **Go Live** in the status bar.

## Project Status

🟢 **Phase 2 In Progress** — All 8 calculators complete, global unit preferences implemented, W&B improvements done. See [PLAN.md](PLAN.md) for the full roadmap.

## Aircraft Profiles

Profiles are JSON files stored in `/profiles/`. See the [Profile JSON Schema](PLAN.md#4-aircraft-profile-system) in the plan document for the full specification.

The bundled profile is for a **Sling LSA (N246LT)** — a Sling Aircraft light-sport airplane with a Rotax 912 iS engine.

To add a new aircraft:
1. Create a JSON file following the schema in `PLAN.md`.
2. Place it in the `profiles/` directory.

## Technology

- **Zero production dependencies** — pure HTML5, CSS3 (custom properties), and vanilla JavaScript (ES Modules).
- **~3,400 lines of JS** across 27 modules (8 calculator UIs, 8 calc engines, 4 engine modules, 4 data modules, 3 shared UI modules).
- **~830 lines of CSS** with CSS custom properties for theming (light/dark).
- **PWA** — Service Worker caches all 38 assets for offline use; installable on mobile and desktop.
- **No build step** — serve the files directly from any HTTP server.
- **Detailed documentation** — see [PLAN.md](PLAN.md) Section 15 (Implementation Reference) for module architecture, storage keys, conventions, and design decisions.

## License

MIT

---

> ⚠️ **Disclaimer**: This application is a planning and reference tool only. It is NOT a certified instrument and should NOT be used as the sole source for flight-critical decisions. Always refer to your aircraft's official Pilot Operating Handbook (POH) and apply pilot judgment.
