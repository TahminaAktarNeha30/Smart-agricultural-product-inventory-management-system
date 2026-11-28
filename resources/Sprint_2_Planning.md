# Sprint 2 Planning

**Course:** CSE451 Software Engineering  
**Project:** Smart Agricultural Product Inventory Management System  
**Sprint Duration:** 2 Weeks  
**Team:** Tahmina Aktar Neha, Maksuratun Rashmi, Maimuna Akter Tripty, Mehnaj Akter

---

## 1. Sprint Goal
Complete advanced business logic (FIFO/FEFO dispatch recommendations, complete distributor order approvals, automated low-stock and expiry alerts) and finalize documentation.

## 2. Scope & User Story Allocation
| Member | Features Planned | User Stories | Target Output |
|---|---|---|---|
| Tahmina Aktar Neha | F1 & F2 Finalization | US-01C, US-02B, US-02C | Search/filter catalog, edge case validation |
| Maksuratun Rashmi | F4 Stock Levels & Batch View | US-04 | Batch inventory view, live stock breakdown table |
| Maimuna Akter Tripty | F6 FIFO / FEFO Engine | US-05B, US-06 | Earliest expiry first (FEFO) recommendation algorithm |
| Mehnaj Akter | F7 Dispatch & F8 Alert System | US-07B to 07F, US-08A, 08B | Multi-role order approval, atomic stock deduction, threshold alerts |

## 3. Definition of Done (DoD)
- Complete end-to-end integration across frontend, controller, service, and database.
- Unit test suite achieving 100% pass across all 8 feature test files.
- GitHub Actions CI pipeline running cleanly on both Node 18 and Node 20.
