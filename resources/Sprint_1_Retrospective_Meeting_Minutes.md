# Sprint 1 Retrospective Meeting Minutes

**Course:** CSE451 Software Engineering  
**Project:** Smart Agricultural Product Inventory Management System  
**Date:** End of Sprint 1  
**Attendees:** Tahmina Aktar Neha, Maksuratun Rashmi, Maimuna Akter Tripty, Mehnaj Akter

---

## 1. What Went Well
- Layered architecture with strict separation between `controllers`, `services`, and `dal` repository worked smoothly.
- Test coverage for F1, F2, and Auth reached above 85%.
- Single Page Application (SPA) structure in `public/` simplified client-side state handling.

## 2. What Could Be Improved
- Date handling between client browser time and Bangladesh Standard Time caused early inconsistencies in expiry calculations.
- Branch merge conflicts occurred when multiple members modified `data/db.json` directly.

## 3. Action Items for Sprint 2
- Centralize all date and expiry logic into `config/constants.js` helper functions (`getBangladeshDateString`).
- Use `scripts/resetDemoData.js` to ensure uniform seed data and prevent manual JSON tampering.
- Proceed to complex domain logic: FIFO/FEFO suggestions, order dispatch, and alert thresholds.
