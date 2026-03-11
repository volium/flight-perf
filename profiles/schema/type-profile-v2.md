# Aircraft Type Profile — Schema v2

> **Living document** — this schema evolves as new aircraft profiles are added and new patterns emerge.
> When adding a profile that requires fields not yet in this schema, update this document first,
> then implement support in the validator and calc modules.

| Field | Value |
|-------|-------|
| **Schema version** | 2.0 |
| **Status** | Active — used by validator, merger, migrator |
| **Created** | 2026-03-10 |
| **Last updated** | 2026-03-10 |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Common Patterns](#2-common-patterns)
3. [Top-Level Fields](#3-top-level-fields)
4. [aircraft — Required](#4-aircraft--required)
5. [limits — Required](#5-limits--required)
6. [fuel — Required](#6-fuel--required)
7. [speeds — Required](#7-speeds--required)
8. [weightBalance — Optional](#8-weightbalance--optional)
9. [performance — Optional](#9-performance--optional)
10. [Aircraft Instance Schema](#10-aircraft-instance-schema)
11. [v1 → v2 Migration Mapping](#11-v1--v2-migration-mapping)
12. [Valid Enums](#12-valid-enums)
13. [Changelog](#13-changelog)

---

## 1. Overview

A **type profile** contains the Pilot's Operating Handbook (POH) data for an aircraft make/model. It is shared across all individual airplanes of that type. Instance-specific data (registration, actual empty weight from weigh report) lives in a separate **aircraft instance** object.

### Required vs Optional Sections

| Section | Required? | Rationale |
|---------|-----------|-----------|
| `schemaVersion` | ✅ Required | Identifies schema for validation and migration |
| `aircraft` | ✅ Required | Identity — what aircraft is this? |
| `limits` | ✅ Required | Weight limits, reference empty weight |
| `fuel` | ✅ Required | Fuel system configuration |
| `speeds` | ✅ Required | At minimum Vne and Vs0 for safety |
| `weightBalance` | ⚠️ Optional | Not all aircraft have digitized W&B data |
| `performance` | ⚠️ Optional | Each sub-section independently optional |

When an optional section is absent, the corresponding calculator displays "No [X] data available for this aircraft profile" instead of failing.

---

## 2. Common Patterns

### Data Values in Performance Tables

All values in `table_interpolation` data arrays are **plain numbers**. Units are declared once at the section level in a `units` object, not repeated per data point. This keeps data arrays compact and fast to parse.

```jsonc
{
  "method": "table_interpolation",
  "units": {
    "pressureAltitude": "ft",
    "temperature": "C",
    "groundRoll": "ft",
    "totalOver50ft": "ft"
  },
  "data": [
    { "pressureAltitude": 0, "temperature": 20, "groundRoll": 995, "totalOver50ft": 1690 }
  ]
}
```

> **Note:** The `units` object is descriptive metadata — it documents what unit each field uses
> but is not consumed by the interpolation engine. The engine operates on raw numbers.
> Unit conversion for display is handled by the UI layer.

### ValueWithUnit (for non-interpolation fields only)

The `{ value, unit }` pattern is used for **metadata and limit fields** (not data arrays):

```jsonc
{
  "value": 600,          // number — the numeric value
  "unit": "kg"           // string — the unit
}
```

Used in: `limits.*`, `fuel.capacity`, `referenceConditions.*`, `obstacleHeight`, station `arm` and `maxWeight` fields.

### SpeedValue

A speed with optional description:

```jsonc
{
  "value": 72,
  "unit": "kias",                              // always "kias" for now
  "description": "Best rate of climb"          // optional — for display
}
```

### ReferenceConditions

Describes the conditions under which performance data was measured:

```jsonc
{
  "weight": { "value": 600, "unit": "kg" },   // optional
  "atmosphere": "ISA",                          // optional — typically "ISA"
  "power": "max (5500 RPM)",                   // optional — free text
  "altitude": { "value": 3000, "unit": "ft" }, // optional
  "approachSpeed": { "value": 65, "unit": "kias" } // optional
}
```

All fields are optional. This is descriptive metadata — not used in calculations directly, but displayed in the UI as context.

---

## 3. Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `string` | ✅ | Must be `"2.0"` |
| `source` | `string` | ✅ | `"bundled"` or `"custom"` — set by the app, not authored manually |
| `aircraft` | `object` | ✅ | Aircraft identification — see [Section 4](#4-aircraft--required) |
| `limits` | `object` | ✅ | Weight limits and reference weights — see [Section 5](#5-limits--required) |
| `fuel` | `object` | ✅ | Fuel system configuration — see [Section 6](#6-fuel--required) |
| `speeds` | `object` | ✅ | V-speeds — see [Section 7](#7-speeds--required) |
| `weightBalance` | `object` | ⚠️ Optional | W&B configuration — see [Section 8](#8-weightbalance--optional) |
| `performance` | `object` | ⚠️ Optional | Performance data — see [Section 9](#9-performance--optional) |

**Note:** The `typeId` field is derived from `aircraft.id` and used as the IndexedDB key. It is not a separate top-level field in the JSON file — the app sets it when storing.

---

## 4. aircraft — Required

Aircraft identification and basic specifications.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | `string` | ✅ | URL-safe slug, unique identifier | `"sling-lsa"`, `"cessna-172s"` |
| `name` | `string` | ✅ | Human-readable display name | `"Sling LSA"`, `"Cessna 172S Skyhawk SP"` |
| `manufacturer` | `string` | ✅ | Manufacturer name | `"Sling Aircraft"`, `"Cessna / Textron Aviation"` |
| `icaoType` | `string` | Optional | ICAO type designator | `"C172"`, `"SLSA"` |
| `type` | `string` | ✅ | Aircraft type — see [Valid Enums](#12-valid-enums) | `"single-engine-land"` |
| `category` | `string` | ✅ | Certification category — see [Valid Enums](#12-valid-enums) | `"light-sport"`, `"normal"` |
| `engine` | `string` | Optional | Engine model | `"Rotax 912 iS"` |
| `enginePower` | `object` | Optional | Engine power output | See below |
| `propeller` | `object` | Optional | Propeller details | See below |

### enginePower

```jsonc
{
  "value": 73.5,
  "unit": "kW",       // "kW" or "hp"
  "hp": 100            // optional pre-computed alternate
}
```

### propeller

```jsonc
{
  "type": "fixed-pitch",       // "fixed-pitch" or "constant-speed"
  "manufacturer": "Whirlwind", // optional
  "material": "composite",     // optional
  "blades": 3,                 // optional — number of blades
  "diameter": { "value": 72, "unit": "in" }  // optional
}
```

---

## 5. limits — Required

Weight limits and reference weights. Units should be consistent within this section (all `"kg"` or all `"lbs"`).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `maxTakeoffWeight` | `ValueWithUnit` | ✅ | Maximum takeoff weight (MTOW) |
| `maxLandingWeight` | `ValueWithUnit` | ✅ | Maximum landing weight (often same as MTOW for light aircraft) |
| `referenceEmptyWeight` | `ValueWithUnit` | ✅ | **v2 field** — Typical/POH empty weight. Overridable by aircraft instance. |
| `referenceEmptyCG` | `object` | ✅ | **v2 field** — Typical/POH empty CG. Format depends on `weightBalance.cgReference`. See below. |
| `baggageMaxWeight` | `ValueWithUnit` | Optional | Maximum total baggage weight |
| `maxCrosswind` | `ValueWithUnit` | Optional | Max demonstrated crosswind component |

### referenceEmptyCG

The format depends on the CG reference system used:

**Arm-based CG:**
```jsonc
{ "arm": 40.5, "unit": "in" }
```

**%MAC-based CG:**
```jsonc
{ "value": 23.6, "unit": "percent_mac" }
```

### v1 compatibility note

In v1 profiles, these were:
- `emptyWeight` → renamed to `referenceEmptyWeight`
- `usefulLoad` → **removed** (now computed: `maxTakeoffWeight - effectiveEmptyWeight`)
- `emptyCG` was under `weightBalance` → moved to `limits.referenceEmptyCG`

---

## 6. fuel — Required

Fuel system configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | ✅ | Fuel type ID from built-in registry — see [Valid Enums](#12-valid-enums) |
| `inputUnit` | `string` | ✅ | How the pilot enters fuel — see [Valid Enums](#12-valid-enums) |
| `capacity` | `ValueWithUnit` | ✅ | Total fuel capacity |
| `usableCapacity` | `ValueWithUnit` | Optional | Usable fuel capacity (total minus unusable). If absent, equals `capacity` |
| `tanks` | `Tank[]` | Optional | Individual tank definitions |

### Tank

```jsonc
{
  "name": "Left Wing",
  "capacity": { "value": 75, "unit": "L" }
}
```

---

## 7. speeds — Required

V-speeds from the POH. All values use the `SpeedValue` pattern.

### Required Speeds

| Field | Description | Why Required |
|-------|-------------|--------------|
| `vne` | Never exceed speed | Safety — always shown as a limit |
| `vs0` | Stall speed (landing configuration) | Safety — used in W&B and approach calculations |

### Optional Speeds

| Field | Description | Used By |
|-------|-------------|---------|
| `vx` | Best angle of climb speed | Climb calculator |
| `vy` | Best rate of climb speed | Climb calculator, cruise climb factor |
| `vrot` | Rotation speed | Takeoff display |
| `vlof` | Lift-off speed | Takeoff display |
| `vref` | Reference approach speed | Landing display |
| `vno` | Maximum structural cruising speed | UI warning display |
| `va` | Maneuvering speed | UI display |
| `vfe` | Maximum flap extended speed | UI display |
| `vh` | Maximum level flight speed | Cruise climb factor calculation |
| `vs` | Stall speed (clean configuration) | UI display |
| `vglide` | Best glide speed | Future: emergency planning |
| `vle` | Maximum landing gear extended speed | Retractable gear aircraft |

Additional V-speeds can be added as needed. The validator accepts any key under `speeds` as long as it follows the `SpeedValue` pattern.

---

## 8. weightBalance — Optional

Weight & balance configuration. If absent, the W&B calculator is disabled for this profile.

| Field | Type | Required (if section present) | Description |
|-------|------|-------------------------------|-------------|
| `cgReference` | `string` | ✅ | `"arm"` or `"percent_mac"` |
| `cgUnit` | `string` | ✅ | Display unit for CG — `"in"`, `"mm"`, `"%"` |
| `weightUnit` | `string` | ✅ | Weight unit used in envelope definitions — `"kg"` or `"lbs"` |
| `armUnit` | `string` | Optional | Unit for station arms — `"in"` or `"mm"`. Defaults to same as `cgUnit` |
| `macLeadingEdge` | `ValueWithUnit` | Required if `cgReference` = `"percent_mac"` | Leading edge of MAC |
| `macLength` | `ValueWithUnit` | Required if `cgReference` = `"percent_mac"` | Length of MAC |
| `stations` | `Station[]` | ✅ | Loading stations |
| `envelopes` | `Envelope[]` | ✅ | CG envelopes (at least one) |
| `baggageConstraints` | `BaggageConstraint[]` | Optional | Combined weight limits across stations |

### Station

```jsonc
{
  "id": "pilot",                                // unique identifier
  "name": "Pilot",                              // display name
  "arm": { "value": 1959, "unit": "mm" },       // station arm from datum
  "maxWeight": { "value": 242, "unit": "lbs" }, // or null if no per-station limit
  "fuelStation": true                            // optional — marks the fuel station
}
```

- Exactly one station should have `"fuelStation": true`.
- `maxWeight` can be `null` for stations without per-station limits (e.g., pilot/passenger seats limited only by total weight).

### Envelope

```jsonc
{
  "id": "normal",                    // unique identifier
  "name": "Normal Category",        // display name
  "color": "#22c55e",               // hex color for chart rendering
  "points": [                        // closed polygon (≥ 3 points)
    { "weight": 384, "cg": 20.0 },
    { "weight": 384, "cg": 33.0 },
    { "weight": 600, "cg": 33.0 },
    { "weight": 600, "cg": 20.0 }
  ]
}
```

- `weight` values are in the unit specified by `weightUnit`.
- `cg` values are in the unit specified by `cgUnit` (arm inches, mm, or %MAC).
- Points define a closed polygon — the last point connects back to the first.
- Multiple envelopes supported (e.g., Normal + Utility for Cessna 172).

### BaggageConstraint

```jsonc
{
  "description": "Combined front + rear baggage must not exceed 15 kg",
  "stationIds": ["baggage_front", "baggage_rear"],
  "maxCombinedWeight": { "value": 15, "unit": "kg" }
}
```

---

## 9. performance — Optional

Performance data from the POH. The `performance` object itself is optional, and each sub-section within it is independently optional.

### 9.1 performance.notes — Optional

```jsonc
{
  "general": "Performance data from flight tests...",
  "conditions": "Unless otherwise stated: MTOW, ISA conditions, ..."
}
```

Free-text notes displayed in the UI. All fields optional.

### 9.2 performance.takeoff / performance.landing — Optional

Takeoff and landing data share the same structure. Two methods are supported:

#### Method: `reference_table`

Used when the POH provides distances at a single reference condition with surface-type variants (e.g., Sling LSA).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | `string` | ✅ | `"reference_table"` |
| `description` | `string` | Optional | Free-text description |
| `obstacleHeight` | `ValueWithUnit` | Optional | Obstacle height — ICAO 15 m or FAA 50 ft |
| `referenceConditions` | `ReferenceConditions` | Optional | Conditions under which data was measured |
| `data` | `ReferenceRow[]` | ✅ | Array of surface-type rows |
| `corrections` | `Correction[]` | Optional | Correction factors (wind, slope, weight) |

**ReferenceRow:**
```jsonc
{
  "surface": "concrete_asphalt",                          // unique surface ID
  "surfaceLabel": "Concrete / Asphalt",                   // display label
  "groundRoll": { "value": 120, "unit": "m", "valueFt": 395 },
  "totalOverObstacle": { "value": 230, "unit": "m", "valueFt": 755 }
}
```

#### Method: `table_interpolation`

Used when the POH provides a multi-dimensional table (e.g., altitude × temperature → distances). Typical of Cessna/Piper POHs.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | `string` | ✅ | `"table_interpolation"` |
| `description` | `string` | Optional | Free-text description |
| `obstacleHeight` | `ValueWithUnit` | Optional | Obstacle height |
| `variables` | `string[]` | ✅ | Independent variable keys, e.g. `["pressureAltitude", "temperature"]` |
| `result` | `string[]` | ✅ | Result field keys, e.g. `["groundRoll", "totalOver50ft"]` |
| `referenceConditions` | `ReferenceConditions` | Optional | Conditions |
| `data` | `object[]` | ✅ | Array of data point objects (≥ 2) |
| `corrections` | `Correction[]` | Optional | Correction factors |

**Data point example (takeoff, altitude × temperature):**
```jsonc
{
  "pressureAltitude": 0,
  "temperature": 15,
  "groundRoll": 960,
  "totalOver50ft": 1685
}
```

#### Correction

```jsonc
{
  "type": "headwind",                                     // correction type ID
  "description": "Decrease distances by 10% for each 9 kt headwind",
  "factor": -0.10,                                        // multiplier
  "per": { "value": 9, "unit": "kt" },                   // per-unit basis
  "appliesTo": ["groundRoll", "totalOver50ft"]             // which result fields
}
```

Correction types: `"headwind"`, `"tailwind"`, `"grass_runway"`, `"slope_uphill"`, `"slope_downhill"`, `"weight"`. Additional types can be added.

### 9.3 performance.climb — Optional

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | `string` | ✅ | `"table_interpolation"` |
| `description` | `string` | Optional | Free-text description |
| `variables` | `string[]` | ✅ | e.g. `["pressureAltitude"]` |
| `results` | `string[]` | ✅ | e.g. `["rateOfClimb", "bestClimbSpeed"]` |
| `referenceConditions` | `ReferenceConditions` | Optional | Conditions |
| `data` | `object[]` | ✅ | Array of data points (≥ 2) |

**Data point:**
```jsonc
{
  "pressureAltitude": 0,
  "rateOfClimb": 800,
  "bestClimbSpeed": 72
}
```

### 9.4 performance.cruise — Optional

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | `string` | ✅ | `"table_interpolation"` |
| `description` | `string` | Optional | Free-text description |
| `variables` | `string[]` | ✅ | e.g. `["pressureAltitude", "rpm"]` |
| `results` | `string[]` | ✅ | e.g. `["kias", "ktas"]` |
| `data` | `object[]` | ✅ | Array of data points (≥ 2) |

**Data point:**
```jsonc
{
  "pressureAltitude": 3000,
  "rpm": 5000,
  "kias": 98,
  "ktas": 104
}
```

Note: `pressureAltitude` and `rpm` are plain numbers; units declared at section level.

### 9.5 performance.fuelConsumption — Optional

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | `string` | ✅ | `"table_interpolation"` |
| `description` | `string` | Optional | Free-text description |
| `variables` | `string[]` | ✅ | e.g. `["rpm"]` |
| `results` | `string[]` | ✅ | e.g. `["fuelFlowLph", "fuelFlowGph"]` |
| `referenceConditions` | `ReferenceConditions` | Optional | Altitude and conditions for reference data |
| `data` | `object[]` | ✅ | Array of data points (≥ 2) |

**Data point:**
```jsonc
{
  "rpm": 5000,
  "fuelFlowLph": 18,
  "fuelFlowGph": 4.8,
  "airspeed": 104,
  "enduranceHours": 8,
  "enduranceMinutes": 20,
  "range": 866
}
```

The `airspeed`, `enduranceHours`, `enduranceMinutes`, and `range` fields are optional reference values from the POH. The app recomputes endurance and range from actual fuel on board.

---

## 10. Aircraft Instance Schema

An instance represents a specific airplane in the user's fleet.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `instanceId` | `string` | ✅ | UUID v4 — auto-generated |
| `typeId` | `string` | ✅ | References `aircraft.id` of a type profile |
| `registration` | `string` | ✅ | Tail number / registration (e.g., `"N246LT"`) |
| `displayName` | `string` | Optional | User-editable label. Defaults to `registration` |
| `emptyWeight` | `ValueWithUnit` | Optional | Actual empty weight from weigh report. If absent, type's `referenceEmptyWeight` is used |
| `emptyCG` | `object` | Optional | Actual empty CG from weigh report. If absent, type's `referenceEmptyCG` is used |
| `lastWeighed` | `string` | Optional | ISO 8601 date of last weigh report (e.g., `"2025-11-15"`) |
| `notes` | `string` | Optional | Free-text notes |
| `createdAt` | `string` | ✅ | ISO 8601 timestamp |
| `updatedAt` | `string` | ✅ | ISO 8601 timestamp |

### emptyCG format

Matches the CG reference system of the linked type profile:

- **Arm-based:** `{ "arm": 41.2, "unit": "in" }`
- **%MAC-based:** `{ "value": 23.6, "unit": "percent_mac" }`

---

## 11. v1 → v2 Migration Mapping

| v1 Location | v2 Location | Change |
|-------------|-------------|--------|
| `profileVersion: "1.0"` | `schemaVersion: "2.0"` | Renamed |
| `aircraft.tailNumber` | *(removed from type)* | Moved to instance `registration` |
| `limits.emptyWeight` | `limits.referenceEmptyWeight` | Renamed — now a reference default |
| `limits.usefulLoad` | *(removed)* | Computed at runtime: `MTOW − emptyWeight` |
| `weightBalance.emptyCG` | `limits.referenceEmptyCG` | Moved from W&B to limits |
| *(new)* | `source` | Added — `"bundled"` or `"custom"` |
| *(new)* | `aircraft.icaoType` | Added — optional ICAO designator |

All other fields remain unchanged in structure and location.

---

## 12. Valid Enums

### aircraft.type
`"single-engine-land"`, `"single-engine-sea"`, `"multi-engine-land"`, `"multi-engine-sea"`, `"glider"`, `"rotorcraft"`

### aircraft.category
`"normal"`, `"utility"`, `"acrobatic"`, `"light-sport"`, `"experimental"`, `"primary"`

### fuel.type
`"100LL"`, `"91UL"`, `"94UL"`, `"MOGAS"`, `"JET_A"`, `"DIESEL"`, `"CUSTOM"`

### fuel.inputUnit
`"L"`, `"us_gal"`, `"kg"`, `"lbs"`

### Weight units
`"kg"`, `"lbs"`

### Distance/altitude units
`"ft"`, `"m"`

### Length/arm units
`"in"`, `"mm"`

### Temperature units
`"C"`, `"F"`

### Pressure units
`"inHg"`, `"hPa"`

### Speed units
`"kias"`, `"ktas"`, `"kt"`, `"kmh"`, `"mph"`

### Rate of climb units
`"fpm"` (feet per minute)

### Fuel flow units
Fuel flow fields use fixed naming (`fuelFlowLph`, `fuelFlowGph`) rather than a unit field.

### weightBalance.cgReference
`"arm"`, `"percent_mac"`

### performance method
`"reference_table"`, `"table_interpolation"`

### performance source
`"bundled"`, `"custom"`

---

## 13. Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-10 | 2.0 | Initial v2 schema. Type/instance split. `referenceEmptyWeight`, `referenceEmptyCG` added. `tailNumber`, `usefulLoad` removed from type. `source` field added. |
| 2026-03-11 | 2.0.1 | Standardized `table_interpolation` data format: plain numbers in data arrays, units declared at section level via `units` object. Removed ValueWithUnit pattern from data arrays. Added `units` field to performance sections. Flattened fuel consumption `endurance` from `{hours, minutes}` to `enduranceHours`/`enduranceMinutes` plain fields. |

> **Future additions anticipated:** When adding the Cessna 172S profile, we expect to add or refine:
> - `table_interpolation` data patterns for takeoff/landing (altitude × temperature grids)
> - Multiple W&B envelopes (Normal + Utility categories)
> - Arm-based CG reference system patterns (vs. Sling's %MAC)
> - Possible weight-based correction factors
> - Possible flap-setting variants for takeoff/landing
>
> This document will be updated to reflect those additions.
