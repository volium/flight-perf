# Flight Performance Calculator — Project Plan

> **Living document** — update this file as requirements evolve, decisions are made, or implementation details change.

| Field | Value |
|-------|-------|
| **Project** | flight-perf |
| **Repository** | GitHub — hosted via GitHub Pages |
| **Created** | 2026-03-07 |
| **Status** | Phase 2 In Progress |

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Core Requirements](#2-core-requirements)
3. [Architecture Overview](#3-architecture-overview)
4. [Aircraft Profile System](#4-aircraft-profile-system)
5. [Performance Calculations](#5-performance-calculations)
6. [Data Modeling & Interpolation](#6-data-modeling--interpolation)
7. [User Interface Design](#7-user-interface-design)
8. [Offline Strategy](#8-offline-strategy)
9. [Technology Stack](#9-technology-stack)
10. [Project Structure](#10-project-structure)
11. [Development Phases](#11-development-phases)
12. [Testing Strategy](#12-testing-strategy)
13. [Deployment](#13-deployment)
14. [Open Questions & Decisions](#14-open-questions--decisions)
15. [Implementation Reference](#15-implementation-reference)
16. [References](#16-references)

---

## 1. Vision & Goals

Build a **modern, lightweight, offline-first** web application that performs performance calculations for small (general aviation) aircraft.

### Primary Goals

| # | Goal | Rationale |
|---|------|-----------|
| G1 | **100% offline capability** | Pilots need reliable calculations at remote airfields with no connectivity. |
| G2 | **Aircraft-agnostic profiles** | Different manufacturers provide data in different formats (tables, graphs, formulas). The system must adapt. |
| G3 | **Responsive design** | Must work comfortably on desktop monitors, tablets (kneeboard use), and phones. |
| G4 | **Lightweight & fast** | Minimal dependencies; instant load times even on low-end devices. |
| G5 | **Customizable & extensible** | Pilots or organizations should be able to add aircraft profiles without modifying app code. |
| G6 | **Static hosting** | GitHub Pages — no server, no backend, no database. |

### Non-Goals (for now)

- Regulatory compliance certification (this is a **tool**, not a certified instrument).
- Server-side user accounts or authentication (Google Drive sync uses client-side OAuth only).
- Real-time push notifications or data feeds.

---

## 2. Core Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Calculate **takeoff distance** (ground roll + distance to clear 50 ft obstacle) | Must |
| FR-02 | Calculate **landing distance** (ground roll + distance from 50 ft obstacle) | Must |
| FR-03 | Calculate **rate of climb** and **climb gradient** | Must |
| FR-04 | Calculate **cruise performance** (TAS, fuel flow, range, endurance) | Must |
| FR-05 | Calculate **weight & balance** (CG position, envelope check) | Must |
| FR-06 | Calculate **density altitude** from field elevation, temperature, and altimeter setting | Must |
| FR-07 | Calculate **crosswind / headwind components** | Must |
| FR-08 | Support loading / switching **aircraft profiles** (JSON files) | Must |
| FR-09 | Persist last-used inputs and profile selection across sessions | Should |
| FR-10 | Allow **user-defined profiles** (import via file picker) | Should |
| FR-11 | Provide **unit conversion** (ft/m, kt/km-h, lbs/kg, °F/°C, US gal/L) | Should |
| FR-12 | Calculate **fuel planning** (fuel required, reserves, endurance) | Should |
| FR-13 | Provide **pressure altitude** calculation | Should |
| FR-14 | **User-defined safety margins** — percentage, fixed value, and rounding options per calculation type | Must |
| FR-15 | Display performance **charts / visualizations** | Could |
| FR-16 | Export / print calculation results | Could |

### Non-Functional Requirements

| ID | Requirement | Details |
|----|-------------|---------|
| NFR-01 | **Offline-first** | Full functionality without network after initial load |
| NFR-02 | **Responsive** | Usable from 320px (phone) to 2560px+ (desktop) |
| NFR-03 | **Performance** | First Contentful Paint < 1s, Time to Interactive < 2s |
| NFR-04 | **Accessibility** | WCAG 2.1 AA — proper labels, contrast, keyboard navigation |
| NFR-05 | **Zero backend** | Static files only — deployable to GitHub Pages |
| NFR-06 | **Installable** | PWA — add-to-homescreen on mobile, standalone window on desktop |
| NFR-07 | **Lightweight** | Total bundle < 200 KB gzipped (excluding profile data) |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   UI Layer                            │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐  │  │
│  │  │ Takeoff │ │ Landing  │ │ Cruise │ │   W&B     │  │  │
│  │  │  View   │ │  View    │ │  View  │ │   View    │  │  │
│  │  └────┬────┘ └────┬─────┘ └───┬────┘ └─────┬─────┘  │  │
│  │       │           │           │             │        │  │
│  │  ┌────▼───────────▼───────────▼─────────────▼─────┐  │  │
│  │  │            Calculation Engine                   │  │  │
│  │  │  ┌────────────────────────────────────────────┐│  │  │
│  │  │  │         Interpolation Engine               ││  │  │
│  │  │  │  (linear, bilinear, multi-dimensional)     ││  │  │
│  │  │  └────────────────────────────────────────────┘│  │  │
│  │  └────────────────────┬───────────────────────────┘  │  │
│  │                       │                              │  │
│  │  ┌────────────────────▼───────────────────────────┐  │  │
│  │  │           Aircraft Profile Store               │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │  │  │
│  │  │  │ Sling    │ │ Cessna   │ │ Custom   │  ...  │  │  │
│  │  │  │ LSA.json │ │ 172.json │ │ user.json│       │  │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘       │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Service      │  │ localStorage │  │  IndexedDB       │   │
│  │ Worker       │  │ (settings)   │  │  (profiles)      │   │
│  │ (PWA cache)  │  │              │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Layer Separation

| Layer | Responsibility | Dependencies |
|-------|---------------|--------------|
| **UI Layer** | Render forms, display results, responsive layout | Calculation Engine |
| **Calculation Engine** | Perform performance math, apply corrections | Interpolation Engine, Profile Store |
| **Interpolation Engine** | Interpolate between data points from tables/charts | None (pure math) |
| **Profile Store** | Load, validate, and serve aircraft profile data | IndexedDB / localStorage |
| **Service Worker** | Cache app shell and static assets for offline use | None |

---

## 4. Aircraft Profile System

### Design Philosophy

Aircraft manufacturers provide performance data in wildly different formats:

- **Tabular data** — e.g., Cessna POH tables with rows of altitude/temperature vs. distances.
- **Reference tables** — e.g., Sling LSA provides a single reference condition (ISA, MTOW) with variants by surface type, without altitude/temperature interpolation.
- **Graph-derived data** — e.g., Piper charts where you enter on one axis, trace to a curve, then read the other axis. These are digitized into data point arrays.
- **Formulas** — some simple calculations can be expressed as equations (e.g., density altitude).
- **Correction factors** — "add 10% for each 1,000 ft above sea level."

The profile format must accommodate **all** of these approaches via a unified schema.

> **Note on obstacle height:** The FAA standard uses a 50 ft obstacle for takeoff/landing distance calculations. ICAO and many international manufacturers (including Sling Aircraft) use a 15 m (~49.2 ft) obstacle. The profile specifies the obstacle height used, and the UI labels adapt accordingly.

### Profile JSON Schema (v1)

```jsonc
{
  "profileVersion": "1.0",
  "aircraft": {
    "id": "sling-lsa",
    "name": "Sling LSA",
    "tailNumber": "N246LT",                // optional — user-specific
    "manufacturer": "Sling Aircraft",
    "type": "single-engine-land",
    "category": "light-sport"
  },

  "limits": {
    "maxGrossWeight":     { "value": 1320, "unit": "lbs" },
    "maxLandingWeight":   { "value": 1320, "unit": "lbs" },
    "emptyWeight":        { "value": 838,  "unit": "lbs" },
    "usefulLoad":         { "value": 482,  "unit": "lbs" },
    "fuelCapacity":       { "value": 26,   "unit": "us_gal" },
    "baggageMaxWeight":   { "value": 44,   "unit": "lbs" },
    "vne":                { "value": 132,  "unit": "kias" },
    "vno":                { "value": 108,  "unit": "kias" },
    "vs0":                { "value": 39,   "unit": "kias" },
    "vs1":                { "value": 45,   "unit": "kias" },
    "maxCrosswind":       { "value": 15,   "unit": "kt" }
  },

  // Fuel configuration — type, density, tanks, and preferred input unit
  "fuel": {
    "type": "100LL",                              // references a built-in fuel type
    "inputUnit": "us_gal",                        // how the pilot enters fuel: "L", "us_gal", "kg", "lbs"
    "capacity": { "value": 26, "unit": "us_gal" },
    "tanks": [
      { "name": "Left Wing",  "capacity": { "value": 13, "unit": "us_gal" } },
      { "name": "Right Wing", "capacity": { "value": 13, "unit": "us_gal" } }
    ]
  },

  "stations": [
    {
      "id": "pilot",
      "name": "Pilot",
      "arm": { "value": 80.0, "unit": "in" },
      "minWeight": { "value": 0, "unit": "lbs" },
      "maxWeight": { "value": 242, "unit": "lbs" }
    },
    {
      "id": "passenger",
      "name": "Passenger",
      "arm": { "value": 80.0, "unit": "in" },
      "minWeight": { "value": 0, "unit": "lbs" },
      "maxWeight": { "value": 242, "unit": "lbs" }
    },
    {
      "id": "fuel",
      "name": "Fuel",
      "arm": { "value": 82.0, "unit": "in" },
      "maxWeight": { "value": 156, "unit": "lbs" },
      "fuelStation": true,
      "fuelWeightPerUnit": { "value": 6.0, "unit": "lbs/us_gal" }
    },
    {
      "id": "baggage",
      "name": "Baggage",
      "arm": { "value": 118.0, "unit": "in" },
      "maxWeight": { "value": 44, "unit": "lbs" }
    }
  ],

  "weightBalance": {
    // CG reference system — determines how CG is expressed
    // "arm"     → CG in distance from datum (inches, mm, etc.)
    // "percent_mac" → CG as % of Mean Aerodynamic Chord
    "cgReference": "arm",

    // Required when cgReference is "arm"
    "cgUnit": "in",
    "weightUnit": "lbs",

    // Required when cgReference is "percent_mac"
    // (omitted here — see Cessna 172 example below for %MAC usage)
    // "macLeadingEdge": { "value": 38.7, "unit": "in" },
    // "macLength":      { "value": 58.4, "unit": "in" },

    // Multiple envelopes — each defines a closed polygon
    // Aircraft can have one or many (e.g., Normal + Utility)
    "envelopes": [
      {
        "id": "normal",
        "name": "Normal Category",
        "color": "#22c55e",           // for chart rendering
        "points": [
          { "weight": 838,  "cg": 78.0 },
          { "weight": 838,  "cg": 86.0 },
          { "weight": 1320, "cg": 86.0 },
          { "weight": 1320, "cg": 78.0 }
        ]
      }
    ]
  },

  "performance": {
    "takeoff": {
      "method": "table_interpolation",
      "description": "Takeoff distance vs pressure altitude and temperature",
      "variables": ["pressureAltitude", "temperature"],
      "result": ["groundRoll", "totalOver50ft"],
      "data": [
        {
          "pressureAltitude": { "value": 0, "unit": "ft" },
          "temperature": { "value": 15, "unit": "C" },
          "groundRoll": { "value": 490, "unit": "ft" },
          "totalOver50ft": { "value": 935, "unit": "ft" }
        }
        // ... more data points
      ],
      "corrections": [
        {
          "type": "headwind",
          "description": "Decrease distances by 10% for each 9 kt headwind",
          "factor": -0.10,
          "per": { "value": 9, "unit": "kt" },
          "appliesTo": ["groundRoll", "totalOver50ft"]
        },
        {
          "type": "tailwind",
          "description": "Increase distances by 10% for each 2 kt tailwind",
          "factor": 0.10,
          "per": { "value": 2, "unit": "kt" },
          "appliesTo": ["groundRoll", "totalOver50ft"]
        },
        {
          "type": "grass_runway",
          "description": "Increase ground roll by 15% for dry grass runway",
          "factor": 0.15,
          "appliesTo": ["groundRoll"]
        }
      ]
    },

    "landing": {
      "method": "table_interpolation",
      "variables": ["pressureAltitude", "temperature"],
      "result": ["groundRoll", "totalOver50ft"],
      "data": [],
      "corrections": []
    },

    "climb": {
      "method": "table_interpolation",
      "variables": ["pressureAltitude", "temperature"],
      "result": ["rateOfClimb"],
      "data": [],
      "corrections": []
    },

    "cruise": {
      "method": "table_interpolation",
      "variables": ["pressureAltitude", "powerSetting"],
      "result": ["trueAirspeed", "fuelFlow"],
      "data": [],
      "corrections": []
    }
  }
}
```

### Supported Calculation Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| `table_interpolation` | Multi-dimensional table with linear interpolation between points | Cessna POH altitude/temp tables, climb rate by altitude, cruise speed by altitude/RPM |
| `reference_table` | Single reference condition with categorical variants (e.g., surface type) — no interpolation between rows | Sling LSA takeoff/landing (ISA, MTOW, variants by surface) |
| `graph_points` | Ordered (x,y) pairs digitized from a performance graph, with curve interpolation | Koch chart, climb graph |
| `formula` | A mathematical expression with named variables | Density altitude, crosswind |
| `correction_chain` | Base value from another method, then sequential correction factors applied | Takeoff distance with wind/slope/weight adjustments |

### Fuel Types & Density

Fuel weight is critical for W&B calculations. Different fuel types have different densities, and even the same fuel type can vary slightly with temperature. The app ships with a **built-in fuel type registry** that profiles reference by type ID. Users can also override the density or define a custom fuel type.

#### Built-in Fuel Types

| Type ID | Name | Density (kg/L) | Density (lbs/US gal) | Typical Use |
|---------|------|---------------|---------------------|-------------|
| `100LL` | 100LL Avgas | 0.721 | 6.02 | Most piston GA aircraft |
| `91UL` | 91 UL Avgas | 0.715 | 5.97 | Unleaded avgas for approved engines |
| `94UL` | 94 UL Avgas | 0.715 | 5.97 | Unleaded avgas |
| `MOGAS` | Motor Gasoline (Auto Fuel) | 0.740 | 6.18 | STC-approved engines |
| `JET_A` | Jet-A / Jet-A1 | 0.804 | 6.71 | Turbine engines, some diesel piston |
| `DIESEL` | Diesel / Jet Fuel (piston) | 0.840 | 7.01 | Diesel aviation engines |
| `CUSTOM` | Custom Fuel | *(user-defined)* | *(user-defined)* | Any non-standard fuel |

> **Density note:** The values above are standard reference densities at 15 °C (59 °F). Real density varies with temperature. For W&B purposes, standard density is used unless the user explicitly overrides it. This matches standard industry practice (FAA uses 6.0 lbs/US gal for 100LL as a simplified reference).

#### How Fuel Configuration Works

The **profile** specifies:
- `fuel.type` — references a built-in fuel type (provides default density)
- `fuel.inputUnit` — how the pilot typically enters fuel for this aircraft: `"L"`, `"us_gal"`, `"kg"`, or `"lbs"`
- `fuel.capacity` — total fuel capacity in the profile's preferred unit
- `fuel.tanks` — individual tank definitions (for W&B and fuel management)

The **user settings** (stored in `localStorage`, not in the profile) can override:
- The fuel type (e.g., switch from 100LL to MOGAS)
- The density values (e.g., use a specific measured density)
- The input unit (e.g., pilot prefers gallons even though the profile defaults to litres)

This separation means the profile defines what the aircraft *expects*, while user settings capture the pilot's *preferences* and real-world conditions.

#### Fuel Input Unit Preference

The `fuel.inputUnit` field controls how the fuel input field is labeled and what unit the pilot enters. The calculation engine always converts to weight (kg or lbs) internally using the active fuel density:

| `inputUnit` | Pilot enters | Conversion to weight |
|-------------|-------------|---------------------|
| `"L"` | Litres | weight = litres × density_kg_per_L |
| `"us_gal"` | US Gallons | weight = gallons × density_lbs_per_gal |
| `"kg"` | Kilograms | direct (no conversion) |
| `"lbs"` | Pounds | direct (no conversion) |

### Profile Management

- **Bundled type profiles**: Ship in `/profiles/types/` — available to all users.
- **Community profiles**: Contributed via GitHub PR, merged into bundled.
- **Custom type profiles**: Created by user via wizard, stored in IndexedDB.
- **Profile validation**: Programmatic validation (not JSON Schema library — zero-dep constraint) on import and creation.

### Aircraft Type vs. Instance Architecture

The profile system separates **aircraft type data** (from the POH — shared across all airplanes of the same make/model) from **aircraft instance data** (specific to one airplane).

| Concept | What It Represents | Examples | Storage |
|---------|-------------------|----------|---------|
| **Type Profile** | POH data for a make/model | "Cessna 172S Skyhawk SP", "Sling LSA" | `profiles/types/` (bundled) or IndexedDB (custom) |
| **Aircraft Instance** | A specific airplane | "N246LT" (a Sling LSA), "N54321" (a Cessna 172S) | IndexedDB |
| **Fleet** | User's collection of instances | All the airplanes a pilot flies | IndexedDB |

**Why this separation?**
- A Cessna 172S type profile is authored once and shared by all users.
- Multiple users (or one user) can have different N-numbered Cessna 172S instances with different empty weights.
- Flight schools may have 5 identical C172s — same POH data, different weigh reports.
- Bundled type profiles can be updated without affecting instance data.

#### Type Profile (v2) — What It Contains

Everything from the POH that applies to **all aircraft of this make/model**:

| Section | Required? | Content |
|---------|-----------|---------|
| `schemaVersion` | ✅ Required | `"2.0"` |
| `aircraft` | ✅ Required | `id` (slug), `name`, `manufacturer`, `type`, `category`, `engine`, `enginePower`, `propeller` |
| `limits` | ✅ Required | `maxTakeoffWeight`, `maxLandingWeight`, `referenceEmptyWeight`, `referenceEmptyCG`, `baggageMaxWeight`, `maxCrosswind` |
| `fuel` | ✅ Required | `type`, `inputUnit`, `capacity`, `usableCapacity`, `tanks[]` |
| `speeds` | ✅ Required | At minimum `vne`, `vs0`; all others optional (`vx`, `vy`, `vrot`, `vlof`, `vref`, etc.) |
| `weightBalance` | ⚠️ Optional | `cgReference`, `macLeadingEdge`, `macLength`, `stations[]`, `envelopes[]`, `baggageConstraints[]` |
| `performance.takeoff` | ⚠️ Optional | Method + data |
| `performance.landing` | ⚠️ Optional | Method + data |
| `performance.climb` | ⚠️ Optional | Method + data |
| `performance.cruise` | ⚠️ Optional | Method + data |
| `performance.fuelConsumption` | ⚠️ Optional | Method + data |

**Why optional performance sections?** Not all POHs provide all data. A user might create a profile for an experimental aircraft that only has W&B and basic speeds. Each calculator gracefully shows "No [X] data in this aircraft profile" when its section is missing.

**Schema changes from v1 → v2:**

| v1 Field | v2 Field | Change |
|----------|----------|--------|
| `profileVersion: "1.0"` | `schemaVersion: "2.0"` | Renamed |
| `aircraft.tailNumber` | *(removed)* | Moved to instance |
| `limits.emptyWeight` | `limits.referenceEmptyWeight` | Renamed — POH book value, overridable by instance |
| `weightBalance.emptyCG` | `limits.referenceEmptyCG` | Moved — POH book value, overridable by instance |
| `limits.usefulLoad` | *(removed)* | Derived at runtime: `maxTakeoffWeight − effectiveEmptyWeight` |
| *(new)* | `aircraft.icaoType` | Optional ICAO type designator (e.g., "C172") |

#### Type Profile v2 Example (Cessna 172S)

```jsonc
{
  "schemaVersion": "2.0",
  "aircraft": {
    "id": "cessna-172s",
    "name": "Cessna 172S Skyhawk SP",
    "manufacturer": "Cessna / Textron Aviation",
    "icaoType": "C172",
    "type": "single-engine-land",
    "category": "normal",
    "engine": "Lycoming IO-360-L2A",
    "enginePower": { "value": 180, "unit": "hp" },
    "propeller": { "type": "fixed-pitch", "blades": 2 }
  },
  "limits": {
    "maxTakeoffWeight": { "value": 2550, "unit": "lbs" },
    "maxLandingWeight": { "value": 2550, "unit": "lbs" },
    "referenceEmptyWeight": { "value": 1663, "unit": "lbs" },
    "referenceEmptyCG": { "arm": 40.5, "unit": "in" },
    "baggageMaxWeight": { "value": 120, "unit": "lbs" },
    "maxCrosswind": { "value": 15, "unit": "kt" }
  },
  "fuel": { ... },
  "speeds": { ... },
  "weightBalance": { ... },
  "performance": {
    "takeoff": { "method": "table_interpolation", ... },
    "landing": { "method": "table_interpolation", ... },
    "climb": { "method": "table_interpolation", ... },
    "cruise": { "method": "table_interpolation", ... },
    "fuelConsumption": { "method": "table_interpolation", ... }
  }
}
```

#### Aircraft Instance — What It Contains

Instance-specific data for **one particular airplane**:

```jsonc
{
  "instanceId": "uuid-v4",                  // auto-generated
  "typeId": "cessna-172s",                   // links to type profile
  "registration": "N54321",                  // tail number
  "displayName": "N54321",                   // user-editable label
  "emptyWeight": { "value": 1680, "unit": "lbs" },  // from weigh report
  "emptyCG": { "arm": 41.2, "unit": "in" },         // from weigh report
  "lastWeighed": "2025-11-15",               // optional
  "notes": "Annual due March 2026",          // optional
  "createdAt": "2026-03-10T01:00:00Z",
  "updatedAt": "2026-03-10T01:00:00Z"
}
```

**Override semantics:**
- If instance has `emptyWeight` → use it; else fall back to type's `referenceEmptyWeight`
- If instance has `emptyCG` → use it; else fall back to type's `referenceEmptyCG`
- `usefulLoad` is always computed: `maxTakeoffWeight − effectiveEmptyWeight`
- Performance data, envelopes, speeds, and stations always come from the type profile — instances don't override POH data

#### Profile Merger (Compatibility Bridge)

When a user selects an aircraft from their fleet, the system **merges** the type profile + instance into a runtime profile object that the existing calc/UI modules consume unchanged.

```
mergeProfile(typeProfile, instance) → runtimeProfile
```

The merge function:
1. Deep-clones the type profile
2. Sets `aircraft.tailNumber` = `instance.registration`
3. Sets `limits.emptyWeight` = `instance.emptyWeight` (or type's `referenceEmptyWeight`)
4. Sets `weightBalance.emptyCG` = `instance.emptyCG` (or type's `referenceEmptyCG`)
5. Recomputes `limits.usefulLoad` = `maxTakeoffWeight − emptyWeight`
6. Returns the merged object

**This is the key architectural insight**: the merge layer means **zero changes to any calc or UI modules**. They continue to consume the same profile shape they expect today.

#### v1 → v2 Migration

When the app encounters a v1 profile:
1. Detect `profileVersion: "1.0"` (absence of `schemaVersion`)
2. Run `migrateV1toV2(v1Profile)` which:
   - Extracts `tailNumber`, `emptyWeight`, `emptyCG` into an instance object
   - Renames `emptyWeight` → `referenceEmptyWeight` in the type
   - Sets `schemaVersion: "2.0"`
   - Returns `{ type, instance }`
3. Store both in IndexedDB

### Fleet Management

Users maintain a **fleet** — a collection of aircraft instances. Each instance references a type profile from the library.

```
Type Library                Fleet                    Active Aircraft
┌──────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│ Sling LSA    │────▶│ N246LT (Sling)  │────▶│ Merged runtime       │
│ Cessna 172S  │────▶│ N12345 (C172S)  │     │ profile for calcs    │
│ Custom: RV-7 │────▶│ N67890 (RV-7)   │     └──────────────────────┘
└──────────────┘     └─────────────────┘
                           ▲ user selects
```

**Workflow:**
1. User browses the aircraft type library (bundled + custom types)
2. User selects a type and creates an instance (enters registration, actual empty weight/CG)
3. Instance appears in their fleet
4. When performing calculations, user selects an aircraft from their fleet
5. The app loads the type profile + instance → mergeProfile() → calculators use merged profile

**Header aircraft selector** (replaces current static display):
- Dropdown showing fleet: `N246LT — Sling LSA` / `N12345 — Cessna 172S`
- "Manage Fleet…" option opens fleet management panel
- On selection change: load merged profile, re-init all calculators, persist active ID

**First-run experience:**
1. Seed bundled types into IndexedDB `types` store
2. Show welcome: "Add your first aircraft"
3. Prompt for type selection, tail number, empty weight/CG
4. Auto-migrate v1 data if present

### Profile Creation Wizard

A multi-step form guides users through entering POH data to create a custom type profile:

| Step | Title | Fields | Required? |
|------|-------|--------|-----------|
| 1 | **Aircraft Info** | Name, manufacturer, type (SEL/MEL/etc.), category (normal/utility/LSA), engine, power, propeller | ✅ Yes |
| 2 | **Limits & Speeds** | Max takeoff weight, max landing weight, reference empty weight, reference empty CG, baggage limits, Vne, Vs0, Vy, Vx, other V-speeds | ✅ Yes (limits); speeds partially required |
| 3 | **Fuel System** | Fuel type (select from registry), capacity, usable capacity, number of tanks, tank names/capacities, preferred input unit | ✅ Yes |
| 4 | **Weight & Balance** | CG reference (% MAC or arm), MAC leading edge & length (if %MAC), stations (name, arm, max weight), envelopes (polygon points), baggage constraints | ⚠️ Optional |
| 5 | **Takeoff Performance** | Method selection (reference_table or table_interpolation), obstacle height, reference conditions, data entry | ⚠️ Optional |
| 6 | **Landing Performance** | Same structure as takeoff | ⚠️ Optional |
| 7 | **Climb Performance** | Method, variables, data points (altitude vs. ROC, climb speed) | ⚠️ Optional |
| 8 | **Cruise Performance** | Method, variables, data grid (altitude × power setting → speeds) | ⚠️ Optional |
| 9 | **Fuel Consumption** | Method, variables, data points (power setting → fuel flow, speed) | ⚠️ Optional |
| 10 | **Review & Save** | Summary of all entered data, validation results, save button | ✅ Yes |

**UX features:**
- Progress indicator with completion status
- Skip optional steps (steps 4–9) — profile simply won't have those sections
- Save draft at any step; drafts appear in type library with "draft" badge
- Table builder for performance data (add/remove rows)
- Live SVG preview for CG envelope point entry
- Real-time per-field validation; full validation on Review step

### Profile Validation

Programmatic validator in `js/data/profile-validator.js` (not a JSON Schema library — respects zero-dep constraint):

```
validateTypeProfile(profile) → { valid: boolean, errors: ValidationError[], warnings: ValidationWarning[] }
```

| Category | Rule | Severity |
|----------|------|----------|
| Structure | Required sections present | Error |
| Structure | `schemaVersion` is `"2.0"` | Error |
| Physics | `maxTakeoffWeight` > `referenceEmptyWeight` | Error |
| Physics | `usableCapacity` ≤ `capacity` | Error |
| Physics | `Vs0` < `Vne` | Error |
| W&B | Envelope polygon has ≥ 3 points | Error (if W&B section present) |
| W&B | Reference empty weight falls within envelope | Warning |
| Performance | At least 2 data points for interpolation | Error (if section present) |
| Performance | Data points are ordered (ascending altitude, etc.) | Warning |
| Fuel | Tank capacities sum to total capacity | Warning |
| Completeness | No performance sections defined | Warning |

---

## 5. Performance Calculations

### 5.1 Density Altitude

**Inputs:** Field elevation (ft), Outside Air Temperature (°C or °F), Altimeter setting (inHg)

**Method:** Formula-based

```
Pressure Altitude = Field Elevation + (29.92 - Altimeter Setting) × 1000
Density Altitude  = Pressure Altitude + (120 × (OAT - ISA_Temp))
ISA_Temp          = 15 - (2 × Pressure Altitude / 1000)
```

### 5.2 Takeoff Distance

**Inputs:** Pressure altitude, OAT, weight, wind component, runway surface, runway slope

**Method:** Depends on profile data availability:

- **`table_interpolation`** — When the profile provides a multi-dimensional table (altitude × temperature → distances), interpolate to find base values. Typical of Cessna/Piper POHs.
- **`reference_table`** — When the profile provides distances at a single reference condition (e.g., ISA, MTOW) with surface-type variants. Typical of simpler POHs (Sling LSA). The user selects the surface type and gets the corresponding values directly.

**Steps:**
1. Look up or interpolate base ground roll and obstacle clearance distance from the profile data.
2. Apply weight correction (if profile provides it).
3. Apply wind correction (headwind reduces, tailwind increases).
4. Apply surface correction (if using `table_interpolation` — `reference_table` profiles already include surface variants).
5. Apply slope correction if provided.
6. Apply safety margins (if configured).
7. Return final ground roll and total distance.

> **Obstacle height:** The profile specifies the obstacle height used (50 ft FAA / 15 m ICAO). The UI adapts labels accordingly ("distance over 50 ft" vs. "distance over 15 m").

### 5.3 Landing Distance

Same structure as takeoff — supports both `table_interpolation` and `reference_table` methods, with landing-specific data and corrections.

### 5.4 Rate of Climb

**Inputs:** Pressure altitude, OAT, weight

**Method:** Table interpolation + weight correction

**Output:** Rate of climb (ft/min), climb gradient (ft/nm)

### 5.5 Cruise Performance

**Inputs:** Pressure altitude, power setting (RPM)

**Method:** Table interpolation (2D — altitude × RPM)

**Output:** Indicated Airspeed (KIAS), True Airspeed (KTAS)

> **Note:** Some profiles (e.g., Cessna) may include fuel flow in the cruise table. Others (e.g., Sling LSA) provide fuel consumption in a separate table. The profile schema supports both patterns.

### 5.5.1 Fuel Consumption

**Inputs:** Engine RPM (power setting), fuel quantity on board

**Method:** Table interpolation (1D — RPM)

**Output:** Fuel flow (L/hr and/or GPH), endurance, range

The fuel consumption table may be defined at a specific reference altitude (e.g., 3,000 ft ISA). The profile records this reference condition so the UI can display it. Endurance and range in the profile are pre-computed reference values; the app recalculates them based on actual fuel on board.

### 5.6 Weight & Balance

Weight & Balance is one of the most critical pre-flight calculations. The system must handle the significant variation in how different manufacturers define CG limits.

#### CG Reference Systems

Aircraft manufacturers express CG limits in two fundamentally different ways:

| System | How CG is expressed | Typical aircraft | Example value |
|--------|-------------------|------------------|---------------|
| **Arm (station)** | Distance from a datum point (inches, mm) | Sling LSA, many GA aircraft | CG = 82.4 in aft of datum |
| **% MAC** | Percentage of Mean Aerodynamic Chord | Many transport-category and some GA aircraft, some LSAs | CG = 28.5% MAC |

The profile schema supports both via the `cgReference` field (`"arm"` or `"percent_mac"`).

#### Arm-Based CG

The traditional approach used by most small GA aircraft. A datum point is defined (often the firewall or nose), and all station arms are measured as distances from that datum.

```
Total Weight = Σ (station weights)
Total Moment = Σ (station weight × station arm)
CG Position  = Total Moment / Total Weight
```

The resulting CG (in inches or mm) is plotted against total weight on the envelope chart.

#### % MAC-Based CG

Some aircraft express CG limits as a percentage of the Mean Aerodynamic Chord (MAC). This is common in aircraft where the manufacturer's documentation uses this convention.

The profile must define:
- **MAC leading edge (LEMAC)** — the arm position where the MAC begins
- **MAC length** — the chord length of the MAC

Conversion from arm to %MAC:

```
%MAC = ((CG_arm - LEMAC) / MAC_length) × 100
```

The calculation engine computes CG in arm units first (same formula as above), then converts to %MAC for envelope checking and display.

#### Multiple Category Envelopes

Many aircraft are certified under more than one operating category, each with different weight and CG limits. The classic example is the **Cessna 172 Skyhawk**, which defines two overlapping envelopes:

| Category | Max Gross Weight | CG Range | Permitted Maneuvers |
|----------|-----------------|----------|---------------------|
| **Normal** | 2,550 lbs | 35.0 – 47.3 in aft of datum | Standard flight operations, max 60° bank |
| **Utility** | 2,200 lbs | 35.0 – 40.5 in aft of datum | Spins, steep turns, lazy eights, chandelles |

The envelopes overlap — at lower weights and forward CG, the aircraft may be within both categories. The system must:

1. **Check against all defined envelopes** independently.
2. **Report which categories the loading satisfies** (could be none, one, or several).
3. **Visually render all envelopes** on the same chart with distinct colors/labels.
4. **Plot the calculated CG point** and indicate its category status.

#### Profile Examples

**Example 1 — Simple single-envelope, arm-based (Sling LSA):**

```jsonc
"weightBalance": {
  "cgReference": "arm",
  "cgUnit": "in",
  "weightUnit": "lbs",
  "envelopes": [
    {
      "id": "normal",
      "name": "Normal Category",
      "color": "#22c55e",
      "points": [
        { "weight": 838,  "cg": 78.0 },
        { "weight": 838,  "cg": 86.0 },
        { "weight": 1320, "cg": 86.0 },
        { "weight": 1320, "cg": 78.0 }
      ]
    }
  ]
}
```

**Example 2 — Dual-envelope, arm-based (Cessna 172S Skyhawk SP):**

```jsonc
"weightBalance": {
  "cgReference": "arm",
  "cgUnit": "in",
  "weightUnit": "lbs",
  "envelopes": [
    {
      "id": "normal",
      "name": "Normal Category",
      "color": "#22c55e",
      "points": [
        { "weight": 1500, "cg": 35.0 },
        { "weight": 1500, "cg": 47.3 },
        { "weight": 1950, "cg": 47.3 },
        { "weight": 2550, "cg": 47.3 },
        { "weight": 2550, "cg": 41.0 },
        { "weight": 2100, "cg": 35.0 }
      ]
    },
    {
      "id": "utility",
      "name": "Utility Category",
      "color": "#3b82f6",
      "points": [
        { "weight": 1500, "cg": 35.0 },
        { "weight": 1500, "cg": 40.5 },
        { "weight": 2200, "cg": 40.5 },
        { "weight": 2200, "cg": 37.5 },
        { "weight": 1950, "cg": 35.0 }
      ]
    }
  ]
}
```

**Example 3 — %MAC-based CG:**

```jsonc
"weightBalance": {
  "cgReference": "percent_mac",
  "cgUnit": "%",
  "weightUnit": "lbs",
  "macLeadingEdge": { "value": 38.7, "unit": "in" },
  "macLength":      { "value": 58.4, "unit": "in" },
  "envelopes": [
    {
      "id": "normal",
      "name": "Normal Category",
      "color": "#22c55e",
      "points": [
        { "weight": 1200, "cg": 15.0 },
        { "weight": 1200, "cg": 33.0 },
        { "weight": 1800, "cg": 33.0 },
        { "weight": 1800, "cg": 20.0 }
      ]
    }
  ]
}
```

#### Envelope Point-in-Polygon Check

To determine if a calculated (weight, CG) point falls within an envelope, the system uses a **ray-casting algorithm** (point-in-polygon test). Each envelope is a closed polygon defined by its `points` array.

```
For each envelope:
  1. Construct polygon from envelope points
  2. Test if (totalWeight, cgPosition) is inside the polygon
  3. Record result: { envelopeId, envelopeName, isWithin: true/false }

Result categories:
  - Within ALL envelopes       → "Within limits (Normal + Utility)"
  - Within SOME envelopes      → "Within limits (Normal only)"
  - Within NO envelopes        → "⚠ OUTSIDE CG LIMITS"
  - Weight exceeds all envelopes → "⚠ OVERWEIGHT"
```

#### Inputs

- Weight at each station (from profile station definitions)
- Fuel quantity (converted to weight via `fuelWeightPerUnit`)

#### Outputs

| Output | Description |
|--------|-------------|
| Total weight | Sum of all station weights |
| CG position (arm) | Moment ÷ weight — always computed in arm units |
| CG position (%MAC) | Converted from arm when `cgReference` is `percent_mac` |
| Category status | Which envelope(s) the point falls within |
| Weight status | Under/over max gross weight per category |
| Envelope chart | Visual plot of all envelopes with CG point marked |

#### W&B Envelope Chart

The envelope chart is rendered as an **inline SVG** (no external libraries). It displays:

```
Weight (lbs)
  ▲
  │
2550 ┤         ┌──────────────────┐
  │         │    NORMAL         │
2200 ┤     ┌───┤ · · · · · · · · ·│
  │     │   │  UTILITY        │
1950 ┤  ┌──┤   │ · · · · · · · · ·│
  │  │  │   └──────────────────┘
1500 ┤  └──┴───┘        ✦ ← You are here
  │                   (2,150 lbs, 42.3 in)
  └──┬────┬────┬────┬────┬────▶ CG (in)
    35   37   39   41   43   47
```

Features:
- All envelopes drawn as filled polygons with distinct colors and legend
- Calculated CG point plotted as a marker (✦)
- Point color: green if within limits, red if outside
- Axis labels with grid lines
- If %MAC mode: x-axis shows % values instead of inches
- Responsive — scales to container width
- Touch-friendly — tap on point shows details on mobile

### 5.7 Crosswind / Headwind Component

**Inputs:** Wind direction, wind speed, runway heading

**Method:** Formula-based (trigonometry)

```
Angle         = |Wind Direction - Runway Heading|
Headwind      = Wind Speed × cos(Angle)
Crosswind     = Wind Speed × sin(Angle)
```

### 5.8 Fuel Planning

**Inputs:** Trip distance, cruise TAS, cruise fuel flow, fuel on board, reserve policy

**Method:** Formula-based

**Output:** Trip fuel, time en route, fuel remaining, endurance

### 5.9 Safety Margins

Safety margins allow pilots to add conservative buffers to calculated values. They are applied **after** all performance corrections (wind, surface, slope, etc.) and are the **last step** in the calculation pipeline.

#### Why Margins Matter

POH performance figures assume a factory-new airplane, a skilled test pilot, and ideal technique. Real-world factors — pilot proficiency, aging engines, imperfect surfaces, gusty winds — mean raw POH numbers are often optimistic. Many flight schools, operators, and insurance policies require specific margins (e.g., FAA recommends a 1.43× factor for takeoff distance under Advisory Circular 91-13C).

#### Margin Types

| Type | Description | Example |
|------|-------------|---------|
| **Percentage** | Add a percentage of the calculated value | +25% → 1,000 ft becomes 1,250 ft |
| **Fixed value** | Add an absolute distance, time, or quantity | +500 ft → 1,000 ft becomes 1,500 ft |
| **Factor** | Multiply the calculated value by a factor | ×1.43 → 1,000 ft becomes 1,430 ft |

Multiple margin types can be **combined**. When combined, they are applied in this order:
1. Factor (multiply)
2. Percentage (add %)
3. Fixed value (add absolute)

#### Rounding Options

After margins are applied, the result can optionally be rounded:

| Option | Behavior | Example (raw: 1,237 ft) |
|--------|----------|-------------------------|
| **None** | Display the exact calculated value | 1,237 ft |
| **Round up to nearest 10** | Ceiling to next 10 | 1,240 ft |
| **Round up to nearest 50** | Ceiling to next 50 | 1,250 ft |
| **Round up to nearest 100** | Ceiling to next 100 | 1,300 ft |

Rounding is always **up** (ceiling), never down — this is a safety tool.

#### Applicable Calculations

Not every calculation benefits from a margin. The following table identifies where margins apply:

| Calculation | Margin applicable? | Typical use |
|-------------|-------------------|-------------|
| Takeoff ground roll | ✅ Yes | Add buffer for technique, surface condition |
| Takeoff total (50 ft) | ✅ Yes | Most common — "can I clear the trees?" |
| Landing ground roll | ✅ Yes | Contaminated/wet runway buffer |
| Landing total (50 ft) | ✅ Yes | "Can I stop before the end?" |
| Rate of climb | ✅ Yes (reduction) | Derate climb for aging engine, high DA |
| Fuel required | ✅ Yes | Extra reserve beyond standard |
| Cruise range | ✅ Yes (reduction) | Conservative range estimate |
| Density altitude | ❌ No | Physical calculation — no margin concept |
| Crosswind component | ❌ No | Physical calculation — no margin concept |
| Weight & balance | ❌ No | Must be exact — margins would hide real problems |

> **Note on climb margins:** For rate of climb, a margin *reduces* the value (conservative = lower climb rate). The system handles this by applying the factor/percentage as a reduction rather than an addition.

#### Margin Configuration

Margins are configured **per calculation type** and stored as part of the user's settings (not part of the aircraft profile — margins are a pilot/operator preference, not an aircraft property).

```jsonc
// Example margin settings (stored in localStorage)
{
  "margins": {
    "takeoff": {
      "groundRoll":   { "factor": null, "percentage": 25, "fixed": null, "roundUp": 100 },
      "totalOver50ft": { "factor": 1.43, "percentage": null, "fixed": null, "roundUp": 100 }
    },
    "landing": {
      "groundRoll":   { "factor": null, "percentage": null, "fixed": 200, "roundUp": 50 },
      "totalOver50ft": { "factor": null, "percentage": 40, "fixed": null, "roundUp": 100 }
    },
    "climb": {
      "rateOfClimb":  { "factor": 0.90, "percentage": null, "fixed": null, "roundUp": null }
    },
    "fuel": {
      "fuelRequired": { "factor": null, "percentage": 10, "fixed": null, "roundUp": null }
    }
  }
}
```

#### Margin Presets

To make configuration easy, the app will ship with a few built-in presets:

| Preset | Description | Takeoff factor | Landing factor |
|--------|-------------|----------------|----------------|
| **None** | Raw POH values, no margin | ×1.0 | ×1.0 |
| **Conservative** | General safety buffer | +25%, round up 100 ft | +40%, round up 100 ft |
| **FAA AC 91-13C** | FAA advisory circular recommendation | ×1.43, round up 100 ft | ×1.67, round up 100 ft |
| **Custom** | User-defined per field | (user-configured) | (user-configured) |

Presets are a starting point — the user can always modify individual fields after selecting a preset.

#### Display Behavior

When margins are active, the results panel should clearly distinguish between raw and adjusted values:

```
┌─ Results ─────────────────────────────────────────────┐
│                                                        │
│  Ground Roll:          685 ft  →  900 ft  (FAA ×1.43) │
│  Total (50 ft):      1,280 ft  →  1,900 ft (FAA ×1.43)│
│                          ↑              ↑              │
│                        (POH)      (with margin)        │
│                                                        │
│  ℹ Safety margin active: FAA AC 91-13C                │
└────────────────────────────────────────────────────────┘
```

Both the **raw (POH) value** and the **adjusted value** are always shown so the pilot can see exactly what the margin added. The margin source (preset name or "Custom") is labeled.

#### Calculation Pipeline (with margins)

The full calculation pipeline for a distance-based result (e.g., takeoff):

```
1. Look up base value from profile data (table interpolation)
2. Apply profile-defined corrections (wind, surface, slope, weight)
3. → Raw POH result
4. Apply safety margin:
   a. Multiply by factor (if set)
   b. Add percentage (if set)
   c. Add fixed value (if set)
5. Apply rounding (if set)
6. → Final adjusted result
7. Display both raw and adjusted values
```

---

## 6. Data Modeling & Interpolation

### Why This Matters

Manufacturers present data differently. A Cessna 172 POH has neat tables. A Piper Archer uses graphical charts. Some LSAs provide simplified correction factors. The interpolation engine must handle all of these from a unified data representation.

### Interpolation Methods

#### 6.1 Linear Interpolation (1D)

For single-variable lookups (e.g., climb rate vs. altitude at a fixed temperature).

```
result = y1 + (y2 - y1) × ((x - x1) / (x2 - x1))
```

#### 6.2 Bilinear Interpolation (2D)

For two-variable lookups (e.g., takeoff distance vs. altitude AND temperature).

1. Find the four surrounding data points in the 2D grid.
2. Interpolate along one axis to get two intermediate values.
3. Interpolate along the second axis between the two intermediates.

#### 6.3 Multi-dimensional Interpolation

For three or more variables (e.g., cruise performance vs. altitude, RPM, and temperature), chain bilinear interpolations.

#### 6.4 Edge Cases

| Case | Handling |
|------|----------|
| Input below table minimum | Clamp to minimum (with warning) |
| Input above table maximum | Clamp to maximum (with warning) |
| Exact match on a data point | Return value directly, skip interpolation |
| Non-uniform grid spacing | Handled naturally by the interpolation formula |

---

## 7. User Interface Design

### Design Principles

1. **Calculator-first** — The primary UI is a form with inputs and results. Not a dashboard, not a map.
2. **Single-page, tabbed** — One HTML page with tab navigation between calculation types.
3. **Mobile-first responsive** — Design for phone first, then expand for tablet/desktop.
4. **Minimal chrome** — No unnecessary decoration. Aviation-themed but professional.
5. **High contrast** — Usable in bright sunlight (cockpit use).

### Layout

```
┌─────────────────────────────────────────────────┐
│  [Aircraft: N246LT - Sling LSA]     [⚙ Settings]│
├─────────────────────────────────────────────────┤
│  [Takeoff] [Landing] [Climb] [Cruise] [W&B]     │
│  [Density Alt] [Crosswind] [Fuel]               │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ Inputs ──────────────────────────────────┐  │
│  │  Field Elevation:  [____] ft              │  │
│  │  Temperature:      [____] °C   [°F toggle]│  │
│  │  Altimeter:        [____] inHg            │  │
│  │  Wind Direction:   [____] °               │  │
│  │  Wind Speed:       [____] kt              │  │
│  │  Runway Heading:   [____] °               │  │
│  │  Runway Surface:   [Paved ▾]              │  │
│  │                                           │  │
│  │  Safety Margin:    [FAA AC 91-13C ▾]      │  │
│  │                                           │  │
│  │            [ Calculate ]                  │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Results ─────────────────────────────────┐  │
│  │  Pressure Altitude:    2,450 ft           │  │
│  │  Density Altitude:     3,200 ft           │  │
│  │                                           │  │
│  │  Ground Roll:       685 ft  → 1,000 ft    │  │
│  │  Total (50 ft):   1,280 ft  → 1,900 ft    │  │
│  │  Headwind Component:   12 kt              │  │
│  │  Crosswind Component:  8 kt               │  │
│  │                                           │  │
│  │  ℹ Margin: FAA AC 91-13C (×1.43, ↑100ft) │  │
│  │  ⚠ Weight exceeds max gross by 15 lbs    │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
├─────────────────────────────────────────────────┤
│  flight-perf v1.0 • Offline Ready ✓            │
└─────────────────────────────────────────────────┘
```

### Responsive Breakpoints

| Breakpoint | Target | Layout |
|------------|--------|--------|
| < 480px | Phone (portrait) | Single column, stacked tabs (hamburger menu), full-width inputs |
| 480–768px | Phone (landscape) / Small tablet | Single column, scrollable tab bar |
| 768–1024px | Tablet | Two columns — inputs left, results right |
| > 1024px | Desktop | Two columns with wider spacing, optional chart panel |

### Theme & Styling

- **Color palette**: Dark blue/slate primary, white background, amber/orange for warnings, red for errors, green for "within limits."
- **Typography**: System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...`) for maximum performance.
- **Dark mode**: Support via `prefers-color-scheme` media query + manual toggle.

---

## 8. Offline Strategy

### Progressive Web App (PWA)

| Component | Implementation |
|-----------|---------------|
| **Service Worker** | Cache-first strategy for app shell (HTML, CSS, JS). Network-first for profile updates (if ever needed). |
| **Web App Manifest** | `manifest.json` with app name, icons, theme color, `display: standalone`. |
| **Cache versioning** | Cache name includes version string; old caches deleted on activation. |
| **Install prompt** | Custom banner suggesting "Add to Home Screen" on mobile. |

### Data Storage

| Data | Storage | Rationale |
|------|---------|-----------|
| App settings (units, theme, margins) | `localStorage` | Small, synchronous, existing pattern |
| Active aircraft instance ID | `localStorage` | Quick lookup on app start |
| Last-used inputs per calculation type | `localStorage` | Convenience — restore on revisit |
| Aircraft instances (fleet) | `IndexedDB` | Structured data, needs indexing |
| Custom type profiles | `IndexedDB` | Large JSON blobs, queryable |
| Bundled type profiles | Service Worker cache + `IndexedDB` (seeded on first run) | Always available offline; IDB copy enables uniform query |
| Google Drive sync metadata | `IndexedDB` | Timestamps, file IDs |

#### IndexedDB Design

**Database:** `flightperf`, **Version:** 1

| Object Store | Key Path | Indexes | Contents |
|-------------|----------|---------|----------|
| `types` | `typeId` | `source` (bundled/custom), `aircraft.name` | Type profile JSON objects |
| `fleet` | `instanceId` | `typeId`, `registration`, `updatedAt` | Aircraft instance objects |
| `syncMeta` | `key` | — | Google Drive sync state |

New module: `js/data/db.js` — Promise-based wrappers over vanilla `IDBDatabase` API (zero dependencies).

### Google Drive Backup (Optional)

For users who want cross-device sync or cloud backup, the app supports optional Google Drive integration. The app is **fully functional offline without it**.

| Aspect | Design |
|--------|--------|
| **Auth** | Google Identity Services (GIS) — client-side OAuth 2.0, no backend |
| **Scope** | `drive.appdata` — hidden app-specific folder, can't access user's files |
| **Data format** | JSON files in `appDataFolder`: `fleet.json`, `custom-types.json`, `preferences.json` |
| **Sync strategy** | Manual with auto-prompt — "Backup Now" button + prompt after significant changes |
| **Conflict resolution** | Last-write-wins with timestamps; local is source of truth |
| **Script loading** | GIS library (~30 KB) lazy-loaded only when user navigates to Settings → Google Drive |
| **Offline** | Operates normally; sync button shows "Offline — will sync when connected" |
| **Requirements** | Google Cloud project with OAuth client ID configured for `volium.github.io` |

### Offline Indicator

- Show a subtle indicator in the footer: "Offline Ready ✓" or "Offline ✗".
- All calculations work fully offline — no server calls ever needed for computation.

---

## 9. Technology Stack

### Chosen Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Markup** | HTML5 | Semantic, accessible |
| **Styling** | CSS3 with Custom Properties (CSS variables) | Theming, no build step, lightweight |
| **Logic** | Vanilla JavaScript (ES Modules) | Zero dependencies, maximum control, smallest bundle |
| **Build** | None (or optional Vite for dev server + minification) | Simplicity; can run raw files from disk |
| **Testing** | Vitest (or plain assertions if zero-dep preferred) | Fast, ES Module native |
| **Hosting** | GitHub Pages | Free, static, HTTPS |

### Why Not [X]?

| Technology | Why Not |
|------------|---------|
| React / Vue / Angular | Overkill — adds 30–100 KB+ of framework for a calculator app. |
| Tailwind CSS | Utility classes add cognitive overhead; CSS variables + a small stylesheet is sufficient. |
| TypeScript | Considered but deferred — adds build step. Can be adopted later if project grows. |
| SQLite / Wasm DB | Over-engineered for profile storage. IndexedDB is sufficient. |

### Dependencies

**Production dependencies: ZERO.** The app ships as pure HTML/CSS/JS.

**Dev dependencies (optional):**
- `vite` — dev server with hot reload + production build/minification.
- `vitest` — unit testing.

---

## 10. Project Structure

```
flight-perf/
├── index.html                  # Single-page app entry point
├── manifest.json               # PWA manifest
├── sw.js                       # Service worker
├── package.json                # Dev dependencies (vitest)
├── vitest.config.js            # Test runner configuration
├── PLAN.md                     # This document
├── README.md                   # Project overview & usage
│
├── css/
│   ├── main.css                # Core styles & components
│   ├── variables.css           # CSS custom properties (theme, light/dark)
│   └── responsive.css          # Media queries for breakpoints
│
├── js/
│   ├── app.js                  # App initialization, profile loading, calculator wiring
│   ├── ui/
│   │   ├── tabs.js             # Tab navigation with keyboard support
│   │   ├── settings.js         # Settings panel (theme, profile selector)
│   │   ├── perf-ui-common.js   # Shared UI: margin fieldset, distance results, ref notes
│   │   ├── takeoff.js          # Takeoff calculator UI
│   │   ├── landing.js          # Landing calculator UI
│   │   ├── climb.js            # Climb planner UI
│   │   ├── cruise.js           # Cruise performance UI
│   │   ├── weight-balance.js   # Weight & Balance UI with SVG envelope chart
│   │   ├── density-altitude.js # Density altitude calculator UI
│   │   ├── crosswind.js        # Crosswind calculator UI with SVG diagram
│   │   └── fuel.js             # Fuel planner UI
│   │
│   ├── calc/
│   │   ├── density-altitude.js # Pressure alt, density alt, ISA formulas
│   │   ├── takeoff.js          # Takeoff distance (reference_table + interpolation)
│   │   ├── landing.js          # Landing distance (reference_table + interpolation)
│   │   ├── climb.js            # Climb rate interpolation + time-to-climb integration
│   │   ├── cruise.js           # Cruise speed (2D interpolation) + density-corrected fuel
│   │   ├── weight-balance.js   # W&B: stations, CG, %MAC, envelope check (ray casting)
│   │   ├── crosswind.js        # Wind component decomposition (trigonometric)
│   │   └── fuel.js             # Fuel planning with density-corrected flow + usable fuel
│   │
│   ├── engine/
│   │   ├── interpolation.js    # 1D linear + 2D bilinear interpolation with clamping
│   │   ├── margins.js          # Safety margin application (percentage, fixed, roundUp)
│   │   ├── perf-common.js      # Shared calc: reference table lookup, distance conversion
│   │   └── units.js            # Unit conversions & number formatting
│   │
│   └── data/
│       ├── profile-loader.js   # Fetch & validate aircraft profiles
│       ├── fuel-types.js       # Built-in fuel type registry (100LL, MOGAS, Jet-A, etc.)
│       ├── unit-preferences.js # Global unit preferences, conversion, smart rounding
│       └── storage.js          # localStorage abstraction with prefix namespacing
│
├── tests/
│   ├── engine/
│   │   ├── interpolation.test.js   # 1D, table, 2D interpolation tests
│   │   ├── margins.test.js         # Safety margin tests
│   │   ├── units.test.js           # Unit conversion round-trip & formatting tests
│   │   └── perf-common.test.js     # Reference table, distance, obstacle label tests
│   ├── calc/
│   │   ├── density-altitude.test.js # PA, ISA, DA, density ratio, full calc tests
│   │   ├── crosswind.test.js       # Wind components, gusts, status tests
│   │   ├── takeoff-landing.test.js  # Takeoff & landing reference table tests
│   │   ├── climb.test.js           # Single-altitude & full climb plan tests
│   │   ├── cruise.test.js          # 2D interpolation, fuel flow, endurance tests
│   │   ├── weight-balance.test.js  # W&B, CG, %MAC, envelope, baggage tests
│   │   └── fuel.test.js            # Fuel planning, density correction, reserve tests
│   └── data/
│       ├── fuel-types.test.js       # Fuel type registry tests
│       └── unit-preferences.test.js # convertValue, smart rounding tests
│
├── profiles/
│   ├── schema/
│   │   └── type-profile-v2.md     # v2 schema reference (living document)
│   └── types/                     # Aircraft type profiles (v2 format)
│       ├── sling-lsa.json         # N246LT Sling LSA type profile
│       └── cessna-172s.json       # Cessna 172S Skyhawk SP type profile
│
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── favicon.ico
```

---

## 11. Development Phases

### Phase 1 — Foundation (MVP) ✅ COMPLETE

> All calculators implemented with one aircraft profile (Sling LSA N246LT).

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Project scaffolding (HTML, CSS, JS structure, PWA manifest, service worker) | ✅ |
| 1.2 | CSS theme system (custom properties, light/dark, responsive grid) | ✅ |
| 1.3 | Tab navigation and single-page routing | ✅ |
| 1.4 | Interpolation engine (1D linear, 2D bilinear) | ✅ |
| 1.5 | Unit conversion utilities | ✅ |
| 1.6 | Density altitude calculator (formula-based) | ✅ |
| 1.7 | Crosswind calculator (formula-based, SVG diagram) | ✅ |
| 1.8 | Sling LSA profile — populated with real POH data | ✅ |
| 1.9 | Takeoff distance calculator (reference_table + safety margins) | ✅ |
| 1.10 | Landing distance calculator (reference_table + safety margins) | ✅ |
| 1.11 | Climb planner (interpolation, time-to-climb, cruise climb) | ✅ |
| 1.12 | Cruise performance calculator (2D interpolation, density-corrected fuel) | ✅ |
| 1.13 | Weight & Balance calculator (%MAC, envelope chart, ray-casting) | ✅ |
| 1.14 | Fuel planner (trip fuel, reserves, usable fuel, density correction) | ✅ |
| 1.15 | Safety margins engine (percentage, fixed, roundUp) | ✅ |
| 1.16 | Service worker + offline caching | ✅ |
| 1.17 | Fuel type registry (100LL, MOGAS, Jet-A, etc.) | ✅ |
| 1.18 | GitHub Pages deployment | ✅ |

### Phase 2 — Enhancements (In Progress)

| Task | Description | Status |
|------|-------------|--------|
| 2.2 | Global unit preferences (settings panel) | ✅ |
| 2.3 | Unit conversion with smart rounding on preference change | ✅ |
| 2.4 | Results display in user-preferred units | ✅ |
| 2.5 | Global reset button (clear all calculator inputs) | ✅ |
| 2.6 | Dark theme fixes (header, variables) | ✅ |
| 2.7 | W&B calculation in display units (eliminate round-trip conversion errors) | ✅ |
| 2.8 | W&B improved diagnostics (overweight vs CG out of range) | ✅ |
| 2.9 | W&B chart improvements (callout label, marker z-order) | ✅ |
| 2.10 | Live fuel weight display in W&B and Fuel Planner | ✅ |
| 2.11 | Mobile responsive fixes (header truncation, fuel row layout) | ✅ |
| 2.12 | Input validation and error messaging improvements | |
| 2.13 | Unit tests for interpolation, calculations, and margins | ✅ |

> **Note:** Tasks 2.1 (profile import) and 2.14 (Cessna 172) from the original plan are absorbed into Phase 3, where they fit naturally with the new type/instance architecture.

### Phase 3 — Aircraft Data System ⭐ NEW

> Core architectural evolution: type/instance separation, IndexedDB, fleet management, new profiles, profile wizard, Google Drive backup.

#### Phase 3A — Data Foundation

| Task | Description | Depends On | Status |
|------|-------------|------------|--------|
| 3A.1 |
| 3A.1 | **IndexedDB abstraction** (`js/data/db.js`) — Promise-based CRUD for `types`, `fleet`, `syncMeta` stores | — | ✅ |
| 3A.2 | **Type profile schema v2** — define structure, document required vs optional sections (`profiles/schema/type-profile-v2.md`) | — | ✅ |
| 3A.3 | **Profile validator** (`js/data/profile-validator.js`) — comprehensive validation with errors + warnings | 3A.2 | ✅ |
| 3A.4 | **Profile merger** (`js/data/profile-merger.js`) — `mergeProfile(type, instance)` producing runtime profile compatible with existing calc layer | 3A.2 | |
| 3A.5 | **v1 → v2 migration** (`js/data/profile-migrator.js`) — convert existing v1 Sling LSA profile to v2 type + instance | 3A.2, 3A.3 | |
| 3A.6 | **Migrate bundled Sling LSA profile** to v2 format (`profiles/types/sling-lsa.json`) | 3A.5 | |
| 3A.7 | **Update profile-loader.js** — support v2 types from IDB; first-run seeding of bundled types; deprecate URL-based loading | 3A.1, 3A.3 | |
| 3A.8 | **Update app.js** — IndexedDB-based profile resolution (read active ID → load instance → load type → merge → set state) | 3A.1, 3A.4, 3A.7 | |
| 3A.9 | **Unit tests** for db.js, profile-validator, profile-merger, profile-migrator | 3A.1–3A.5 | 🔶 (db.js done) |

#### Phase 3B — Fleet Management

| Task | Description | Depends On |
|------|-------------|------------|
| 3B.1 | **Fleet management UI** (`js/ui/fleet.js`) — list, add, edit, remove aircraft instances | 3A.* |
| 3B.2 | **Header aircraft selector** — dropdown in header bar to switch active aircraft | 3B.1 |
| 3B.3 | **First-run experience** — detect empty fleet, prompt to create first aircraft, auto-migrate v1 data | 3B.1, 3A.5 |
| 3B.4 | **Aircraft switching** — on selection change: load merged profile, re-init calculators, update header, persist active ID | 3B.2, 3A.4 |

#### Phase 3C — New Profiles

| Task | Description | Depends On |
|------|-------------|------------|
| 3C.1 | **Cessna 172S type profile** (`profiles/types/cessna-172s.json`) — full POH data with `table_interpolation` for takeoff/landing (altitude × temperature grids) | 3A.2 |
| 3C.2 | **Extend takeoff/landing calcs** for `table_interpolation` method — multi-variable grids (Cessna uses altitude × temp, Sling uses reference tables) | 3C.1 |
| 3C.3 | **Cessna 172S unit tests** — POH-derived test cases for all calculators with the new profile | 3C.2 |
| 3C.4 | **Profile import/export** — file picker import (JSON) with v2 validation; export type profile and/or instance as JSON download | 3A.3, 3B.1 |

#### Phase 3D — Profile Creation Wizard

| Task | Description | Depends On |
|------|-------------|------------|
| 3D.1 | **Wizard framework** (`js/ui/wizard.js`) — multi-step form infrastructure, progress indicator, step navigation, draft saving | 3A.1 |
| 3D.2 | **Wizard steps 1–3** — Aircraft Info, Limits & Speeds, Fuel System (required steps) | 3D.1 |
| 3D.3 | **Wizard step 4** — Weight & Balance (stations editor, envelope point editor with live SVG preview) | 3D.2 |
| 3D.4 | **Wizard steps 5–9** — Performance data entry (table builder, method selection) | 3D.2 |
| 3D.5 | **Wizard step 10** — Review & Save (validation summary, save to IDB `types` store) | 3D.2–3D.4, 3A.3 |

#### Phase 3E — Google Drive Backup

| Task | Description | Depends On |
|------|-------------|------------|
| 3E.1 | **Google Drive module** (`js/data/gdrive.js`) — GIS auth, appDataFolder CRUD, lazy script loading | 3A.1 |
| 3E.2 | **Settings UI** for Google Drive — sign in/out, last sync time, manual backup/restore buttons | 3E.1 |
| 3E.3 | **Backup flow** — serialize fleet + custom types + preferences → JSON files in appDataFolder | 3E.1 |
| 3E.4 | **Restore flow** — download from appDataFolder → merge into local IDB (conflict resolution: local wins with flag) | 3E.1, 3E.3 |
| 3E.5 | **Auto-prompt** — after significant changes (add/edit/remove aircraft, import profile), suggest backup if signed in | 3E.3 |

### Phase 4 — Calculation Improvements & Polish

> Previously Phase 3. Calc accuracy improvements and UI polish.

| Task | Description |
|------|-------------|
| 4.1 | Wind aloft support for fuel planner (headwind/tailwind at cruise altitude) |
| 4.2 | Climb calculator density altitude correction (accept OAT, compute DA, derate ROC) |
| 4.3 | W&B enhancements: fuel burn CG shift visualization, moment-based entry option |
| 4.4 | Crosswind diagram enhancement (component arrows with values) |
| 4.5 | Print / export calculation results |
| 4.6 | Onboarding / help tooltips |
| 4.7 | Accessibility audit and WCAG 2.1 AA fixes |
| 4.8 | Better PWA icons (replace placeholder solid-color PNGs) |

### Phase 5 — Flight Planning Integration

> Previously Phase 4. Requires aircraft data system (Phase 3) to be complete.

| Task | Description |
|------|-------------|
| 5.1 | Airport database — searchable local database of airports (identifier, name, location, elevation, runways) |
| 5.2 | Airport selector UI — search/autocomplete for departure and destination airports |
| 5.3 | Weather integration — fetch current METAR and TAF for selected airports (online feature) |
| 5.4 | Winds aloft integration — fetch or manually enter wind data at cruise altitude |
| 5.5 | NavLog generator — calculate headings, ground speed, time/fuel per leg based on winds |
| 5.6 | Comprehensive flight plan — combine W&B, takeoff/landing performance, climb, cruise, fuel, and weather into a single flight plan view |
| 5.7 | Flight plan export/print — generate a printable navlog and flight plan summary |

> **Note on current limitations:** The Cruise and Fuel Planner calculators currently assume **calm winds** (zero wind component). TAS equals ground speed in all calculations. Phase 4.1 and Phase 5.4/5.5 will add wind aloft support to compute actual ground speed, adjusted fuel burn, and time en route.

---

## 12. Testing Strategy

### Framework & Infrastructure

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Test runner** | Vitest | ES Module native, fast, zero-config for our stack |
| **Assertions** | Vitest built-in (`expect`) | No extra dependency |
| **Config** | `vitest.config.js` | Alias `@/` → `js/`, JSON imports enabled |
| **NPM scripts** | `npm test`, `npm run test:watch` | Standard entry points |

### Test Data Principles

1. **POH-derived values** — All aviation test data uses actual Sling LSA POH figures. Tests serve as both correctness checks and documentation of expected behavior.
2. **Known-answer tests** — Where formulas have well-known results (e.g., ISA temperature at sea level = 15 °C, standard pressure = 29.92 inHg), use those exact values.
3. **Round-trip accuracy** — Unit conversions are tested for round-trip fidelity within floating-point tolerance.
4. **Edge cases** — Every module tests boundary conditions: empty inputs, clamped ranges, zero values, missing data.
5. **Tolerance** — Floating-point comparisons use `toBeCloseTo(expected, decimals)` where appropriate.

### Test Structure

```
tests/
├── engine/
│   ├── interpolation.test.js   ─ 1D, table, 2D interpolation
│   ├── margins.test.js         ─ Safety margin application
│   ├── units.test.js           ─ All unit conversions & formatNumber
│   └── perf-common.test.js     ─ Reference table calc, distance, obstacle label
├── calc/
│   ├── density-altitude.test.js ─ PA, ISA temp, DA, density ratio, full calc
│   ├── crosswind.test.js       ─ Wind components, full crosswind with gusts
│   ├── takeoff-landing.test.js  ─ Takeoff & landing (shared reference_table logic)
│   ├── climb.test.js           ─ Single-altitude climb, full climb plan
│   ├── cruise.test.js          ─ 2D cruise interpolation, fuel flow, endurance
│   ├── weight-balance.test.js  ─ W&B, CG, %MAC, envelope check, baggage
│   └── fuel.test.js            ─ Fuel planning, density correction, reserves
└── data/
    ├── db.test.js               ─ IndexedDB CRUD for types, fleet, syncMeta
    ├── profile-validator.test.js ─ Type profile + instance validation
    ├── fuel-types.test.js       ─ Fuel type registry, volume→weight
    └── unit-preferences.test.js ─ convertValue, smart rounding
```

### Module Test Coverage

#### Engine Layer (pure math, no dependencies)

| Module | Functions | Test Cases | Key Scenarios |
|--------|-----------|------------|---------------|
| `engine/interpolation.js` | `interpolate1D`, `interpolateFromTable`, `interpolate2D` | ~25 | Empty arrays, single point, exact match, midpoint, off-center, clamping (min/max), extrapolation, nested object accessor, unsorted data, 2D bilinear on Sling cruise grid |
| `engine/margins.js` | `applyMargin`, `emptyMargins` | ~10 | No margin, percentage only, fixed only, roundUp only, combined (pct+fixed+round), description string, zero raw value |
| `engine/units.js` | 14 conversion functions + `formatNumber` | ~20 | Each conversion pair forward & reverse, round-trip accuracy (e.g., kg→lbs→kg), temperature (known: 0°C=32°F, 100°C=212°F), `formatNumber` with null/NaN/valid |
| `engine/perf-common.js` | `calcReferenceTable`, `getDistanceValue`, `formatObstacleLabel` | ~12 | Valid surface lookup, unknown surface → error, distance in native/converted units, obstacle label formatting (metric with ft, imperial) |

#### Calc Layer (aviation logic, depends on engine)

| Module | Functions | Test Cases | Key Scenarios |
|--------|-----------|------------|---------------|
| `calc/density-altitude.js` | `pressureAltitude`, `isaTemperature`, `densityAltitude`, `isaDeviation`, `densityRatio`, `calculateDensityAltitude` | ~18 | Sea level ISA (PA=0, DA=0, ISA=15°C), high altitude (10k ft), non-standard pressure, hot day (DA>PA), cold day (DA<PA), σ≈1.0 at SL, full calc with metric/imperial inputs |
| `calc/crosswind.js` | `calculateWindComponents`, `calculateCrosswind` | ~15 | Direct headwind (0° angle), direct tailwind (180°), pure crosswind (90°), 45° angle, calm wind, gust handling, crosswind status (ok/caution/exceeds), reciprocal runway |
| `calc/takeoff.js` + `calc/landing.js` | `calculateTakeoff`, `calculateLanding` | ~8 | Paved surface (Sling POH: GR=120m, TO=230m), grass surface, with margins, missing profile data → error, unsupported method → error |
| `calc/climb.js` | `calculateClimb`, `calculateClimbPlan` | ~12 | ROC at sea level (800 fpm from POH), interpolated ROC at 1500 ft, full climb plan 0→6000 ft, cruise climb transition with speed factor, target below departure → error, ceiling detection |
| `calc/cruise.js` | `calculateCruise` | ~8 | Exact data point (3000 ft, 5000 RPM → KIAS 98, KTAS 104), interpolated (4500 ft, 4900 RPM), fuel flow density correction, endurance & range calculation |
| `calc/weight-balance.js` | `calculateWeightBalance` | ~12 | Normal loading within envelope, overweight detection, CG out of range, %MAC calculation (Sling: LEMAC 1366 mm, MAC 1339 mm), baggage constraint violation, fuel weight resolution (L→kg, gal→lbs), empty aircraft |
| `calc/fuel.js` | `calculateFuelPlan` | ~10 | Standard trip (100 nm, 5000 RPM), density correction at altitude, insufficient fuel detection, reserve calculation, endurance & range, missing fuel data → error |

#### Data Layer

| Module | Functions | Test Cases | Key Scenarios |
|--------|-----------|------------|---------------|
| `data/db.js` | `openDB`, `closeDB`, `getType`, `getAllTypes`, `getTypesBySource`, `putType`, `deleteType`, `clearTypes`, `getInstance`, `getAllInstances`, `getInstancesByType`, `putInstance`, `deleteInstance`, `clearFleet`, `getSyncMeta`, `putSyncMeta`, `deleteSyncMeta` | ~27 | Database open/create, CRUD round-trips for all 3 stores, index queries (source, typeId), overwrite semantics, delete missing key (safe), clear store, cross-store isolation |
| `data/profile-validator.js` | `validateTypeProfile`, `validateInstance` | ~60 | Valid minimal profile, null/invalid input, schemaVersion checks, all 4 required sections (aircraft, limits, fuel, speeds), optional W&B section (%MAC requirements, station validation, envelope polygon ≥3 points, baggage constraint refs), performance method/data checks, physics rules (MTOW>EW, Vs0<Vne, usable≤capacity), completeness warnings, instance validation |
| `data/fuel-types.js` | `getFuelType`, `getAllFuelTypes`, `fuelVolumeToWeight` | ~10 | Known types (100LL: 6.02 lbs/gal, 0.721 kg/L), unknown type → null, volume→weight for L/gal/kg/lbs, override density |
| `data/unit-preferences.js` | `convertValue` (pure function) | ~15 | Altitude ft→m with smart rounding (5000→1525), m→ft, altimeter inHg→hPa (29.92→1013.2), temperature C→F (15→59), fuel gal→L, empty/null/NaN → '', same unit → unchanged |

### Total: ~314 test cases across 15 test files

### Manual / Integration Tests

- **Profile loading** — load valid and invalid JSON, verify error handling.
- **Offline behavior** — disable network in DevTools, verify all functions work.
- **Responsive layout** — test at each breakpoint with DevTools device emulation.
- **PWA install** — test add-to-homescreen on Android and iOS.

### Test Data Source

All test values should come from **actual POH data** for the aircraft. This serves as both a correctness check and documentation of expected behavior.

---

## 13. Deployment

### GitHub Pages

1. Push to `main` branch.
2. GitHub Pages serves from root (`/`) or `/docs` folder.
3. HTTPS provided automatically by GitHub.
4. Custom domain optional (CNAME file).

### Build Process

For Phase 1, **no build step required** — raw HTML/CSS/JS served directly.

Optional future enhancement:
- `vite build` to minify and bundle for production.
- Output to `/dist` or `/docs` for GitHub Pages.

### Cache Busting

- Service worker version string updated on each deploy.
- File hashing in URLs if using a build tool.

---

## 14. Open Questions & Decisions

| # | Question | Status | Decision |
|---|----------|--------|----------|
| Q1 | Should we use TypeScript from the start or add it later? | **Open** | Leaning toward plain JS for simplicity; TS can be added later. |
| Q2 | Should profiles support calculated fields (formulas as strings) or only data tables? | **Open** | Leaning toward both — formulas for simple calcs, tables for complex. |
| Q3 | How to handle aircraft with non-standard performance data (e.g., only graph-based)? | **Decided** | Graph data would be pre-digitized into point arrays in the profile. |
| Q4 | Should W&B visualization use Canvas, SVG, or a library like Chart.js? | **Decided** | Inline SVG — lightweight, no dependency, responsive. |
| Q5 | Do we need multi-language support? | **Decided** | No — English only for v1. |
| Q6 | Should the app support multiple unit systems simultaneously? | **Decided** | Global unit preferences in Settings — 7 unit types, all calculators adapt. Per-calculator toggles removed. |
| Q7 | Should we use a build tool (Vite) from the start? | **Decided** | No — raw ES Modules served directly. No build step required. |
| Q8 | Type/instance separation — should we split profiles? | **Decided** | Yes — type profiles contain shared POH data, instances contain per-airplane data (registration, weigh report). Profile merger produces runtime profile for calc layer compatibility. |
| Q9 | Storage architecture for fleet and profiles? | **Decided** | localStorage for settings + active ID; IndexedDB for types, fleet, sync metadata. Google Drive for optional cloud backup. |
| Q10 | Google Drive integration approach? | **Decided** | Client-side OAuth 2.0 via Google Identity Services, `drive.appdata` scope (hidden folder), lazy-loaded GIS script. No backend. |
| Q11 | Multiple instances of same type? | **Decided** | Yes — core use case. Flight schools may have multiple C172s with different weigh reports. |
| Q12 | Bundled type profiles update strategy? | **Open** | Leaning toward: on app update, re-seed bundled types if a `dataVersion` field is newer. User's custom types are never overwritten. |
| Q13 | Community profile distribution? | **Open** | Leaning toward PR to repo → becomes bundled. Future: hosted registry. |
| Q14 | CG envelope entry UX in profile wizard? | **Open** | Leaning toward coordinate pairs with live SVG preview. Click-to-place on canvas is complex and less precise for POH-derived data. |
| Q15 | Google Drive sync granularity? | **Open** | Leaning toward few large files (`fleet.json`, `custom-types.json`, `preferences.json`). Fewer API calls, simpler conflict management. |
| Q16 | Google Cloud project ownership for OAuth client ID? | **Open** | GCP project needed before Phase 3E.1. |

---

## 15. Implementation Reference

> This section documents the current implementation state for developer context.

### Module Architecture

```
app.js (entry point)
  ├── data/db.js ──────────── IndexedDB abstraction (types, fleet, syncMeta)
  ├── data/profile-loader.js ── Load type profiles from IDB; seed bundled types
  ├── data/profile-merger.js ── mergeProfile(type, instance) → runtime profile
  ├── data/profile-migrator.js ─ v1 → v2 migration
  ├── data/profile-validator.js ─ Comprehensive v2 profile validation
  ├── ui/tabs.js ─────────── Tab navigation, keyboard support, URL hash sync
  ├── ui/settings.js ─────── Theme, profile, units, reset; triggers initCalculators()
  ├── ui/fleet.js ─────────── Fleet management (add/edit/remove aircraft instances)
  ├── ui/wizard.js ────────── Profile creation wizard (multi-step form)
  ├── ui/density-altitude.js ── calc/density-altitude.js (formulas)
  ├── ui/crosswind.js ──────── calc/crosswind.js (trigonometry)
  ├── ui/takeoff.js ────────── calc/takeoff.js → engine/perf-common.js (reference_table)
  ├── ui/landing.js ────────── calc/landing.js → engine/perf-common.js (reference_table)
  ├── ui/climb.js ──────────── calc/climb.js → engine/interpolation.js (1D + integration)
  ├── ui/cruise.js ─────────── calc/cruise.js → engine/interpolation.js (2D bilinear)
  ├── ui/weight-balance.js ─── calc/weight-balance.js → data/fuel-types.js
  └── ui/fuel.js ───────────── calc/fuel.js → engine/interpolation.js + calc/density-altitude.js
```

Shared modules:
- `engine/units.js` — unit conversions, `formatNumber()`
- `engine/margins.js` — safety margin application (percentage, fixed, roundUp)
- `engine/interpolation.js` — 1D linear, 1D from table, 2D bilinear
- `engine/perf-common.js` — shared takeoff/landing reference table logic
- `data/storage.js` — localStorage wrapper with `flightperf_` prefix
- `data/db.js` — IndexedDB wrapper (Promise-based CRUD for types, fleet, syncMeta)
- `data/unit-preferences.js` — global unit system (7 types, smart rounding, display helpers)
- `data/fuel-types.js` — fuel density registry (100LL, MOGAS, Jet-A, etc.)
- `data/profile-merger.js` — type + instance → runtime profile (compatibility bridge)
- `data/profile-validator.js` — comprehensive v2 profile validation (errors + warnings)
- `data/profile-migrator.js` — v1 → v2 profile migration
- `data/gdrive.js` — Google Drive backup/restore (lazy-loaded, optional)
- `ui/perf-ui-common.js` — shared margin fieldset UI, distance results renderer, `esc()`, `displayUnit()`, `buildRefNote()`

### Calculator Summary

| Calculator | Calc Method | Profile Data Used | SVG Graphics |
|-----------|------------|-------------------|--------------|
| Density Alt | Formula | None | No |
| Crosswind | Trigonometry | `limits.maxCrosswind` | Yes (compass diagram) |
| Takeoff | Reference table + margins | `performance.takeoff` | No |
| Landing | Reference table + margins | `performance.landing` | No |
| Climb | 1D interpolation + integration | `performance.climb`, `speeds` | No |
| Cruise | 2D interpolation | `performance.cruise`, `performance.fuelConsumption`, `fuel` | No |
| W&B | Station summation + point-in-polygon | `weightBalance`, `limits`, `fuel` | Yes (envelope chart) |
| Fuel | 1D + 2D interpolation | `performance.fuelConsumption`, `performance.cruise`, `fuel` | No |

> **Calm wind assumption:** Cruise and Fuel Planner calculators currently assume calm winds — TAS equals ground speed. Wind aloft support is planned for Phase 4.1 / Phase 5.

### Supported Profile Methods

| Method | Used By | Description |
|--------|---------|-------------|
| `reference_table` | Takeoff, Landing | Single reference condition with surface-type variants |
| `table_interpolation` | Climb (1D), Cruise (2D), Fuel Consumption (1D) | Multi-dimensional interpolation between data points |

### Storage Keys

| Key | Contents | Cleared on Reset |
|-----|----------|-----------------|
| `flightperf_theme` | "auto" / "light" / "dark" | No |
| `flightperf_activeAircraftId` | Active aircraft instance UUID | No |
| `flightperf_global_units` | `{ altitude, altimeter, temperature, distance, weight, fuel }` | No |
| `flightperf_density_inputs` | `{ fieldElevation, altimeter, oat }` | Yes |
| `flightperf_takeoff_inputs` | `{ surface, marginType, marginPctValue, marginFixedValue, marginRoundUp }` | Yes |
| `flightperf_landing_inputs` | Same as takeoff | Yes |
| `flightperf_climb_inputs` | `{ departureElevation, targetAltitude, altimeter, transitionAltitude, cruiseClimbSpeed }` | Yes |
| `flightperf_cruise_inputs` | `{ altitude, altimeter, rpm }` | Yes |
| `flightperf_wb_inputs` | `{ pilot, passenger, baggage_front, baggage_rear, _fuel }` | Yes |
| `flightperf_crosswind_inputs` | `{ windDirection, windSpeed, gustSpeed, runwayHeading }` | Yes |
| `flightperf_fuel_inputs` | `{ tripDistance, cruiseAltitude, altimeter, rpm, fuelOnBoard, reserveMinutes }` | Yes |

### Form ID Prefixes

| Calculator | Prefix | Examples |
|-----------|--------|---------|
| Density Altitude | `da-` | `da-field-elev`, `da-oat`, `da-altimeter` |
| Crosswind | `xw-` | `xw-runway`, `xw-wind-dir`, `xw-wind-speed` |
| Takeoff | `to-` | `to-surface`, `to-margin-type` |
| Landing | `ld-` | `ld-surface`, `ld-margin-type` |
| Climb | `cl-` | `cl-dep-elev`, `cl-target`, `cl-altimeter` |
| Cruise | `cr-` | `cr-alt`, `cr-altimeter`, `cr-rpm` |
| W&B | `wb-` | `wb-pilot`, `wb-fuel`, `wb-fuel-weight` |
| Fuel Planner | `fp-` | `fp-distance`, `fp-fob`, `fp-fob-weight` |
| Settings | `setting-` | `setting-theme`, `setting-altitude` |

### Unit Preferences — Conversion on Change

When a unit is changed in Settings, `convertSavedInputs()` runs before `initCalculators()`:

1. Reads saved inputs for each affected calculator from localStorage
2. Converts numeric fields using `convertValue(value, fromUnit, toUnit, type)`
3. Saves converted values back to localStorage
4. `initCalculators()` re-renders all calculator panels with new unit suffixes

Smart rounding rules for altitude/distance conversions:
- **Meters:** nearest 5 (<100), 10 (100-499), 25 (500-1999), 50 (2000+)
- **Feet:** nearest 10 (<500), 50 (500-1999), 100 (2000+)
- **Fuel L:** nearest 1; **Fuel gal:** nearest 0.5
- **Weight, temperature, altimeter hPa:** nearest whole number
- **Altimeter inHg:** 2 decimal places

### W&B Calculation Design

All arithmetic runs in the user's **display weight unit** to avoid floating point precision errors from round-trip conversions. Profile values (empty weight, max weight, envelope boundary points, baggage constraints) are converted once from profile units to display units at the start of the calculation. User inputs are used directly without conversion. The envelope chart renders from the already-converted results.

### Key Design Decisions Made

| Decision | Rationale |
|----------|-----------|
| Zero production dependencies | Maximum control, smallest bundle, no framework overhead |
| Per-calculator init functions | Each tab re-renders its HTML from scratch; simple, no state management needed |
| Global unit prefs (not per-calculator) | Cleaner UI, consistent experience, one place to configure |
| Calc engines return internal units, UI converts | Clean separation; calc engines are unit-agnostic (except W&B which uses display units) |
| Service worker cache-first | Offline-first; users may be at remote airfields |
| Profile obstacle height configurable | ICAO uses 15m, FAA uses 50ft; profile specifies which |
| Fuel density from registry, not profile | Fuel type can change (100LL vs MOGAS); pilot preference, not aircraft property |
| Smart rounding on unit conversion | Pilot-friendly numbers; 5000 ft → 1525 m, not 1524 m |

### Codebase Statistics

| Category | Count |
|----------|-------|
| Total JS files | 29 |
| Total CSS files | 3 |
| Total lines of JS | ~3,400 |
| Total lines of CSS | ~830 |
| Test files | 15 |
| Test cases | 314 |
| Calculators | 8 |
| Global unit types | 7 |
| Fuel types supported | 6 |
| Profile data points | ~60 (climb: 4, cruise: 20, fuel: 5, takeoff: 2, landing: 2, W&B stations: 5, etc.) |

---

## 16. References

### Aviation References

- FAA Pilot's Handbook of Aeronautical Knowledge (PHAK), Chapter 11 — Aircraft Performance
- FAA Weight & Balance Handbook (FAA-H-8083-1B)
- Aircraft-specific Pilot Operating Handbooks (POH)
- ICAO Standard Atmosphere (ISA) model

### Technical References

- [MDN — Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN — IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [web.dev — Progressive Web Apps](https://web.dev/progressive-web-apps/)
- [JSON Schema Specification](https://json-schema.org/)

---

*Last updated: 2026-03-10 — Phase 3 Aircraft Data System architecture added*
