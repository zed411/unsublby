# Markup Studio

A self-contained, browser-based **PDF markup and takeoff** tool — an original,
open implementation of the core workflow that commercial tools like Bluebeam
Revu provide: render a PDF, mark it up, measure quantities, track every markup,
and run repeatable custom workflows.

No proprietary code is copied here. Rendering uses the open-source
[PDF.js](https://mozilla.github.io/pdf.js/) engine and PDF export uses
[pdf-lib](https://pdf-lib.js.org/) — both are vendored into `lib/` so the app
runs fully offline. All markup, measurement, workflow and estimating logic is
written from scratch in this repo.

## Run it

It's a static site — no build step.

```bash
cd markup-studio
python3 -m http.server 8080
# open http://localhost:8080
```

Or open `index.html` through any static host. Everything needed (PDF.js and
pdf-lib) is vendored under `lib/`, so no network connection is required. Serve
it over `http(s)://` rather than `file://` so the PDF.js web worker can load.

## What it does

**Markup tools** (left rail)
- Rectangle, ellipse, revision cloud, line, arrow, freehand ink, highlight
- Text box, callout (leader + note), stamp (e.g. `APPROVED`)
- Select / move / resize / delete; per-markup color, line weight, fill & font

**Measurement & takeoff**
- Calibrate the drawing scale by drawing a line of known length
- Measure **length** (polyline) and **area** (polygon); labels update live
- Running takeoff totals in the Markups panel

**Markups list**
- Every markup tracked with page, type, subject, author and status
  (open / accepted / rejected / completed — right-click a row to cycle)
- Filter by status; export the whole list to **CSV**

**Custom workflows** (right panel → Workflows tab)
- **Tool chest** presets: save a tool + color + weight + subject and reapply in one click
- **Checklist** with progress bar for a repeatable review process
- Save named **workflows** (presets + checklist) and reload them on any drawing

**Save / export**
- **Save** a `.mstudio` project file (markups + calibration) and **Load** it back
- **Export PDF** flattens all markups into a new PDF you can share

## Keyboard shortcuts

| Key | Tool | Key | Action |
|-----|------|-----|--------|
| `V` | Select | `Delete` | Remove selected |
| `R` | Rectangle | `Esc` | Deselect / cancel polygon |
| `O` | Ellipse | `Enter` | Finish polygon |
| `L` / `A` | Line / Arrow | `+` / `-` | Zoom |
| `P` | Freehand | `Ctrl/Cmd+S` | Save project |
| `C` | Cloud | | |
| `T` / `K` | Text / Callout | | |
| `H` | Highlight | | |
| `M` | Measure length | | |

## Using it for estimating (quantity takeoff)

Estimating from drawings is fundamentally: **measure quantities → apply unit
rates → total**. Markup Studio produces the measured quantities; the CSV export
is the takeoff sheet an estimator applies rates to.

1. **Calibrate** the sheet scale (Calibrate tool → draw a line of known length → enter the real length).
2. **Count** items with the stamp/rectangle tools, **measure lengths** (e.g. runs of pipe, skirting) and **areas** (e.g. floor finishes) with the measure tools.
3 Use the **Subject** field to tag each markup with a trade or cost code (e.g. `Concrete`, `Electrical`).
4. **Export CSV** — you get one row per markup with its quantity and unit.
5. In a spreadsheet, add a **Rate** column and `Quantity × Rate` for line totals,
   then subtotal by Subject. That grouped, rated takeoff is the estimate.

This mirrors the standard measured-quantity method used across the construction
estimating industry; the numbers come from your own drawings and your own rates.

## File layout

```
markup-studio/
  index.html          # app shell
  css/styles.css
  js/state.js         # shared state, constants, helpers
  js/viewer.js        # PDF.js rendering + coordinate transforms
  js/annotations.js   # markup model + SVG rendering / selection
  js/tools.js         # tool rail + pointer interaction
  js/markuplist.js    # markups list, filtering, CSV, takeoff totals
  js/workflows.js     # presets, checklist, saved workflows
  js/export.js        # .mstudio save/load + flattened PDF export
  js/main.js          # bootstrap + UI wiring
```
