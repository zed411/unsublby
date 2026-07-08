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

### Easiest: the single-file build

`standalone.html` bundles the entire app (styles, code, and the PDF.js /
pdf-lib libraries) into one self-contained file. **Just double-click it** — it
opens in your browser and works offline, no server needed. Rebuild it with
`node vendor/build-standalone.js` after changing any source file.

### As a static site

It's also a plain static site — no build step.

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
- Text box, callout (leader + note), stamp (e.g. `APPROVED`), count/tally marker
- Select / move / resize / delete; per-markup color, line weight, fill & font

**Measurement & takeoff**
- Calibrate the drawing scale by drawing a line of known length
- Measure **length** (polyline) and **area** (polygon); labels update live
- Running takeoff totals in the Markups panel

**Assisted auto-takeoff** (Markups panel → Auto-takeoff assist)
- **Analyze** — reports pages, text volume, detected scale, and whether the PDF
  is a scanned image (no text layer → auto tools can't read it)
- **Auto-scale** — detects a `1:NN` ratio in the drawing text and sets the
  measurement calibration for you (verify against a known dimension)
- **Find & count** — type a tag (e.g. `GPO`, `D01`) and it drops a count marker
  on every text match across all pages, tagged for pricing
- These read the PDF's real text layer only — they never invent quantities, and
  everything they place is yours to review before trusting

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

## Estimating (Estimate tab)

Estimating from drawings is fundamentally: **measure quantities → apply unit
rates → total**. Markup Studio now does all three — the Estimate tab holds a
rate library and prices your markups live.

1. **Calibrate** the sheet scale (Calibrate tool → draw a line of known length → enter the real length).
2. **Measure & count:** lengths (runs of pipe, skirting), areas (floor finishes),
   and **count markers** for fixtures (doors, GPOs, downlights). Each markup's
   quantity is: count/shape → 1 `ea`, length → calibrated metres, area → calibrated m².
3. **Tag** each markup with a **Subject** matching a rate's **Code** or **Trade**.
4. Maintain the **Rate Library** (add/edit rates, or **Import**/**Export** CSV with
   columns `Code, Trade, Description, Unit, Rate`).
5. The **Estimate** panel groups priced markups by trade, subtotals each trade,
   and shows a grand total.

### Getting the estimate into Google Sheets

Two one-click paths in the Estimate tab:
- **Copy for Sheets** — copies the estimate as tab-separated text. Open a Google
  Sheet, click cell **A1**, paste — the grid fills in directly, no import step.
- **Export CSV** — download a `.csv`, then in Google Drive: *New → File upload*,
  or in a Sheet: *File → Import → Upload*.

Review the numbers, plug in your real rates, then share the Sheet with your
builder.

Pricing only matches a markup to a rate when their **units are dimensionally
compatible** (count↔`ea`, length↔`m`, area↔`m2`), so a measured length is never
mispriced against an each-rate. Anything tagged but unmatched is listed as
*Unpriced* with the reason.

### Where do the rates come from?

The rates are **yours**. The library ships with clearly-labelled `(SAMPLE)`
placeholder numbers — replace them with your own.

Commercial cost-book publishers (Rawlhouse, Rawlinsons, CoreLogic/Cordell, etc.)
sell **licensed** rate data; that data is their copyright and is not bundled
here. If you subscribe to one, export/enter those rates into the library
yourself. To build rates from first principles, each unit rate is a **build-up**:

```
unit rate = material (incl. waste %) + labour (hours × crew $/hr)
          + plant/equipment + subcontractor + margin/overhead %
```

e.g. a metre of skirting = board $/m (＋ ~10% waste) + fixer minutes × $/hr +
fixings + adhesive + your margin. That build-up, applied to the quantities this
tool measures, is the estimate — the same measured-quantity method used across
the construction estimating industry.

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
  js/pricing.js       # rate library + live cost estimate rollup + Sheets copy
  js/analyze.js       # assisted auto-takeoff (scale detect, find & count)
  js/export.js        # .mstudio save/load + flattened PDF export
  js/main.js          # bootstrap + UI wiring
```
