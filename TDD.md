# Technical Design Document (TDD)

**Project Name:** Human Capital Development (HCD) Management & Analytics Dashboard
**Document Version:** 1.0 (Based on PRD v2.7)
**Target Platform:** Web Application (Responsive Desktop & Tablet)
**Architecture Style:** Modular Monolith / Microservices-Ready API Backend with Single-Page / Server-Rendered Frontend & Background Job Engine

---

## 1. Overview & System Architecture

### 1.1 Architecture Overview
The Human Capital Development (HCD) Platform is designed as a secure, standalone internal system. It acts as the single source of truth for HCD operational domains while asynchronously synchronizing operational data from four master Google Spreadsheets.

The architecture comprises three primary tiers:
1. **Frontend Presentation Tier:** A responsive web interface built with React / Next.js and Tailwind CSS, tailored for desktop and tablet screens.
2. **Backend Application Tier:** RESTful API application built with Node.js/TypeScript (Fastify or Express) providing domain logic, RBAC middleware, state machine engines, and calculation routines.
3. **Data & Integration Tier:**
   - **Database:** PostgreSQL for relational persistence, transactional integrity, and analytical JSON/aggregate queries.
   - **In-Memory Cache / Queue Engine:** Redis + BullMQ for background spreadsheet synchronization, SLA monitoring timers, and session caching.
   - **External Service Integration:** Google Workspace OAuth 2.0 / OIDC for user authentication and Google Sheets API (v4) for bidirectional sync.

### 1.2 System Context Diagram

```
+-----------------------------------------------------------------------------------+
|                                Client Web Browser                                 |
|                         (Desktop / Tablet - HCD Portal UI)                       |
+------------------------------------------+----------------------------------------+
                                           | HTTPS / JSON API
                                           v
+-----------------------------------------------------------------------------------+
|                              Backend Application Server                           |
|                                                                                   |
|  +-------------------------+  +-------------------------+  +-------------------+  |
|  | Auth & Session Engine   |  | Module Logic Services   |  | KPI & Analytics   |  |
|  | (Google OIDC + HD)      |  | (Modules 1-5)            |  | Calculation Engine|  |
|  +-------------------------+  +-------------------------+  +-------------------+  |
|  +-----------------------------------------------------------------------------+  |
|  |                             RBAC Middleware Guard                           |  |
|  +-----------------------------------------------------------------------------+  |
+------------------+-----------------------+----------------------+-----------------+
                   |                       |                      |
                   | SQL Queries           | Job Queue / Cache    | Google Sheets API v4
                   v                       v                      v
        +---------------------+  +-------------------+  +-------------------+
        | PostgreSQL Database |  | Redis / BullMQ    |  | Google Workspace  |
        | (Master Records,    |  | (Scheduled Sync & |  | Spreadsheets      |
        |  Audit Logs, State) |  |  SLA Timers)      |  | (4 Master Sheets) |
        +---------------------+  +-------------------+  +-------------------+
```

---

## 2. Technology Stack

| Layer | Component | Technology / Library | Justification |
| --- | --- | --- | --- |
| **Frontend** | Framework | Next.js (React 18+, TypeScript) | Server-side rendering (SSR) for fast initial loads, responsive UI, strict typing. |
| | Styling & Components | Tailwind CSS, Shadcn UI, Lucide Icons | Clean, modern responsive design for desktop & tablet viewports. |
| | Charts & Visuals | Recharts / Tremor | High-performance interactive dashboard widgets & scorecard visualizations. |
| **Backend** | Framework | Node.js (v20 LTS), Fastify / Express, TypeScript | High throughput, asynchronous non-blocking I/O, strict type safety. |
| | ORM / DB Access | Prisma ORM or TypeORM | Schema migrations, type-safe query building, relational mappings. |
| | Job Scheduler | BullMQ with Redis | Async handling of Google Sheets sync without blocking HTTP request threads. |
| **Data & Storage** | Database | PostgreSQL 16 | Transaction safety, indexing, spatial/json capabilities, aggregation functions. |
| | Cache & Session | Redis 7 | Ephemeral session tokens, rate limiting, BullMQ background queues. |
| **Integrations** | Authentication | Google Identity Services (OAuth 2.0 / OIDC) | Enforces `@company.com` hosted domain (`hd`) claims. |
| | Google Sheets API | `googleapis` (v4) SDK | Scheduled batch read/ingest from 4 master spreadsheets. |

---

## 3. Database Schema Design (PostgreSQL)

### 3.1 Entity Relationship Overview
The database schema consists of core employee master records, organizational structures, administrative domain modules, performance tracking, communication metrics, and audit/sync logs.

```
 [Department/Branch] <--- [Employees] <--- [Users] (Auth / RBAC)
                              |
      +-----------------------+-----------------------+-----------------------+
      |                       |                       |                       |
      v                       v                       v                       v
[Internships]         [Licenses]              [Training_Enrollments]  [Innovation_Ideas]
                      [License_Archive]              |
                                                     v
                                              [Training_Programs]
```

### 3.2 Data DDL & Table Specifications

```sql
-- -----------------------------------------------------------------------------
-- 1. ORGANIZATIONAL & EMPLOYEE MASTER TABLES
-- -----------------------------------------------------------------------------

CREATE TYPE user_role_enum AS ENUM (
  'HCD_SUPER_ADMIN',
  'DEPUTY_HEAD_HCS_BS',
  'HCD_OFFICER_SPECIALIST',
  'CULTURE_COMM_PIC'
);

CREATE TYPE gender_enum AS ENUM ('MALE', 'FEMALE');
CREATE TYPE employment_status_enum AS ENUM ('PERMANENT', 'CONTRACT', 'INTERN', 'INACTIVE');

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  regional_office VARCHAR(255) NOT NULL DEFAULT 'Kantor Regional 2',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  directorate VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employees (
  nik VARCHAR(50) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  gender gender_enum,
  branch_id UUID REFERENCES branches(id),
  division_id UUID REFERENCES divisions(id),
  job_level VARCHAR(100),
  position_title VARCHAR(255),
  status employment_status_enum DEFAULT 'PERMANENT',
  annual_learning_hours NUMERIC(6, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nik VARCHAR(50) UNIQUE REFERENCES employees(nik) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  role user_role_enum NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. MODULE 1: INTERNSHIP MANAGEMENT TABLES
-- -----------------------------------------------------------------------------

CREATE TYPE program_modality_enum AS ENUM ('OJT', 'MAGANG', 'PKL');
CREATE TYPE intern_status_enum AS ENUM ('ACTIVE', 'FINISHED');
CREATE TYPE app_decision_enum AS ENUM ('PENDING', 'OK', 'REJECTED');
CREATE TYPE acceptance_letter_status_enum AS ENUM ('ON_PROCESS', 'GIVEN_TO_INTERN');
CREATE TYPE report_status_enum AS ENUM ('NOT_SUBMITTED', 'SUBMITTED');

CREATE TABLE branch_intern_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  intake_batch VARCHAR(100) NOT NULL,
  quota_limit INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, intake_batch)
);

CREATE TABLE internships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  national_id VARCHAR(50) NOT NULL, -- KTP/NIM/NISN
  institution VARCHAR(255) NOT NULL, -- University / SMK
  major VARCHAR(255) NOT NULL,
  branch_id UUID REFERENCES branches(id),
  division_id UUID REFERENCES divisions(id),
  mentor_nik VARCHAR(50) REFERENCES employees(nik),
  program_type program_modality_enum NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  operational_status intern_status_enum DEFAULT 'ACTIVE',

  -- Sequential Administrative Lifecycle
  lifecycle_step INT DEFAULT 1, -- 1: Applied, 2: App Status, 3: Letter Accept, 4: Branch Notif, 5: Report, 6: Cert
  application_status app_decision_enum DEFAULT 'PENDING',
  acceptance_letter_status acceptance_letter_status_enum DEFAULT 'ON_PROCESS',
  branch_notification_sent BOOLEAN DEFAULT FALSE,
  branch_notification_date TIMESTAMPTZ,
  internship_report_status report_status_enum DEFAULT 'NOT_SUBMITTED',
  certificate_number VARCHAR(100),
  certificate_issued_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. MODULE 2: LICENSE & CERTIFICATION VALIDATION TABLES
-- -----------------------------------------------------------------------------

CREATE TYPE compliance_classification_enum AS ENUM ('MANDATORI_REGULASI', 'MANDATORI_KORPORASI');

CREATE TABLE employee_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nik VARCHAR(50) REFERENCES employees(nik) ON DELETE CASCADE,
  certificate_title VARCHAR(255) NOT NULL,
  issuing_authority VARCHAR(255) NOT NULL,
  registration_number VARCHAR(100) NOT NULL,
  classification compliance_classification_enum NOT NULL,
  issue_date DATE NOT NULL,
  validity_duration_months INT NOT NULL, -- e.g., 12, 24, 36
  expiration_date DATE NOT NULL,
  attachment_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employee_license_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES employee_licenses(id) ON DELETE CASCADE,
  nik VARCHAR(50) NOT NULL,
  certificate_title VARCHAR(255) NOT NULL,
  registration_number VARCHAR(100) NOT NULL,
  issue_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  archived_reason VARCHAR(255) DEFAULT 'RENEWED',
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. MODULE 3: EMPLOYEE TRAINING & BUDGET TABLES
-- -----------------------------------------------------------------------------

CREATE TYPE development_category_enum AS ENUM ('TECHNICAL', 'LEADERSHIP', 'SOFT_SKILLS', 'MANDATORY_COMPLIANCE');
CREATE TYPE training_modality_enum AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');
CREATE TYPE participant_status_enum AS ENUM ('ENROLLED', 'ATTENDED', 'CANCELLED', 'CERTIFIED');
CREATE TYPE budget_category_enum AS ENUM ('MANDATORY_PROGRAM', 'ISDP');

CREATE TABLE training_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INT NOT NULL, -- e.g. 2026
  location VARCHAR(255) NOT NULL DEFAULT 'Kantor Regional 2',
  category budget_category_enum NOT NULL,
  plan_budget NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  realization_nka NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  realization_payment NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  balance NUMERIC(15,2) GENERATED ALWAYS AS (plan_budget - realization_payment) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fiscal_year, location, category)
);

CREATE TABLE training_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category development_category_enum NOT NULL,
  modality training_modality_enum NOT NULL,
  provider_trainer VARCHAR(255) NOT NULL,
  start_schedule TIMESTAMPTZ NOT NULL,
  end_schedule TIMESTAMPTZ NOT NULL,
  credit_hours NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  budget_category budget_category_enum DEFAULT 'MANDATORY_PROGRAM',
  cost NUMERIC(15,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE training_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES training_programs(id) ON DELETE CASCADE,
  nik VARCHAR(50) REFERENCES employees(nik) ON DELETE CASCADE,
  status participant_status_enum DEFAULT 'ENROLLED',
  awarded_hours NUMERIC(5,2) DEFAULT 0.00,
  certified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, nik)
);

-- -----------------------------------------------------------------------------
-- 5. MODULE 4: KPI & PERFORMANCE MONITORING TABLES
-- -----------------------------------------------------------------------------

CREATE TYPE kpi_tier_enum AS ENUM ('TIER_1_DEPUTY', 'TIER_2_HCD');
CREATE TYPE kpi_polarity_enum AS ENUM ('MAXIMIZE', 'MINIMIZE');
CREATE TYPE kpi_health_enum AS ENUM ('GREEN', 'AMBER', 'RED');

CREATE TABLE kpi_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier kpi_tier_enum NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  weight_percent NUMERIC(5,2) NOT NULL, -- e.g. 15.00 for 15%
  target_value NUMERIC(12,4) NOT NULL,
  actual_value NUMERIC(12,4) NOT NULL DEFAULT 0.00,
  polarity kpi_polarity_enum NOT NULL DEFAULT 'MAXIMIZE',
  achievement_percent NUMERIC(5,2) DEFAULT 0.00,
  weighted_score NUMERIC(5,2) DEFAULT 0.00,
  health_status kpi_health_enum DEFAULT 'RED',
  operational_commentary TEXT,
  corrective_action_plan TEXT,
  evidence_document_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. MODULE 5: CULTURE, INNOVATION & COMMUNICATION TABLES
-- -----------------------------------------------------------------------------

CREATE TYPE culture_status_enum AS ENUM ('PLANNED', 'ONGOING', 'COMPLETED', 'POSTPONED', 'CANCELLED');

CREATE TABLE culture_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_name VARCHAR(255) NOT NULL,
  value_pillar VARCHAR(100) NOT NULL, -- e.g., AKHLAK / Corporate
  modality training_modality_enum NOT NULL,
  execution_date DATE NOT NULL,
  target_unit VARCHAR(255) NOT NULL,
  target_headcount INT NOT NULL,
  actual_headcount INT DEFAULT 0,
  status culture_status_enum DEFAULT 'PLANNED',
  avg_internalization_score NUMERIC(3,2) CHECK (avg_internalization_score BETWEEN 1.00 AND 5.00),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE innovation_category_enum AS ENUM ('PROCESS_IMPROVEMENT', 'DIGITALIZATION', 'COST_EFFICIENCY', 'EMPLOYEE_EXPERIENCE');
CREATE TYPE innovation_stage_enum AS ENUM ('IDEA_SUBMITTED', 'DESK_REVIEW', 'PILOT_PROTOTYPE', 'IMPLEMENTATION', 'INSTITUTIONALIZED');

CREATE TABLE innovation_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  proposer_nik VARCHAR(50) REFERENCES employees(nik),
  team_members JSONB DEFAULT '[]', -- Array of NIKs / Names
  category innovation_category_enum NOT NULL,
  stage innovation_stage_enum DEFAULT 'IDEA_SUBMITTED',
  expected_financial_impact NUMERIC(15,2) DEFAULT 0.00,
  qualitative_impact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE hc_channel_enum AS ENUM ('WHATSAPP', 'EMAIL', 'DESK_VISIT');
CREATE TYPE ticket_status_enum AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE halo_hc_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  channel hc_channel_enum NOT NULL,
  topic_category VARCHAR(100) NOT NULL, -- Benefits & Medical, Training, Certification, Grievance
  requester_nik VARCHAR(50) REFERENCES employees(nik),
  requester_name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status ticket_status_enum DEFAULT 'OPEN',
  sla_target_hours INT DEFAULT 24,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  is_breached BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE post_format_enum AS ENUM ('FEED', 'CAROUSEL', 'REELS', 'STORY');

CREATE TABLE social_media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_date DATE NOT NULL,
  content_pillar VARCHAR(100) NOT NULL, -- Culture Booster, Training Info, Intern Spotlight
  format post_format_enum NOT NULL,
  title_topic VARCHAR(255) NOT NULL,
  gross_impressions INT DEFAULT 0,
  reach INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  saves INT DEFAULT 0,
  interaction_count INT GENERATED ALWAYS AS (likes + comments + shares + saves) STORED,
  engagement_rate_percent NUMERIC(5,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7. SYSTEM CONFIG & SPREADSHEET SYNC AUDIT TABLES
-- -----------------------------------------------------------------------------

CREATE TABLE sheet_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_name VARCHAR(100) NOT NULL,
  spreadsheet_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL, -- SUCCESS, FAILED, PARTIAL
  records_processed INT DEFAULT 0,
  error_message TEXT,
  triggered_by VARCHAR(100) NOT NULL, -- AUTOMATED_CRON, MANUAL_SUPER_ADMIN
  duration_ms INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Authentication, OAuth 2.0 & Role-Based Access Control (RBAC)

### 4.1 Google Workspace OAuth 2.0 / OIDC Flow
Authentication is strictly handled via Google Identity Services using OpenID Connect (OIDC).

1. **Client Authorization Request:**
   - Front-end initiates login redirect to Google OAuth Endpoint:
     `https://accounts.google.com/o/oauth2/v2/auth?client_id=...&response_type=code&scope=openid%20email%20profile&hd=company.com&redirect_uri=...`
   - Setting `hd=company.com` forces Google to restrict the account picker to corporate domain emails.
2. **Back-end ID Token & Domain Validation:**
   - Backend exchanges authorization code for `id_token`.
   - Decoding & Cryptographic Verification of `id_token`:
     - Validate signature against Google public keys.
     - Verify `iss` (accounts.google.com), `aud` (Client ID).
     - **Strict Claim Verification:** Check `hd == "company.com"` and `email_verified == true`.
     - Reject any account where `hd` is missing or does not match `@company.com` (e.g. personal `@gmail.com` accounts) with HTTP 403 Forbidden.
3. **Account Provisioning & Session Initialization:**
   - Query `users` table where `email == verified_email` AND `is_active == true`.
   - If user record exists:
     - Issue encrypted HTTP-only session cookie containing session token / JWT.
     - Cookie Attributes: `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=1800` (30-minute idle timeout).
   - If user record does NOT exist or `is_active == false`:
     - Terminate flow and return `HTTP 403 Forbidden: User not authorized`.

### 4.2 RBAC Permission Matrix

| Feature / Action | HCD Super Admin | Deputy / Head of HCS & BS | HCD Officer / Specialist | Culture & Comm PIC |
| --- | :---: | :---: | :---: | :---: |
| **System Settings & User Admin** | Full CRUD | Read-Only | Denied | Denied |
| **Google Sheet Sync Configuration** | Full Execution / Trigger | Read-Only | Denied | Denied |
| **Module 1: Internship Operations** | Full CRUD | Read-Only | Full CRUD | Denied |
| **Module 2: License Validation** | Full CRUD | Read-Only | Full CRUD | Denied |
| **Module 3: Training & Budget Tracking** | Full CRUD | Read-Only | Full CRUD | Denied |
| **Module 4: KPI Performance Metrics** | Full CRUD | Full Read / Export | View / Edit HCD Tier | Denied |
| **Module 5.1: Culture Programs** | Full CRUD | Read-Only | Read-Only | Full CRUD |
| **Module 5.2: Innovation Pipeline** | Full CRUD | Read-Only | Read-Only | Full CRUD |
| **Module 5.3: Halo HC & Social Media** | Full CRUD | Read-Only | Read-Only | Full CRUD |
| **Module 6: Executive Analytics** | Full Access | Full Access | Operational View | Domain View |

---

## 5. Google Sheets Integration Engine

### 5.1 Connector & Ingestion Architecture
The system connects to four live master Google Spreadsheets via Google Sheets API v4 using a Service Account with Least-Privilege Read-Only permissions.

```
+-------------------------------------------------------------------+
|                        BullMQ Scheduler                           |
|      (Default: Hourly Cron OR Manual "Sync Now" Trigger)          |
+---------------------------------+---------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                     Sync Processing Service                       |
|  1. Fetch Sheet Metadata & Cell Ranges                             |
|  2. Parse & Validate Schema Mapping                               |
|  3. Transform & Sanitize Records                                  |
|  4. Bulk Upsert into PostgreSQL (Transaction Block)              |
|  5. Log Execution Duration & Status to `sheet_sync_logs`          |
+-------------------------------------------------------------------+
```

### 5.2 Spreadsheet Mappings & Processing Rules

| Spreadsheet Name | Target DB Tables | Ingestion & Sync Logic |
| --- | --- | --- |
| **Realisasi Anggaran** | `training_budgets` | Parses Location (`Kantor Regional 2`), Mandatory & ISDP budget plans, realizations (NKA & Payment), calculates remaining balances. |
| **Internship Data** | `internships`, `branch_intern_quotas` | Matches intern KTP/NIM/NISN; syncs university, placement branch, program modality (`OJT`, `Magang`, `PKL`), lifecycle statuses. Updates quota usage. |
| **License Data Validation** | `employee_licenses` | Parses NIK, Certificate Title, Issuing Authority, Reg Number, Classification (`Mandatori Regulasi` / `Mandatori Korporasi`). Auto-calculates expiration date. |
| **Training Realization Recap** | `training_programs`, `training_participants`, `employees` | Ingests historical training logs, credited hours, enrollment statuses (`Certified`, etc.). Triggers real-time cumulative learning hours update for `employees`. |

### 5.3 Non-Blocking Execution Guarantee
- Sync tasks are processed in background workers via BullMQ in Redis.
- Database upserts use PostgreSQL `ON CONFLICT DO UPDATE` batch transactions.
- Execution timeout strictly capped at 10 seconds total for all 4 sheets.
- User-facing UI reads directly from indexed PostgreSQL tables; dashboard response times remain unaffected ($P_{95} \le 500\text{ ms}$).

---

## 6. Core Business Logic & State Machines

### 6.1 Module 1: Internship Sequential Administrative Lifecycle Engine

#### Lifecycle State Flow Diagram:
```
 Applied ──> Application Status ──> Acceptance Letter ──> Branch Notification ──> Internship Report ──> Certificate Issuance
               │                                                                    │                       │
               ├── (OK) ──> Continue                                                ├── (Submitted) ──────> [CERTIFICATE PERMITTED]
               └── (Rejected) ──> [TERMINATE RECORD]                                └── (Not Submitted) ──> [CERTIFICATE BLOCKED]
```

#### Certificate Issuance Gate Rule:
```typescript
function issueInternshipCertificate(internshipId: string, certNumber: string): Internship {
  const intern = await db.internships.findUnique({ where: { id: internshipId } });

  if (!intern) {
    throw new NotFoundException("Internship record not found.");
  }

  if (intern.internship_report_status !== 'SUBMITTED') {
    throw new BadRequestException(
      "BUSINESS RULE VIOLATION: Certificate cannot be generated or issued until Internship Report status is SUBMITTED."
    );
  }

  return await db.internships.update({
    where: { id: internshipId },
    data: {
      certificate_number: certNumber,
      certificate_issued_at: new Date(),
      lifecycle_step: 6,
      operational_status: 'FINISHED'
    }
  });
}
```

---

### 6.2 Module 2: License Expiration & Archiving Engine

#### Expiration Date Calculation Formula:
$$\text{Expiration Date} = \text{Issue Date} + \text{Validity Duration Months}$$

#### Renewal Archiving Workflow:
When a new license with an existing `registration_number` or matching `(nik, certificate_title)` is uploaded:
1. Current active license record is moved to `employee_license_archives` with `archived_reason = 'RENEWED'`.
2. New license record is created in `employee_licenses` with updated `issue_date` and recomputed `expiration_date`.
3. Critical expiration alerts trigger for any active license where:
$$\text{Days Remaining} = \text{Expiration Date} - \text{Current Date} \le 60 \text{ days}$$

---

### 6.3 Module 3: Learning Hour Crediting & Under-Trained Deficit Engine

#### Statutory Target Rule:
- Minimum mandatory statutory target: **24.00 Learning Hours** per employee per calendar year.

#### Auto-Crediting Rule:
When participant status changes in `training_participants`:
```typescript
async function updateParticipantStatus(
  participantId: string,
  newStatus: 'ENROLLED' | 'ATTENDED' | 'CANCELLED' | 'CERTIFIED'
) {
  await db.$transaction(async (tx) => {
    const participant = await tx.training_participants.findUnique({
      where: { id: participantId },
      include: { program: true }
    });

    let awardedHours = 0;
    if (newStatus === 'CERTIFIED') {
      awardedHours = participant.program.credit_hours;
    }

    // 1. Update participant record
    await tx.training_participants.update({
      where: { id: participantId },
      data: {
        status: newStatus,
        awarded_hours: awardedHours,
        certified_at: newStatus === 'CERTIFIED' ? new Date() : null
      }
    });

    // 2. Recalculate cumulative annual learning hours for employee
    const totalHoursResult = await tx.training_participants.aggregate({
      where: {
        nik: participant.nik,
        status: 'CERTIFIED',
        certified_at: {
          gte: new Date(new Date().getFullYear(), 0, 1) // Start of current year
        }
      },
      _sum: { awarded_hours: true }
    });

    const totalHours = totalHoursResult._sum.awarded_hours || 0;

    await tx.employees.update({
      where: { nik: participant.nik },
      data: { annual_learning_hours: totalHours }
    });
  });
}
```

#### Prioritized Under-Trained Ranking Queue:
Surfaces employees where `annual_learning_hours < 24.00`, ranked descending by training deficit:
$$\text{Training Deficit} = 24.00 - \text{annual\_learning\_hours}$$

---

### 6.4 Module 4: Strategic KPI Scoring Engine

#### Polarity Logic & Achievement Calculations:

1. **Maximize Polarity (Higher Actual is Better):**
$$\text{Achievement \%} = \min\left( \left(\frac{A}{T}\right) \times 100\%, \; 120\% \right)$$

2. **Minimize Polarity (Lower Actual is Better):**
$$\text{Achievement \%} = \begin{cases}
100\%, & \text{if } A \le T \\
\max\left( \left(1 - \frac{A - T}{T}\right) \times 100\%, \; 0\% \right), & \text{if } A > T
\end{cases}$$

3. **Weighted Score Calculation:**
$$\text{Weighted Score} = \frac{\text{Achievement \%} \times \text{Weight \%}}{100}$$

4. **Health Status Classification:**
   - **GREEN:** $\text{Achievement \%} \ge 100.00\%$
   - **AMBER:** $85.00\% \le \text{Achievement \%} \le 99.99\%$
   - **RED:** $\text{Achievement \%} < 85.00\%$

---

### 6.5 Module 5.2: Innovation Stage-Gate Workflow

```
 Idea Submitted ──> Desk Review ──> Pilot / Prototype ──> Implementation ──> Institutionalized
```
- Transition to each stage requires explicit approval and logged review notes.
- Financial & qualitative impacts are re-evaluated upon reaching `Implementation`.

---

### 6.6 Module 5.3: Halo HC SLA Breach Engine

#### SLA Target & Breach Rule:
- Default SLA Target: **24 Business Hours**.
- Background job evaluates open tickets every 15 minutes:
```sql
UPDATE halo_hc_tickets
SET is_breached = TRUE
WHERE status IN ('OPEN', 'IN_PROGRESS')
  AND is_breached = FALSE
  AND (EXTRACT(EPOCH FROM (NOW() - opened_at)) / 3600) > sla_target_hours;
```

---

## 7. API Contracts & Endpoint Specifications

### 7.1 Authentication & System APIs

```
POST /api/v1/auth/google/callback
  - Description: Validates Google OIDC authorization code, verifies `hd` claim, provisions session.
  - Request Body: { "code": "4/0AeaY..." }
  - Response (200 OK): { "user": { "email": "user@company.com", "role": "HCD_SUPER_ADMIN" } }
  - Error (403 Forbidden): { "error": "Access denied. Domain must be @company.com and account registered." }

POST /api/v1/auth/logout
  - Description: Clears session cookie and invalidates session token in Redis.

POST /api/v1/sync/sheets/trigger
  - RBAC Guard: HCD Super Admin
  - Description: Manual "Sync Now" trigger for 4 master Google Sheets.
  - Response (200 OK): { "status": "SYNC_INITIATED", "jobId": "bullmq_102" }
```

### 7.2 Module 1: Internship APIs

```
GET /api/v1/internships
  - Query Params: branchId, status, programType, page, limit
  - Response (200 OK): { "data": [...], "pagination": { "total": 45, "page": 1 } }

POST /api/v1/internships
  - Body: { "fullName": "...", "nationalId": "...", "institution": "...", "major": "...", "branchId": "...", "divisionId": "...", "programType": "OJT", "startDate": "2026-01-01", "endDate": "2026-06-30" }

PATCH /api/v1/internships/:id/lifecycle
  - Body: { "applicationStatus": "OK", "acceptanceLetterStatus": "GIVEN_TO_INTERN", "branchNotificationSent": true, "internshipReportStatus": "SUBMITTED" }

POST /api/v1/internships/:id/issue-certificate
  - Body: { "certificateNumber": "CERT/HCD/2026/089" }
  - Response (200 OK): { "id": "...", "certificateNumber": "CERT/HCD/2026/089", "operationalStatus": "FINISHED" }
  - Error (400 Bad Request): { "error": "BUSINESS RULE VIOLATION: Internship Report not SUBMITTED." }
```

### 7.3 Module 2: License Validation APIs

```
GET /api/v1/licenses
  - Query Params: classification, expiringInDays=60, search, page, limit
  - Response (200 OK): { "data": [...], "summary": { "criticalExpirations": 8, "complianceRate": 94.2 } }

POST /api/v1/licenses/import-bulk
  - Body: Multipart Form Data (.xlsx template)
  - Response (200 OK): { "imported": 120, "errors": [] }
```

### 7.4 Module 3: Training & Budget APIs

```
GET /api/v1/training/under-trained-queue
  - Query Params: divisionId, limit=20
  - Response (200 OK): [ { "nik": "10023", "fullName": "Jane Doe", "annualHours": 8.0, "deficit": 16.0 } ]

PATCH /api/v1/training/participants/:id/status
  - Body: { "status": "CERTIFIED" }
  - Response (200 OK): { "id": "...", "status": "CERTIFIED", "awardedHours": 8.0, "updatedAnnualHours": 24.0 }
```

### 7.5 Module 4: KPI & Performance APIs

```
GET /api/v1/kpis
  - Query Params: tier (TIER_1_DEPUTY / TIER_2_HCD)
  - Response (200 OK): { "tier": "TIER_1_DEPUTY", "aggregateWeightedScore": 108.5, "metrics": [...] }

PATCH /api/v1/kpis/:id
  - Body: { "actualValue": 95.0, "operationalCommentary": "...", "correctiveActionPlan": "..." }
```

### 7.6 Module 5 & 6 APIs

```
GET /api/v1/analytics/executive-dashboard
  - Response (200 OK): {
      "kpiHealth": { "overallScore": 105.2, "greenCount": 8, "amberCount": 2, "redCount": 1 },
      "internshipQuota": { "totalQuota": 100, "activeInterns": 82, "utilizationRate": 82.0 },
      "licenseCompliance": { "criticalExpirations": 5, "regulatoryRate": 96.5, "corporateRate": 92.0 },
      "trainingBudget": { "totalPlan": 500000000, "totalRealization": 320000000, "utilizationPercent": 64.0 },
      "underTrainedRate": 12.4,
      "haloHcSlaAdherence": 98.2
    }
```

---

## 8. Non-Functional & Security Requirements

### 8.1 Performance Targets
- **Executive Analytics Endpoint Loading:** $P_{95} \le 500\text{ ms}$. Achieved via composite indexing on PostgreSQL aggregation columns (`nik`, `tier`, `expiration_date`, `status`).
- **Google Sheets Sync Execution:** Entire background process across all 4 spreadsheets completes within **$< 10\text{ seconds}$**.
- **Concurrent Users:** Supports 100+ concurrent active administrative sessions without CPU throttling.

### 8.2 Security & Compliance
- **Domain Enforcement:** Strict Google OAuth `hd` claim verification preventing unauthorized accounts from gaining access.
- **Session Security:** Cookies configured with `HttpOnly`, `Secure`, `SameSite=Lax`, and 30-minute idle expiration.
- **Least-Privilege API Scopes:** Google Drive API tokens configured strictly for read-only access to specified spreadsheet IDs.
- **Audit Logging:** Every critical administrative write operation and spreadsheet sync event is recorded with timestamp, user ID, and IP address.

---

## 9. Test Strategy & Quality Assurance

### 9.1 Unit Testing
- **KPI Calculation Unit Tests:** Verify Maximize/Minimize achievement percentages, capping at 120%, and weighted score math.
- **License Expiration Tests:** Verify date math for 12, 24, 36 month active durations and 60-day warning threshold filters.
- **Internship State Machine Tests:** Ensure certificate issuance throws exceptions when report status is not `SUBMITTED`.

### 9.2 Integration & API Testing
- **OAuth Callback Tests:** Mock Google OIDC token response with valid `@company.com` and invalid `@gmail.com` emails to assert 200 vs 403 responses.
- **Auto-Crediting Integration Tests:** Assert marking a participant as `CERTIFIED` updates `employees.annual_learning_hours` and re-ranks the under-trained queue in real time.

### 9.3 End-to-End & Performance Testing
- **Google Sheets Ingestion Pipeline E2E Test:** Mock Google Sheets API responses and run BullMQ sync job; verify database records upsert correctly within $< 10$ seconds.
- **Dashboard Load Benchmark:** Benchmark `/api/v1/analytics/executive-dashboard` using `k6` or `autocannon` under 100 concurrent requests to ensure $P_{95} \le 500\text{ ms}$.
