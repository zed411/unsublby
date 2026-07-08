---
name: estimate
description: Run a full concreting quantity-takeoff and cost estimate from a construction drawing PDF, priced from the 1CON schedule of rates. Use when the user drops a project/drawing PDF and asks for markups, a takeoff, or an estimate (e.g. "estimate this", "do the takeoff", "price this job"). Produces a marked-up PDF, an editable .mstudio project, and a build-up estimate CSV ready for Google Sheets.
---

# Estimating skill (1CON Group — concrete structures & civil)

Turn a drawing set into a reviewable estimate: **scan → identify scope →
measure → mark up → price from the rate schedule → deliver for review**.
Never fabricate a quantity: every number must trace to a drawing dimension,
a measured zone, or be flagged TBC/allowance.

## Tooling (in `markup-studio/vendor/`, run with node)

| Step | Command |
|---|---|
| Dump text layer of every page | `MS_PDF=<pdf> node scan.js` → `doc-text.json` |
| Render a full sheet to PNG | `MS_PDF=<pdf> node canvas-dump.js <page> <scale>` |
| Zoom a region (pt coords) | `MS_PDF=<pdf> node zoom.js <page> <x> <y> <w> <h> <scale> <name>` |
| Verify project + estimate | `MS_PDF=<pdf> MS_PROJECT=<mstudio> node verify-takeoff.js` |
| Burn markups into PDF copy | `MS_PDF=<pdf> MS_PROJECT=<mstudio> MS_OUT=<out> node flatten.js` |

pdf-lib and pdfjs-dist are vendored in `markup-studio/vendor/node_modules`.

## Workflow

1. **Scan the whole set.** Run scan.js; confirm true page count with pdf-lib.
   Grep the text JSON for scope keywords: `concret|slab|footing|pier|screed|
   plinth|hob|topping|insitu|blockwork|kerb|ramp|pool|paving|mesh|reo|N32`.
   List every sheet number + title. Never make the user look through sheets.
2. **Identify scope sheets.** Plans (new works, site/areas, demolition) give
   zones and counts; detail sheets (1:50/1:100) give real dimensions — prefer
   printed dimensions over measured ones every time.
3. **Establish scale per sheet.** Title block states it (e.g. `1:200@A3`).
   A3 landscape = 1191×842 pt; at 1:200 → 1 pt = 70.56 mm. Distrust any
   ratio that is part of a longer number (grid refs like "1:10,890"); only
   accept standard scales (1:20/50/100/200/250/500). N.T.S. sheets: use
   printed dimensions only.
4. **Measure.** Render sheets via canvas-dump (2 px/pt exact) and measure
   zone extents; cross-check against the sheet's own text-label positions.
   Counts come from the text layer (tag positions), not eyeballing.
5. **Mark up.** Generate a `.mstudio` project: area polygons for zones,
   count markers at label positions, calibration set for the primary plan
   sheet (note it's valid for that sheet only). Author = "Claude
   (auto-takeoff)", comment = "AUTO — verify". Verify with verify-takeoff.js
   (expect 0 errors), then flatten.js for the send-to-builder copy.
6. **Price from the rate schedule** (`rates-1con.csv` beside this file; if
   the user supplies a newer schedule, use that and update the CSV):
   - Build up per element: supply m³ (+5% waste) / place / mesh or reo /
     formwork / curing / joints / testing — as separate lines.
   - Supply lines marked "(if quoted)" — schedule terms say concrete & reo
     are free-issued by others unless quoted.
   - **Pump is consolidated**, not per-element: visits × (4 hr min hire +
     1 hr travel) + line m³ + slurry + washout. Recommend combining pours.
   - Labour-only scopes (make-good, prep) = crew hours × labour rate, marked
     ALLOWANCE.
   - Out-of-schedule trades (pool finishes, blockwork, screed materials,
     waterproofing) → EXCLUDED / BY OTHERS section, never silently dropped.
   - All rates ex GST; show subtotal, GST 10%, total inc GST.
7. **Assumptions register.** Every assumed thickness/width/extent gets a
   line: what was assumed, why, and the cost sensitivity (e.g. "+25 mm on
   376 m² ≈ +9.9 m³"). Structural items without structural drawings are
   excluded, stated.
8. **Deliver.** Send the user: flattened marked PDF, `.mstudio` project,
   estimate CSV (Google-Sheets-ready). Client drawings, projects and
   estimates are NEVER committed to the repo — deliver via chat only.

## Default technical assumptions (state them, don't hide them)

- Topping slabs 75 mm avg N32 unless stated; external SOG place rate.
- Mesh SL82 supply+install for slabs; bench seats ~60 kg/m³ reo install.
- Bench seating 600 deep × ~450 high; formwork = both faces measured.
- Demolition priced from plant+labour schedule only as PROVISIONAL with a
  stated crew/duration build-up, pending site walk.

## Review gates (do not skip)

- [ ] Every big-dollar zone eyeballed against the rendered sheet
- [ ] Scale sanity-checked against a known printed dimension
- [ ] verify-takeoff.js run: markups load, estimate computes, 0 errors
- [ ] TBC/assumption lines flagged in the CSV, exclusions listed
- [ ] User told the two or three numbers most worth double-checking
