# Sprint 2 Retrospective Meeting Minutes

**Course:** CSE451 Software Engineering  
**Project:** Smart Agricultural Product Inventory Management System  
**Date:** End of Sprint 2  
**Attendees:** Tahmina Aktar Neha, Maksuratun Rashmi, Maimuna Akter Tripty, Mehnaj Akter

---

## 1. What Went Well
- All 111 unit tests passing consistently across local environments and GitHub Actions CI.
- The FIFO/FEFO recommendation engine correctly prioritizes earliest expiring batches and handles partial stock fulfillment without negative quantities.
- Demo accounts with role auto-login enabled rapid demonstration of Farm Manager, Warehouse Officer, and Distributor workflows.

## 2. Lessons Learned
- Atomic transactional writes in `src/dal/database.js` prevented partial writes and race conditions during order dispatches.
- Strict code reviews on PRs prevented regression in business rules.

## 3. Conclusion & Delivery
- All 8 user story feature groups fully implemented and verified.
- Repository documentation, API docs (JSDoc), TDD report, and CI/CD pipelines verified for final presentation.
