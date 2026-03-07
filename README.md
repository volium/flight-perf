# flight-perf

**Flight Performance Calculator** — A modern, lightweight, offline-first web application for small aircraft performance calculations.

---

## Overview

`flight-perf` computes takeoff distance, landing distance, climb performance, cruise performance, weight & balance, density altitude, crosswind components, and fuel planning for general aviation aircraft.

### Key Features

- **100% Offline** — Works without internet after initial load (PWA with Service Worker).
- **Aircraft Profiles** — Extensible JSON-based profiles supporting tables, graph data, formulas, and correction factors.
- **Responsive** — Designed for desktop monitors, tablets, and phones.
- **Zero Dependencies** — Pure HTML, CSS, and JavaScript. No frameworks, no build required.
- **GitHub Pages** — Static hosting, no backend.

## Documentation

- **[PLAN.md](PLAN.md)** — Full project plan, architecture, data schemas, development phases, and open decisions.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/<your-username>/flight-perf.git
cd flight-perf

# Open in browser (no build step needed)
open index.html

# Or use a local dev server
npx serve .
```

## Project Status

🟡 **Planning** — See [PLAN.md](PLAN.md) for the full roadmap.

## Aircraft Profiles

Profiles are JSON files stored in `/profiles/`. See the [Profile JSON Schema](PLAN.md#4-aircraft-profile-system) in the plan document for the full specification.

To add a new aircraft:
1. Create a JSON file following the schema in `PLAN.md`.
2. Place it in the `profiles/` directory (for bundled profiles) or import it via the app's file picker.

## License

MIT

---

> ⚠️ **Disclaimer**: This application is a planning and reference tool only. It is NOT a certified instrument and should NOT be used as the sole source for flight-critical decisions. Always refer to your aircraft's official Pilot Operating Handbook (POH) and apply pilot judgment.
