# Execution & Implementation Plan: HCD Management & Analytics Dashboard

**Document Version:** 1.0
**Target Architecture:** Modular Monolith (Next.js / Node.js + TypeScript, PostgreSQL, Redis / BullMQ)
**Based on:** PRD v2.7 & TDD v1.0

---

## Roadmap Overview & Phases

This execution plan outlines the step-by-step technical implementation roadmap to build, integrate, test, and deploy the HCD Management & Analytics Dashboard according to the specifications defined in `TDD.md`.

```
+-----------------------------------------------------------------------------------+
| Phase 1: Project Scaffolding & Database Foundation                               |
| Phase 2: Authentication & RBAC Middleware                                         |
| Phase 3: Google Sheets Background Sync Engine                                     |
| Phase 4: Core Operational Domain Modules (Modules 1 - 5)                           |
| Phase 5: Executive Analytics Dashboard & UI Presentation                          |
| Phase 6: Testing, Performance Optimization & Launch Readiness                   |
+-----------------------------------------------------------------------------------+
```

---

## Phase 1: Project Scaffolding & Database Foundation

### 1.1 Project Structure Setup
- Initialise Monorepo / Modular project layout:
  - `/apps/web`: Next.js (React 18+, TypeScript, Tailwind CSS, Shadcn UI, Tremor/Recharts).
  - `/apps/api`: Node.js / TypeScript REST API (Fastify or Express, Prisma ORM).
  - `/packages/shared`: Shared TypeScript types, DTOs, and validation schemas (Zod).
- Configure environment configuration (`.env.example`) for DB connection strings, Redis host, Google OAuth credentials, and Google Sheets Service Account keys.

### 1.2 Database Schema & Migration Setup
- Configure Prisma / TypeORM schema based on PostgreSQL DDL in `TDD.md`:
  - `branches`, `divisions`, `employees`, `users`
  - `branch_intern_quotas`, `internships`
  - `employee_licenses`, `employee_license_archives`
  - `training_budgets`, `training_programs`, `training_participants`
  - `kpi_metrics`
  - `culture_programs`, `innovation_ideas`, `halo_hc_tickets`, `social_media_posts`
  - `sheet_sync_logs`
- Generate and execute initial database migration.
- Create seed scripts for initial organizational units, default KPI metrics, and administrative user roles.

---

## Phase 2: Authentication & RBAC Middleware

### 2.1 Google Workspace OAuth 2.0 / OIDC Integration
- Implement `/api/v1/auth/google/callback` handler:
  - Request OIDC token with parameter `hd=company.com`.
  - Perform cryptographic signature verification of `id_token`.
  - **Domain Restriction Guard:** Verify claim `hd == "company.com"`. Reject non-company or personal `@gmail.com` accounts with `403 Forbidden`.
- Implement Session Manager using Redis and HTTP-only, `Secure`, `SameSite=Lax` cookies with a 30-minute idle session timeout.

### 2.2 Role-Based Access Control (RBAC) Guard
- Construct RBAC middleware mapping user roles (`HCD_SUPER_ADMIN`, `DEPUTY_HEAD_HCS_BS`, `HCD_OFFICER_SPECIALIST`, `CULTURE_COMM_PIC`) to functional permissions.
- Create unauthorized error handlers and route guards across backend endpoints and frontend layouts.

---

## Phase 3: Google Sheets Background Sync Engine

### 3.1 Google Sheets API v4 Connector
- Build Service Account connector using `googleapis` SDK with least-privilege read-only scopes.
- Define schema parsers and data transformers for the four master spreadsheets:
  1. **Realisasi Anggaran** $\rightarrow$ `training_budgets`
  2. **Internship Data** $\rightarrow$ `internships` & `branch_intern_quotas`
  3. **License Data Validation** $\rightarrow$ `employee_licenses`
  4. **Training Realization Recap** $\rightarrow$ `training_programs` & `training_participants`

### 3.2 Async Ingestion Queue & Sync Logs
- Configure BullMQ worker queue powered by Redis for background sync jobs.
- Implement batch upsert logic using PostgreSQL transactions (`ON CONFLICT DO UPDATE`).
- Create logging handler recording duration, processed record count, and errors to `sheet_sync_logs`.
- Build `POST /api/v1/sync/sheets/trigger` manual "Sync Now" endpoint for Super Admins.

---

## Phase 4: Core Operational Domain Modules

### 4.1 Module 1: Internship Management
- Implement internship CRUD endpoints and branch quota tracking logic.
- **Sequential Administrative Lifecycle Engine:** Steps 1 through 6 (`Applied` $\rightarrow$ `Application Status` $\rightarrow$ `Acceptance Letter` $\rightarrow$ `Branch Notification` $\rightarrow$ `Internship Report` $\rightarrow$ `Certificate Issuance`).
- **Certificate Issuance Gate:** Enforce business rule strictly blocking certificate generation if `internship_report_status !== 'SUBMITTED'`.

### 4.2 Module 2: License & Certification Validation
- Implement license repository CRUD and Excel bulk import endpoints.
- **Tenure & Expiration Engine:** Automatically calculate $\text{Expiration Date} = \text{Issue Date} + \text{Validity Duration Months}$.
- **Renewal Archiving Workflow:** Archive previous licenses upon renewal.
- **Critical Expiration Alerting:** Surface licenses expiring in $\le 60\text{ days}$.

### 4.3 Module 3: Employee Training Programs & Budget Tracking
- Implement training program management and participant enrollment workflows.
- **Auto-Crediting & Learning Hours Synchronization:** Automatically award credit hours upon marking status as `CERTIFIED`, recalculating employee annual cumulative hours in real time.
- **Under-Trained Prioritization Queue:** Query surfacing employees with $< 24.00$ annual hours, ordered by training deficit descending.
- **Budget Realization Tracking:** Program vs. Realization budget tracking across Mandatory and ISDP streams.

### 4.4 Module 4: KPI & Performance Monitoring
- Implement KPI metric management across Tier 1 (Deputy) and Tier 2 (HCD Department).
- **Scoring Engine:** Implement Maximize and Minimize polarity formulas, capping achievement at $120\%$, calculating weighted scores, and assigning GREEN ($\ge 100\%$), AMBER ($85\text{--}99.9\%$), and RED ($< 85\%$) health statuses.
- Gap analysis form handling for operational commentary, corrective actions, and evidence links.

### 4.5 Module 5: Culture, Innovation & Communication
- **5.1 Culture Programs:** Event logging, headcount tracking, and internalization scoring ($1.00\text{--}5.00$).
- **5.2 Innovation Management:** Stage-gate workflow state machine (`Idea Submitted` $\rightarrow$ `Desk Review` $\rightarrow$ `Pilot/Prototype` $\rightarrow$ `Implementation` $\rightarrow$ `Institutionalized`) and financial/qualitative impact tracking.
- **5.3 HC Communication:** Halo HC Service Desk with 24-hour SLA breach monitoring background worker; `@theyouia.Reg2` Instagram content calendar and engagement rate metrics.

---

## Phase 5: Executive Analytics Dashboard & UI Presentation

### 5.1 Analytics API Aggregation Layer
- Implement `/api/v1/analytics/executive-dashboard` providing unified operational metrics in a single payload.
- Optimize database queries using composite indexes on PostgreSQL to guarantee response time $P_{95} \le 500\text{ ms}$.

### 5.2 Responsive Web Interface (Desktop & Tablet)
- Build responsive UI layouts with Next.js, Tailwind CSS, and Shadcn UI.
- Implement dashboard visual widgets:
  - **KPI Health Scorecard Widget** (Overall score pill, Green/Amber/Red counts).
  - **Internship Intake & Quota Widget** (Utilization gauge, OJT/Magang/PKL breakdown).
  - **License Compliance Widget** (Regulatory vs. Corporate compliance, 60-day critical alerts list).
  - **Training Budget & Hours Widget** (Plan vs. Realization chart, under-trained headcount deficit).
  - **Culture & Innovation Funnel Widget** (Stage-gate pipeline, program reach).
  - **Halo HC & Social Media Widget** (SLA compliance percentage, Instagram engagement rate).

---

## Phase 6: Testing, Quality Assurance & Deployment Readiness

### 6.1 Automated Testing Suite
- **Unit Tests:** Math formulas (KPI achievement, weighted scores, license expiration dates, 24h deficit calculations).
- **Integration Tests:** OAuth domain verification, RBAC guards, state machine gate rules (Certificate issuance block, Auto-crediting trigger).
- **E2E & Performance Benchmarks:** Google Sheets ingestion pipeline execution time verification ($< 10\text{ s}$); API response time benchmark under load ($P_{95} \le 500\text{ ms}$).

### 6.2 Pre-Commit Steps & Launch Verification
- Execute linter, type checks, and test runner.
- Conduct final security audit (session cookies, domain restrictions, API scope permissions).
- Prepare final deployment configuration and commit instructions.
