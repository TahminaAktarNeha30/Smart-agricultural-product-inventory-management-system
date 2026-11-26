# Coding Conventions and Guidelines

**Course:** CSE451 Software Engineering  
**Project:** Smart Agricultural Product Inventory Management System  
**Institution:** Independent University, Bangladesh (IUB)

---

## 1. Code Style and Formatting
- **Standard:** ECMAScript 2022+ JavaScript standards enforced via **ESLint 9**.
- **Indentation:** 2 spaces (no tabs).
- **Naming Conventions:**
  - Files: `camelCase.js` for controllers, services, repositories (e.g. `stockService.js`, `itemController.js`).
  - Variables & Functions: `camelCase` (e.g. `receiveStock`, `batchNumber`).
  - Classes & Constants: `PascalCase` for classes / models, `UPPER_SNAKE_CASE` for system constants (e.g. `ROLES.OFFICER`, `ORDER_STATUS.APPROVED`).
- **Semicolons:** Always required at the end of statements.
- **Quotes:** Single quotes `'...'` for strings, backticks `` `...` `` for template strings.

---

## 2. Layered Architecture Separation
1. **Controllers (`src/controllers/`):**
   - Only handle HTTP request/response extraction, role authorization, and parameter validation.
   - Must delegate all business logic to service layer.
2. **Services (`src/services/`):**
   - Core domain logic and business rule validation (e.g. FIFO/FEFO sorting, stock deductions, expiry validations).
   - Never interact directly with files or database; only call data access repositories.
3. **Data Access Layer (`src/dal/`):**
   - Sole authority to read and write database entities in `data/db.json`.
   - Encapsulate atomic operations and transaction rollback.

---

## 3. Git Commit Conventions
Follow the Conventional Commits specification:
- `feat(scope): ...` for new user stories and features
- `fix(scope): ...` for bug fixes and patches
- `test(scope): ...` for adding or improving unit tests
- `docs(scope): ...` for documentation and report updates
- `refactor(scope): ...` for code improvements without behavior change
