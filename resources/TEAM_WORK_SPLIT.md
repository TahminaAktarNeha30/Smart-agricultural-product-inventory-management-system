# Team Work Split: 2 features per member

The SRS has 8 features. Each member owns 2 features **end to end**: backend (service, controller,
repository, route), frontend (JS + HTML section), unit tests, and the matching report parts.
Members can swap, but keep the "2 features each" rule.

| Member | Features | SRS user stories |
|---|---|---|
| **Member 1** (Tahmina Aktar Neha) | **F1 Item Catalog** + **F2 Warehouses and Suppliers** | US-01A, 01B, 01C, 02A, 02B, 02C |
| **Member 2** (Maksuratun Rashmi) | **F3 Stock Receiving** + **F4 Stock Levels and Batch View** (+ shared Login/Logout) | US-03, US-04 |
| **Member 3** (Maimuna Akter Tripty) | **F5 Usage and Wastage** + **F6 FIFO/FEFO Suggestions** | US-05A, 05B, 06 |
| **Member 4** (Mehnaj Akter) | **F7 Distributor Orders and Dispatch** + **F8 Alerts** | US-7A to 7F, 8A, 8B |

Member 4 has the most user stories, so Member 2 also owns Login/Logout (a small, shared feature).

## Where each feature lives

| Feature | Backend files (`src/`) | Frontend (`public/`) | Tests (`tests/unit/`) |
|---|---|---|---|
| F1 Item Catalog | `controllers/itemController.js`, `services/itemService.js`, `dal/itemRepository.js` | `js/catalog.js` (items part), section `#item-catalog-sec` | `catalogService.test.js` (Item part) |
| F2 Warehouses and Suppliers | `warehouse*` and `supplier*` in controllers, services, dal | `js/catalog.js` (warehouse/supplier part), `#warehouse-supplier-sec` | `catalogService.test.js` (Warehouse, Supplier parts) |
| F3 Stock Receiving | `stockController.receiveStock`, `stockService.receiveStock`, `dal/batchRepository.js`, `dal/transactionRepository.js` | `js/inventory.js` (receiving form), `#receive-stock-sec` | `stockService.test.js` (Feature 3) |
| F4 Stock View | `stockController.getStockOverview`, `stockService.getStockOverview` | `js/inventory.js` (stock table), `#stock-view-sec` | `stockService.test.js` (Feature 4) |
| F5 Usage and Wastage | `stockService.recordUsage`, `stockService.recordWastage` | `js/inventory.js` (usage and wastage modals) | `stockService.test.js` (Feature 5) |
| F6 FIFO/FEFO | `services/suggestionService.js`, `stockController.getBatchSuggestions` | `js/dispatch.js` (suggestion breakdown) | `suggestionService.test.js` |
| F7 Orders and Dispatch | `controllers/orderController.js`, `services/orderService.js`, `dal/orderRepository.js` | `js/distributor.js`, `js/dispatch.js`, sections `#dispatch-sec`, distributor sections | `orderService.test.js` |
| F8 Alerts | `controllers/alertController.js`, `services/alertService.js` | `js/alerts.js`, `#alerts-sec` | `alertService.test.js` |
| Login / Logout | `controllers/authController.js`, `services/authService.js`, `dal/userRepository.js`, `middleware/auth.js` | `js/app.js` (login part), login screen in `index.html` | `authService.test.js`, `api.test.js` |

## Diagrams per member

- **Use case diagram:** each member explains the use cases of their features.
- **State diagram:** Member 1 explains **Item** and **Supplier** states, Member 2 the **Batch** states,
  Member 4 the **Order** states.
- **DFD:** Member 1 explains item/warehouse/supplier details flows, Member 2 stock records and
  stock levels, Member 3 batch suggestions and selected batch, Member 4 order requests/decisions/status and alerts.

## How to explain your part to the faculty (use this order)

1. "My feature is ... (user story)."
2. Open the page in the browser and do the normal case, then one error case (for example empty unit).
3. Open the service file: "All the **rules** are in this method" (point to the SRS acceptance criteria in the comments).
4. Open the controller/route: "It only receives the request, checks the role and calls the service."
5. Open the repository/`database.js`: "This is the only place that reads and writes `db.json`."
6. Run `npm test` and show your tests: one normal, one boundary, one invalid, one exceptional.

## Git rules for the Git-evidence section

- Branches: `main`, `develop`, and one branch per person, for example `feature/member1-catalog`.
- Commit messages such as `feat(catalog): reject empty unit`, `test(stock): add boundary test`.
- Open a pull request for each feature and have a teammate review it before merging into `develop`.
- Every member must commit under their own name (`git config user.name "Your Name"`).
