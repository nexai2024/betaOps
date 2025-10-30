# BetaOps Architecture

## Overview

BetaOps is a production-ready AI-assisted beta testing platform that helps developers and software shops manage testing across simple SPAs and complex, regulated systems.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│  Next.js 14 App Router + TypeScript + TailwindCSS + shadcn/ui  │
│                                                                   │
│  Pages: Projects │ Features │ Test Plans │ Execution │ Issues   │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ tRPC + React Query
                     │
┌────────────────────┴─────────────────────────────────────────────┐
│                       API/Backend Layer                           │
│                  Next.js API Routes + tRPC                        │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐      │
│  │   Auth      │  │  GitHub App  │  │   AI Provider     │      │
│  │  NextAuth   │  │  Webhooks    │  │   Abstraction     │      │
│  └─────────────┘  └──────────────┘  └───────────────────┘      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Core Business Logic                          │   │
│  │  • Project Management    • Test Generation               │   │
│  │  • Feature Modeling      • Execution & Evidence          │   │
│  │  • Issue Lifecycle       • Compliance & Audit            │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ Prisma ORM
                     │
┌────────────────────┴─────────────────────────────────────────────┐
│                       Data Layer                                  │
│                    PostgreSQL Database                            │
│                                                                   │
│  Tables: User │ Project │ Feature │ TestArtifact │ TestCycle    │
│          TestCaseInstance │ IssueLink │ AuditEvent │ ...        │
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    External Integrations                          │
│                                                                   │
│  GitHub API     Slack/Teams      AI Providers    Observability  │
│  (Issues, PRs)  (Notifications)  (OpenAI, etc)   (Sentry, OTel) │
└───────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Data Model (Prisma)

**User & Auth**
- User, Account, Session (NextAuth models)
- Role-based access control (Owner, Maintainer, Tester, External)

**Project Context**
- **Project**: Core container with regulatory regime, risk level, repo links
- **Feature**: Hierarchical feature tree with tags for targeted testing
- **Environment**: Deployment environments with configs

**Test Artifacts**
- **TestArtifact**: User stories, test cases, charters, acceptance criteria
- **TestTemplate**: Reusable templates (smoke, regression, security, compliance)
- Provenance tracking: AI-generated vs. manual

**Test Execution**
- **TestPlan**: Templates with required sign-offs and scope
- **TestCycle**: Versioned test runs tied to commits/branches
- **TestCaseInstance**: Individual test executions with evidence, sign-offs
- **Attachment**: Files with PII redaction support

**Issue Management**
- **IssueLink**: Bidirectional sync with GitHub Issues
- **IssueSyncEvent**: Track sync history and status changes

**Compliance & Audit**
- **AuditEvent**: Immutable log of all actions
- **ComplianceConfig**: Per-project compliance rules
- **SignOff**: Electronic attestations with timestamps

**Testers & Assignments**
- **BetaTester**: Internal and external testers with reliability scores
- **TesterInvite**: Token-based invitations with NDA gating

**Notifications**
- **NotificationRule**: Event-driven notification configs
- **NotificationLog**: Delivery tracking

### 2. API Layer (tRPC)

**Router Structure:**
```typescript
- auth.*         // Authentication & authorization
- projects.*     // CRUD + repo connection
- features.*     // Feature tree management
- artifacts.*    // Test artifact generation & management
- testPlans.*    // Plan creation & templating
- testCycles.*   // Cycle management & execution
- execution.*    // Test case execution, evidence, sign-offs
- issues.*       // GitHub integration & sync
- github.*       // Webhook handlers & App management
- ai.*           // AI generation endpoints
- compliance.*   // Audit export, quality gates
- analytics.*    // Metrics, trends, insights
- notifications.*// Rules and delivery
```

**Key Procedures:**
- `projects.create` - Initialize project with repo
- `ai.generateTestCases` - Create tests from code diffs
- `execution.submitEvidence` - Upload attachments
- `execution.signOff` - Electronic attestation
- `issues.createFromTest` - Generate GitHub issue
- `compliance.exportAuditBundle` - Compliance package
- `github.handleWebhook` - Process GitHub events

### 3. AI Provider Abstraction

**Interface:**
```typescript
interface AIProvider {
  name: string;
  generateUserStories(context: ProjectContext): Promise<Story[]>;
  generateTestCases(story: Story, constraints: Constraints): Promise<TestCase[]>;
  analyzeFailure(test: TestCase, logs: string[]): Promise<RootCauseAnalysis>;
  summarizeWeekly(project: Project, metrics: Metrics): Promise<Summary>;
}
```

**Implementations:**
- OpenAI (GPT-4)
- Anthropic (Claude)
- OpenRouter (multi-provider)
- Local models (Ollama, LM Studio)

**Safeguards:**
- System prompts preventing code exfiltration
- Content moderation hooks
- Prompt injection detection
- PII filtering and redaction
- Rate limiting per user/project
- Encrypted audit logs of all AI calls

**Context Building:**
```typescript
async function buildTestContext(project, feature, diff) {
  return {
    projectMetadata: { regulatory, riskLevel, constraints },
    featureContext: { name, description, dependencies, tags },
    codeChanges: parseDiff(diff),
    existingTests: getRelatedTests(feature),
    historicalFailures: getFailurePatterns(feature),
    complianceRequirements: getComplianceRules(project)
  };
}
```

### 4. GitHub Integration

**GitHub App Permissions:**
- Read: repository metadata, issues, pull requests
- Write: issues, checks (optional: create PRs)
- Webhooks: push, pull_request, issues

**Webhook Handlers:**
```typescript
POST /api/github/webhook
  - push → detectImpactedFeatures → suggestTestCycle
  - pull_request.opened → analyzeChanges → createCheckRun
  - issues.closed → findLinkedTests → triggerRetest
```

**Issue Sync Workflow:**
1. Test fails → `issues.createFromTest()`
2. Generate issue with template: repro steps, env, evidence, labels
3. Create IssueLink with bidirectional reference
4. Poll or webhook updates → sync status
5. Issue closed → update TestCaseInstance → notify assignee

**PR Checks:**
```typescript
// Create check run with test results
POST /api/check-runs
{
  name: "BetaOps Tests",
  conclusion: "success" | "failure",
  output: {
    title: "Test Coverage",
    summary: "15/15 critical tests passed",
    annotations: [...] // Failed tests
  }
}
```

### 5. Compliance & Regulated Use

**Compliance Mode Configuration:**
```typescript
{
  regulatoryRegime: "HIPAA" | "PCI" | "GDPR" | "SOC2" | "FDA",
  requirements: {
    dualSignOff: boolean,
    segregationOfDuties: boolean,
    evidenceRetention: number, // days
    piiRedaction: "required" | "optional",
    auditTrail: "full" | "minimal",
    requiredReviewers: string[],
    qualityGates: QualityGate[]
  }
}
```

**Quality Gates:**
```typescript
{
  environment: "production",
  conditions: [
    { type: "criticalTestsPassing", threshold: 100 },
    { type: "coverageByFeature", minCoverage: 0.8 },
    { type: "mandatorySignOffs", required: ["qa-lead", "security"] },
    { type: "noBlockingIssues", severity: "critical" }
  ],
  onFail: "block" | "warn"
}
```

**Audit Bundle Export:**
```json
{
  "exportedAt": "2025-10-30T12:00:00Z",
  "project": { ... },
  "cycle": { ... },
  "testResults": [
    {
      "testCase": { ... },
      "status": "passed",
      "evidence": [ ... ],
      "signedBy": "user@example.com",
      "signedAt": "2025-10-30T11:30:00Z",
      "signature": "sha256:...",
      "environment": "production",
      "commitSha": "abc123"
    }
  ],
  "linkedIssues": [ ... ],
  "auditEvents": [ ... ],
  "signature": "bundle-sha256:..."
}
```

### 6. Frontend Architecture

**Pages Structure:**
```
/app/
  /dashboard              - Overview, recent activity
  /projects
    /[id]                 - Project detail
    /[id]/features        - Feature tree
    /[id]/artifacts       - Test artifacts library
    /[id]/plans           - Test plans
    /[id]/cycles          - Test cycles list
    /[id]/cycles/[cycleId]
      /execute            - Kanban execution board
    /[id]/issues          - Issue links
    /[id]/releases        - Release dashboard
    /[id]/analytics       - Metrics & insights
    /[id]/settings        - Config, integrations, compliance
  /testers                - Tester management
  /admin                  - System admin
```

**Key UI Components:**
- `FeatureTree`: Hierarchical tree with drag-drop
- `TestExecutionBoard`: Kanban with inline AI assist
- `EvidenceUpload`: Drag-drop with auto-redaction
- `SignOffModal`: Electronic attestation form
- `IssueCreateDialog`: GitHub issue generator
- `AuditBundleExport`: Compliance package builder
- `AIGenerationPanel`: Progress and review for AI tasks
- `CoverageHeatmap`: Visual feature coverage
- `ReleaseGateStatus`: Quality gate pass/fail indicator

**State Management:**
- tRPC + React Query for server state
- Zustand for UI state (filters, selections)
- Optimistic updates for instant feedback

### 7. Security & RBAC

**Roles:**
```typescript
enum Role {
  OWNER = "owner",           // Full control
  MAINTAINER = "maintainer", // Manage tests, not project
  TESTER = "tester",         // Execute tests
  EXTERNAL = "external"      // Limited tester access
}
```

**Permission Matrix:**
```
                   Owner  Maintainer  Tester  External
Project Settings    ✓        -         -        -
GitHub Connect      ✓        -         -        -
Create Features     ✓        ✓         -        -
Gen AI Tests        ✓        ✓         -        -
Execute Tests       ✓        ✓         ✓        ✓
View Evidence       ✓        ✓         ✓        -
Create Issues       ✓        ✓         ✓        -
Export Audit        ✓        -         -        -
Manage Testers      ✓        ✓         -        -
```

**Security Measures:**
- Row-level security via project ownership checks
- API rate limiting (100 req/min/user, 1000/day)
- CSRF protection on all mutations
- Input validation with Zod schemas
- Encrypted sensitive data (tokens, PII)
- Audit logging of all privileged actions
- OAuth scopes: minimal required
- NDA acceptance tracking for external testers

### 8. Observability

**Sentry:**
- Error tracking with context (user, project, action)
- Performance monitoring (API latency, DB queries)
- Release tracking with commit SHAs

**OpenTelemetry:**
- Distributed tracing for API calls
- Custom spans for AI generation, GitHub API
- Metrics: test execution time, failure rates, AI latency

**Logging:**
```typescript
// Structured logging
logger.info("test_executed", {
  projectId,
  testCaseId,
  duration,
  status,
  userId,
  environment
});
```

**Dashboards:**
- Test execution trends
- AI generation success rates
- GitHub sync health
- Quality gate pass rates

## Data Flow Examples

### Flow 1: AI-Assisted Test Generation from Push

```
1. Developer pushes commit
2. GitHub webhook → /api/github/webhook
3. Parse diff, identify changed files
4. Map files → impacted Features
5. Build AI context (diff, README, existing tests)
6. AI generates user stories & test cases
7. Create TestArtifacts (status: draft)
8. Create suggested TestCycle
9. Notify maintainer → review & approve
10. Publish cycle → assign to testers
```

### Flow 2: Test Execution with Sign-Off

```
1. Tester opens TestCaseInstance
2. Review test steps (AI can suggest additions)
3. Execute test in target environment
4. Upload evidence (screenshots, HAR files)
5. Auto-redaction scans for PII
6. Mark status (passed/failed/blocked)
7. If failed: optionally create GitHub issue
8. Sign off: attest to accuracy + capture metadata
9. Compliance mode: require dual sign-off
10. Update cycle progress → check quality gates
```

### Flow 3: Issue Lifecycle Integration

```
1. Test fails → Click "Create Issue"
2. Pre-fill template with repro, env, evidence
3. POST to GitHub API → create issue
4. Store IssueLink with bidirectional reference
5. GitHub webhook: issue closed
6. Update TestCaseInstance → status "retest_required"
7. Notify assignee → re-execute test
8. New evidence → update IssueLink
9. Track resolution time for metrics
```

### Flow 4: Release Quality Gate

```
1. Maintainer creates Release
2. Evaluate quality gates:
   - All critical tests passing?
   - Coverage thresholds met?
   - No blocking issues open?
   - Required sign-offs complete?
3. If fail: block release, notify team
4. If pass: mark release as "ready"
5. Generate AI release notes (changes + known issues)
6. Optional: Export audit bundle for compliance
7. Send notifications (Slack, email)
```

## Deployment Architecture

### Recommended Setup

**Hosting:**
- **Frontend + API**: Vercel (Next.js optimized, edge functions)
- **Database**: Neon or PlanetScale (serverless Postgres)
- **Background Jobs**: Vercel cron or Trigger.dev
- **File Storage**: AWS S3 or Cloudflare R2 (evidence attachments)

**Alternative Split Architecture:**
- Frontend: Vercel
- Backend API: Fly.io or Render (long-running processes)
- DB: Same as above
- Benefits: Better control over background jobs, websockets

**Environment Variables:**
```bash
# Database
DATABASE_URL=postgresql://...
SHADOW_DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://betaops.example.com
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# GitHub App
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=...
GITHUB_WEBHOOK_SECRET=...

# AI Providers
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

# Observability
SENTRY_DSN=...
OTEL_EXPORTER_OTLP_ENDPOINT=...

# Notifications
SLACK_WEBHOOK_URL=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...

# Storage
AWS_S3_BUCKET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

**Terraform/Pulumi IaC:**
- Provision PostgreSQL database
- Configure Vercel project + env vars
- Set up S3 bucket with lifecycle policies
- Create Sentry project
- Configure DNS and SSL

### Performance Considerations

**Database:**
- Indexes on foreign keys and common filters
- Materialized views for analytics queries
- Connection pooling (PgBouncer)
- Query optimization (avoid N+1, use includes)

**API:**
- tRPC batching for multiple queries
- Response caching where appropriate
- Background jobs for AI generation
- Webhook queue for GitHub events

**Frontend:**
- Code splitting and lazy loading
- Optimistic UI updates
- Infinite scroll for large lists
- Image optimization (Next.js Image)

## Development Workflow

**Local Setup:**
```bash
# Install dependencies
npm install

# Setup database
docker-compose up -d postgres
npx prisma migrate dev
npx prisma db seed

# Start dev server
npm run dev
```

**Testing:**
```bash
# Unit tests
npm run test

# E2E tests (Playwright)
npm run test:e2e

# Type checking
npm run type-check

# Linting
npm run lint
```

**CI/CD:**
```yaml
# GitHub Actions
- Lint & type check
- Run unit tests
- Run E2E tests
- Build preview deployment (Vercel)
- Run security scan (Snyk)
- Deploy to production (on main merge)
```

## Future Enhancements

**Phase 2:**
- Browserstack/SauceLabs integration for cross-browser testing
- Mobile app for tester checklists
- Advanced AI: defect deduplication with embeddings
- Feature flag integration (LaunchDarkly)
- Lighthouse CI for performance smoke tests
- Real-time collaboration (websockets)

**Phase 3:**
- Visual regression testing
- API contract testing
- Load testing integration
- Multi-tenant SaaS mode
- White-label options
- Advanced analytics and ML insights

## Key Design Decisions

1. **Monorepo vs Split**: Monorepo (Next.js full-stack) for simplicity, easy to split later
2. **tRPC vs REST**: tRPC for type-safety and DX, OpenAPI docs can be generated
3. **Prisma**: Best TypeScript ORM, great migrations, type-safe queries
4. **shadcn/ui**: Composable, customizable, no runtime overhead
5. **AI Abstraction**: Provider-agnostic to avoid vendor lock-in
6. **Compliance Mode**: Toggle, not separate codebase, for flexibility
7. **GitHub App**: Better than OAuth app for org-wide installs, fine-grained permissions
8. **Audit Trail**: Immutable events, not soft deletes, for compliance
9. **Evidence Storage**: S3-compatible, separate from DB for scalability
10. **Background Jobs**: Start with Vercel cron, migrate to queue if needed

---

**Document Version**: 1.0
**Last Updated**: 2025-10-30
**Maintainer**: BetaOps Team
