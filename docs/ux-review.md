# UI/UX review — roomly

Independent training mode; functional training behavior and storage keys are unchanged. Entry: home banner → ux.html.

## Scenario
A new employee is moving through the office at 12:50 on 2026-11-10. Book a room for four people with a monitor from 13:00 for 30 minutes, and find where to go.

## Authored learning objectives
Before submission, only the task and the service are shown. Seeded UX issues: missing equipment/location from list; lost search conditions on return from details; ambiguous confirmation action and incomplete completion context. After one written observation, learners select improvement proposals and see the rationale, user impact and acceptance conditions. Only the three selection answers are scored; written findings are not classified as correct/incorrect. After grading, the same live service supports toggling before/after behavior.

## Scope and data
Three illustrated rooms; availability is fixed exercise data (Birch unavailable), not a general calendar engine. One active reservation; cancel it from My reservations before booking another. Photos are separately generated room illustrations. No real bookings or server-side authentication. Notes, actions, booking, answers and progress persist under qa-dojo:ux-review:meeting:v1. Source code includes answers as expected for a public frontend exercise.

## Verification
- 15 Node tests passed: existing 12 functional regressions plus UX submission gating/storage independence, reservation/lossy back behavior, deterministic grading/escaped user text, improved filter persistence.
- Browser: brief → list → search for 13:00 / 4 people → Aspen detail → booking confirmation → note modal → written observation save → submit → all 3 correct choices → 3/3 result → improved service → before/after toggle.
- Desktop visual inspection at 1348×926; photograph cards, service navigation, details and review UI inspected. Screenshot: docs/design/ux-roomly.jpg.
- Mobile: 390×844 iframe, 375px content after browser scrollbar. Search form and stacked cards inspected, no horizontal body overflow; all images loaded. Physical iOS not tested.
- No application console errors. Syntax checks and git diff --check passed.
