# QA道場 visual mission gallery — design QA

final result: passed

## Visual evidence

- Selected visual truth: `docs/design/selected-concept.webp` (first displayed concept, selected by user).
- Browser-rendered desktop implementation: `docs/design/home-desktop.jpg`.
- Browser-rendered mobile implementation: `docs/design/home-mobile.jpg`.
- Full-view comparison input: `docs/design/comparison.jpg` (source and implementation together).
- Focused controls comparison: `docs/design/controls-comparison.jpg`.
- State: checkout selected, test-design mode, no saved design-mode records, home.
- Source pixels: 1487 × 1058 (generated design, not a CSS-accurate browser capture).
- Desktop browser pixels/CSS viewport: 1348 × 926, density 1.
- Comparison normalization: both full frames resized proportionally to 900px wide, with no distortion; differences in responsive viewport/aspect ratio were excluded from pixel-accuracy claims. A requested full-page capture of a 1487 × 1058 iframe timed out; final review uses the actual desktop viewport and responsive layout rather than claiming a pixel-identical match.
- Mobile: a real 390 × 844 iframe viewport, 375px content width after its desktop scrollbar, density 1. `home-mobile.jpg` includes the QA wrapper; app-owned content occupies x24–414/y24–868. No body overflow (clientWidth = scrollWidth = 375). Start button bottom = 838.92 within the 844px iframe.

## Findings and comparison history

1. [P2, fixed] Initial desktop card/header density pushed the primary action below the viewport. Reduced preview height and header spacing, preserved a partially visible next tile, compacted home topbar. Final desktop evidence shows the complete start action, gallery, modes and flow.
2. [P2, fixed] Initial mobile layout placed start at y849–905 in an 844px viewport. Reduced mobile header, preview and inter-section spacing. Final mobile evidence and DOM measurement show the entire button at or above y839.
3. [P2, fixed] Existing sidebar occupied excessive horizontal space relative to the selected concept. Matched the desktop sidebar to 16.7vw with safe bounds. Final comparison shows the intended navy rail / light main-surface proportions.
4. No remaining actionable P0/P1/P2 findings in the implemented home flow.

## Required fidelity surfaces

- Fonts/typography: existing DM Sans / Noto Sans JP preserved with system fallback; bold Japanese headline and concise labels follow the concept. Thumbnail text is decorative raster content, not the source of specifications. Mode labels, title, launch action and flow checked in the focused comparison. Small supporting text intentionally stays secondary.
- Spacing/layout: horizontal gallery, three visible tiles plus next-app affordance, mode selector, four-step flow and central primary action match the selected hierarchy. Mobile uses a horizontally scrollable gallery and stacked mode selector. Browser screenshot evidence confirms primary action visibility at the checked sizes.
- Colors/tokens: existing navy #101b31 and mint family retained, selected outline and tinted selected surface clear; pale landscape backdrop and restrained separators follow the reference.
- Images/icons: generated landscape and five separate raster application previews are optimized to WebP (~200KB total assets including locally bundled icons). Source favicon supplies the existing brand mark; Tabler outline icons are licensed in `assets/icons/LICENSE`. No handcrafted icon or raster-asset substitutes. Product was corrected from the mock's shoe to the actual coffee exercise; search/expense previews reflect existing app categories rather than the mock's invented travel search.
- Copy/content: preserves actual five applications, two modes, existing Japanese product terminology and data separation. Primary action becomes resume when work exists; this replaces the reference's redundant separate continue action. Explanations and detailed scores remain behind the existing closed disclosure. No AI judging, new scoring rules or revealed bug answers.

## Browser interactions tested

- App selection changes selected styling, URL, selected title and mode links (booking and expense).
- Mode selection preserves app and switches the visible workflow between four/three steps.
- Carousel next control moves the mobile gallery (scrollLeft 300, clientWidth 345); last app can be selected.
- Checkout exploration: start → specification → operate → calculate → home shows 50% progress and resume → resume returns to operation step with its log.
- Existing design gate and all five exercises/both modes verified by the regression suite.
- All rendered images loaded (`document.images` had no failed/incomplete entries).
- Browser logs checked: no application errors. Browser-extension metadata errors were excluded as unrelated to the app.
- Static validation: `node --check app.js`, `node --check scenarios.js`, all 12 tests passed, `git diff --check` clean.

## Follow-up polish / limits

- P3: generated thumbnail labels differ from exact mock-app controls; actual specifications remain authoritative inside each exercise. Thumbnails are explicitly described as screen illustrations in the README.
- The desktop source is a generated concept, so exact pixel matching is not claimed. Mobile has no separate supplied visual target; checked for responsive usability.
- Physical iOS touch gestures and device text rendering were not tested; mobile layout was exercised in a browser iframe.

## Implementation checklist

- [x] Preserve all existing exercises, scoring and storage keys.
- [x] Implement selected gallery, modes, progress and start/resume interactions.
- [x] Add optimized real image assets and locally licensed icons.
- [x] Resolve desktop/mobile primary-action visibility findings.
- [x] Compare full view and focused controls, inspect browser errors, run regression tests.

## Training flow follow-up (2026-10-27)

User identified the home/training experience gap. Updated all four shared training stages: compact consistent title, sticky progress navigation, icon-led task heading, requirement disclosures, in-place specification reference, category buttons on design/report, quieter contextual tips, and restyled mock applications / activity log. Existing scenario logic and intentional defects are unchanged.

Browser checks at 1348 × 926: requirement cards and contextual hints render; exploration start/resume reaches operation; calculation still records the intentional boundary defect; activity log opens after recording; reporting category button sets the form select; typed report title survives opening/closing specification reference. No app console errors. Browser screenshot: `docs/design/training-report.jpg` (reporting, shipping category selected, typed title). All 12 regression tests pass across five applications and both modes. Desktop inspected visually; mobile styling included but this follow-up has not been checked on physical iOS hardware. The approved first concept remains the visual-system reference, rather than a separate pixel-exact target for every training stage.

final result: passed
