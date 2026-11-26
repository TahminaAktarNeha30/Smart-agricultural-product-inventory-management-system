## 4. Architectural Pattern

### 4.1 Selected Architectural Pattern

The Smart Agricultural Product Inventory Management System uses a **layered architecture**
implemented with **Node.js, Express and JavaScript**. The application is split into four layers.
Each layer has one job and only talks to the layer directly below it.

### 4.2 Architectural Structure (as implemented)

| Layer | Folder / files | Responsibility |
|---|---|---|
| **Presentation** | `public/` (`index.html`, `css/style.css`, `js/*.js`) | Login screen, forms, tables, alerts. Sends requests to the API with the login token. |
| **Request handling** | `src/routes/apiRoutes.js`, `src/middleware/auth.js`, `src/controllers/` | Maps URLs to controllers, checks the login (`authenticate`) and the role (`requireRole`), calls a service, returns JSON. |
| **Business logic** | `src/services/` | All inventory rules: quantity and expiry checks, FIFO/FEFO ranking, order status changes, atomic dispatch, alert rules, login. |
| **Data access** | `src/dal/` (`database.js` + repositories) | The only code that reads/writes `data/db.json`. Provides all-or-nothing transactions and a daily backup. |

`config/constants.js` holds shared values (roles, order statuses, Bangladesh-date and expiry helpers).
Persistent storage is a JSON file, chosen for simplicity; the SRS does not name a database.

### 4.3 Rationale

- **Separation of responsibilities:** receiving, usage, wastage and dispatch each have their own service, so interface code never contains inventory rules.
- **Consistent business rules:** the same expiry and quantity checks are used by usage, wastage, ordering and dispatch because they live in one layer.
- **Testability:** services can be tested without the browser (`tests/unit/`, run with `npm test`).
- **Team collaboration:** four members work on different features that share the same structure and conventions.
- **Reliable stock updates:** `database.executeTransaction()` saves several changes together or not at all, which supports "stock must not become negative" and "no partial dispatch".
- **Security:** login with hashed passwords, token sessions, and role checks on the server (not only in the menu).

### 4.4 Request flow example: Dispatch Order

`dispatch.js` (browser) → `POST /api/orders/:id/dispatch` → `authenticate` + `requireRole(Warehouse Officer)` →
`orderController.dispatchOrder` → `orderService.dispatchOrder` (status, expiry, stock, all-lines-or-none) →
`database.executeTransaction` → `data/db.json`.

### 4.5 Feature to module mapping

| Feature | Main service |
|---|---|
| F1 Item catalog | `itemService.js` |
| F2 Warehouses and suppliers | `warehouseService.js`, `supplierService.js` |
| F3 Stock receiving, F4 Stock view, F5 Usage and wastage | `stockService.js` |
| F6 FIFO/FEFO suggestions | `suggestionService.js` |
| F7 Orders and dispatch | `orderService.js` |
| F8 Alerts | `alertService.js` |
| Login / Logout (added) | `authService.js` |
