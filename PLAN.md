# Flight Performance Calculator — Project Plan

> **Living document** — update this file as requirements evolve, decisions are made, or implementation details change.

| Field | Value |
|-------|-------|
| **Project** | flight-perf |
| **Repository** | GitHub — hosted via GitHub Pages |
| **Created** | 2026-03-07 |
| **Status** | Phase 1 Complete |

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
15. [References](#15-references)

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

- Flight planning (route, weather, NOTAM integration) — these require online services.
- Real-time data feeds (METAR, TAF).
- Multi-user / account systems.
- Regulatory compliance certification (this is a **tool**, not a certified instrument).

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

- **Bundled profiles**: Ship with 1–2 example profiles in `/profiles/`.
- **User-imported profiles**: Loaded via file picker, stored in IndexedDB.
- **Profile validation**: JSON Schema validation on import with clear error messages.
- **Profile editor**: Out of scope for v1 — profiles are authored as JSON files externally.

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
| App settings (units, theme, last profile, margins) | `localStorage` | Small, synchronous, simple |
| Aircraft profiles (bundled) | Service Worker cache | Cached with app shell |
| Aircraft profiles (user-imported) | `IndexedDB` | Can store large JSON blobs |
| Last-used inputs per calculation type | `localStorage` | Convenience — restore on revisit |

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
│       └── storage.js          # localStorage abstraction with prefix namespacing
│
├── profiles/
│   └── sling-lsa.json          # N246LT Sling LSA profile (POH data)
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

### Phase 2 — Enhancements

| Task | Description |
|------|-------------|
| 2.1 | Profile import (file picker + IndexedDB) |
| 2.2 | Global unit preferences (settings panel) |
| 2.3 | Input validation and error messaging improvements |
| 2.4 | Unit tests for interpolation, calculations, and margins |
| 2.5 | Second aircraft profile (e.g., Cessna 172) to validate table_interpolation |

### Phase 3 — Polish & Extensibility

| Task | Description |
|------|-------------|
| 3.1 | Additional W&B features: fuel burn CG shift visualization, moment-based entry option |
| 3.2 | Print / export results |
| 3.3 | Second aircraft profile (e.g., Cessna 172) for testing flexibility |
| 3.4 | Profile validation with detailed error messages |
| 3.5 | Onboarding / help tooltips |
| 3.6 | Performance optimizations (lazy loading, code splitting) |
| 3.7 | Accessibility audit and fixes |

---

## 12. Testing Strategy

### Unit Tests

- **Interpolation engine** — test 1D, 2D interpolation accuracy, edge cases (extrapolation clamping, exact matches).
- **Each calculator module** — test against known POH values (expected input → expected output).
- **Unit conversions** — round-trip conversion accuracy.

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
| Q1 | Should we use TypeScript from the start or add it later? | **Open** | Leaning toward plain JS for simplicity; TS can be added in Phase 3. |
| Q2 | Should profiles support calculated fields (formulas as strings) or only data tables? | **Open** | Leaning toward both — formulas for simple calcs, tables for complex. |
| Q3 | How to handle aircraft with non-standard performance data (e.g., only graph-based)? | **Open** | Graph data would be pre-digitized into point arrays in the profile. |
| Q4 | Should W&B visualization use Canvas, SVG, or a library like Chart.js? | **Decided** | Inline SVG — lightweight, no dependency, responsive, supports multi-envelope rendering. |
| Q5 | Do we need multi-language support? | **Decided** | No — English only for v1. |
| Q6 | Should the app support multiple unit systems simultaneously (e.g., show both ft and m)? | **Open** | Leaning toward a global unit preference with toggle. |
| Q7 | Should we use a build tool (Vite) from the start? | **Open** | Leaning toward yes for dev experience, but keep the ability to run without it. |

---

## 15. References

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

*Last updated: 2026-03-07*
