# Code Review Tools and Findings

**Project:** Smart Agricultural Product Inventory Management System  
**Review date:** 26 November 2026  
**Scope:** Static analysis, automated tests, and test coverage

## Tools used

- **ESLint 9** checks JavaScript against the rules in `eslint.config.js`. The project runs it with `npm run lint`, and `.github/workflows/ci.yml` runs the same command for pushes and pull requests to `main` and `develop`.
- **Jest 29** runs unit and API tests. `npm test` also produces a coverage report for `src/**/*.js` and `config/**/*.js`.
- **VS Code** was used to inspect the repository and display command output. It is the editor, not the source of the reported static-analysis findings.

## Review results

The checks were run after installing the dependencies from the existing lockfile with `npm ci`.

- ESLint completed with **0 errors and 3 warnings**.
- Jest completed with **8 passing suites and 111 passing tests**.
- Overall coverage was **70.89% statements, 67.32% branches, 65.70% functions, and 73.50% lines**.

Passing tests do not mean every code path is covered. Coverage findings below are testing risks, not confirmed functional bugs.

## Findings

### 1. Unused repository import in the order service

**Finding:** ESLint `no-unused-vars` reports `warehouseRepository` as assigned but never used in `src/services/orderService.js` (line 8).  
**Why it matters:** Dead imports add noise and can mislead readers into thinking warehouse data is part of the service's current logic.  
**Suggested correction:** Remove the unused import if it is not needed, then rerun lint and tests. No source correction was made as part of this review.

### 2. Unused transaction repository import in the stock service

**Finding:** ESLint `no-unused-vars` reports `transactionRepository` as assigned but never used in `src/services/stockService.js` (line 9).  
**Why it matters:** The unused dependency makes the service's actual data-access dependencies less clear.  
**Suggested correction:** Remove the import if it is obsolete, then rerun lint and tests. No source correction was made as part of this review.

### 3. Unused date helper import in the stock service

**Finding:** ESLint `no-unused-vars` reports `getBangladeshDateString` as assigned but never used in `src/services/stockService.js` (line 10).  
**Why it matters:** This is another dead import; it may indicate stale code or an unfinished implementation.  
**Suggested correction:** Remove the name from the destructured import if it is not required, then rerun lint and tests. No source correction was made as part of this review.

### 4. Low controller test coverage

**Finding:** Jest reports **29.44% statement coverage** and **14.28% branch coverage** for `src/controllers`. Several controller files have little covered code; for example, `itemController.js` is at 7.69% statements and `supplierController.js` at 6.45%.  
**Why it matters:** Many request-handling paths are not exercised by the current suite, so regressions in validation and response handling could go unnoticed.  
**Suggested correction:** Add focused controller/API tests for success, validation failure, missing records, and authorization responses. The existing suite passes, but this coverage gap remains.

### 5. Low supplier-service test coverage

**Finding:** Jest reports **41.02% statement coverage** and **20% branch coverage** for `src/services/supplierService.js`.  
**Why it matters:** The service's branches have limited automated verification, leaving changes to supplier behavior at greater regression risk.  
**Suggested correction:** Add unit tests for the service's main operations and their validation/error branches. The existing suite passes, but this coverage gap remains.

### 6. Low transaction-repository test coverage

**Finding:** Jest reports **37.5% statement coverage** and **25% branch coverage** for `src/dal/transactionRepository.js`.  
**Why it matters:** Data-access behavior has relatively little test evidence compared with the importance of transaction records to inventory history.  
**Suggested correction:** Add tests for repository operations, including empty and populated data cases. The existing suite passes, but this coverage gap remains.

## Corrective-action summary

No application source code was changed during this review. The three ESLint findings are small cleanup candidates. The remaining findings are coverage gaps; they should be addressed with targeted tests rather than treated as proven runtime defects. After changes, run `npm run lint` and `npm test` again and compare the results.

## Screenshot evidence

**The report still needs the original PNG evidence files inserted before submission.** No screenshots have been fabricated or added here. The VS Code screen was observed with the Copilot Chat pane hidden; the image capture interface does not provide a way to save that image into the project folder.

Capture and save these genuine VS Code screenshots using Windows Snipping Tool or **Win+Shift+S**:

1. **Figure 1 — ESLint findings:** Close the Copilot Chat/secondary sidebar, open the integrated terminal at the project root, and run `npm run lint`. Capture the terminal showing the three warnings and `0 errors, 3 warnings`.
2. **Figure 2 — Jest test and coverage results:** Run `npm test -- --runInBand`. Capture the output showing the passing suites/tests and the coverage rows for `src/controllers`, `src/services/supplierService.js`, and `src/dal/transactionRepository.js`. If the full table does not fit, take a second screenshot with the remaining rows visible.
3. **Figure 3 — Tool configuration (optional):** Capture `eslint.config.js` showing the active lint rules, or `.github/workflows/ci.yml` showing the lint and test steps.

Save the unedited captures as PNGs in a `resources\code-review-evidence\` folder, then insert them into this section. Keep the Copilot pane, notification overlays, and unrelated personal information out of frame.
