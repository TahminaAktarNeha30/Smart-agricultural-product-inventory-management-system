# CI/CD Pipeline Report

**Course:** CSE451 Software Engineering  
**Project:** Smart Agricultural Product Inventory Management System  
**Institution:** Independent University, Bangladesh (IUB)

---

## 1. Overview
The Continuous Integration (CI) pipeline is configured via **GitHub Actions** located at `.github/workflows/ci.yml`. It triggers automatically on every push and pull request targeted at the `main` and `develop` branches.

## 2. Pipeline Architecture
```
GitHub Push / Pull Request (develop / main)
                 │
                 ▼
       GitHub Actions Runner
                 │
        ┌────────┴────────┐
        ▼                 ▼
 Node.js 18.x       Node.js 20.x
        │                 │
        ├─ npm ci         ├─ npm ci
        ├─ ESLint check   ├─ ESLint check
        └─ Jest unit test └─ Jest unit test (111 tests + coverage)
```

## 3. Stages & Tasks
1. **Repository Checkout:** Uses `actions/checkout@v4` to retrieve the codebase.
2. **Node.js Setup:** Uses `actions/setup-node@v4` with automatic npm dependency caching.
3. **Dependency Installation:** Runs `npm ci` for fast, reproducible dependency trees from `package-lock.json`.
4. **Code Quality (Linting):** Runs `npm run lint` with ESLint to guarantee code style compliance.
5. **Automated Testing:** Runs `npm test` executing Jest across 8 test suites, ensuring 100% of the 111 unit tests pass and code coverage thresholds are met.
