# BetaOps Demo Script

Complete walkthrough demonstrating all core features of BetaOps.

**Duration**: ~20 minutes  
**Audience**: Developers, QA leads, Product managers

---

## Pre-Demo Setup

### 1. Ensure Services Running

```bash
# Start development server
npm run dev

# Verify database connection
npx prisma studio
```

### 2. Open Browser Tabs

- **Tab 1**: BetaOps App (`http://localhost:3000`)
- **Tab 2**: GitHub Repository (demo repo)
- **Tab 3**: Prisma Studio (for behind-the-scenes view)

### 3. Test Credentials

```
Email: alice@betaops.dev
Password: password123
```

---

## Demo Flow

### Part 1: Introduction & Overview (3 minutes)

#### What is BetaOps?

> "BetaOps is an AI-assisted beta testing platform that helps development teams manage testing across projects of any complexity—from simple SPAs to regulated, HIPAA-compliant systems."

#### Key Value Props

1. **AI-Powered Test Generation**: Automatically generate test cases from code changes
2. **GitHub Integration**: Bidirectional sync with issues, PRs, and commits
3. **Compliance Ready**: Built-in audit trails, e-signatures, quality gates
4. **Flexible**: Works for solo devs and teams; simple and complex projects

---

### Part 2: Simple SPA Project (7 minutes)

#### Navigate to ShopFast Project

1. **Sign in** as alice@betaops.dev
2. Click **"ShopFast - E-commerce Platform"**

#### Explore Project Dashboard

> "This is our simple e-commerce SPA. Let me show you the structure."

**Point Out**:
- Project metadata (risk level: MEDIUM, no regulatory regime)
- Team members (Owner, Maintainer, Testers)
- Environments (dev, staging, production)
- Activity feed

#### Feature Tree

1. Click **"Features"** tab
2. Show hierarchical structure:
   - Product Catalog
   - Shopping Cart ← **Expand this**
     - Add to Cart (child)
     - Update Quantity (child)
   - User Authentication
   - Checkout Process

> "Features are organized hierarchically with risk levels. Higher risk features get more testing attention."

#### Test Artifacts

1. Click **"Test Artifacts"** tab
2. Show mix of:
   - AI-generated user stories
   - AI-generated test cases
   - Manual test cases

**Demo AI Generation**:
1. Click **"Generate with AI"** button
2. Select type: "User Stories"
3. Select feature: "Product Catalog"
4. Click **Generate**
5. Watch AI create 3-5 user stories

> "The AI analyzes your project context, features, and regulatory requirements to generate relevant test artifacts."

#### Test Cycle Execution

1. Click **"Test Cycles"** tab
2. Open **"Sprint 12 - Cart & Checkout"** (in progress)
3. Show Kanban board:
   - **To Do**: Pending tests
   - **In Progress**: Currently executing ← **Click into one**
   - **Passed**: Completed successfully
   - **Failed**: Issues found

**Execute a Test**:
1. Click a "To Do" test case
2. Review test steps
3. Click **"Start Test"**
4. Click **"Mark as Passed"**
5. Add execution notes: "All steps verified. Cart updates correctly."
6. Upload evidence (mock screenshot)

> "Testers can execute tests with AI assistance, attach evidence, and mark status—all tracked in the audit log."

#### GitHub Issue Creation

1. Open a "Failed" test (or mark current as failed)
2. Click **"Create GitHub Issue"**
3. Pre-filled template appears with:
   - Reproduction steps
   - Environment info
   - Test cycle details
   - Evidence links
4. Click **"Create Issue"**
5. Show issue created in GitHub
6. Back in BetaOps, issue link appears

> "Failed tests can instantly become GitHub issues. When the issue is closed, we'll notify the tester to re-run the test."

---

### Part 3: Regulated HIPAA Project (7 minutes)

#### Switch to MedConnect Project

1. Go back to dashboard
2. Click **"MedConnect - Patient Portal"**

#### Highlight Compliance Features

> "This is a HIPAA-compliant healthcare platform. Notice the differences..."

**Point Out**:
- **Regulatory Regime**: HIPAA
- **Risk Level**: CRITICAL
- **Compliance Mode**: ON ✓

#### Compliance Configuration

1. Click **"Settings"** → **"Compliance"**
2. Show settings:
   - ✓ Dual sign-off required
   - ✓ Segregation of duties
   - ✓ Evidence retention: 7 years
   - ✓ PII redaction: Required
   - ✓ Full audit trail

> "Compliance mode enforces strict controls required for regulated industries."

#### Critical Features

1. Click **"Features"**
2. Show all marked as **HIGH** or **CRITICAL** risk:
   - Patient Authentication (MFA)
   - Medical Records Access
   - Secure Messaging
   - Appointment Scheduling

#### Security Test Execution

1. Click **"Test Cycles"** → **"Q1 2024 Security Audit"** (completed)
2. Open **"Verify PHI data is encrypted at rest"**
3. Show:
   - ✓ Status: PASSED
   - Environment snapshot captured
   - Detailed execution notes
   - Electronic sign-off with attestation ← **Key Feature**

**Electronic Sign-Off**:
```
"I attest that this test was executed according to the test plan 
and all results are accurate. PHI data encryption verified."

Signed by: David Brown
Date: 2024-10-28 14:30:00 UTC
Signature: sha256:abc123...
Version: v2.5.0
Environment: production
Commit: f1e2d3c4b5a6
```

> "For regulated systems, we require attestations with cryptographic signatures, timestamps, and environment context—all immutable in the audit log."

#### Audit Bundle Export

1. Click **"Export Audit Bundle"** button
2. Select:
   - ✓ Include evidence
   - ✓ Include audit events
3. Click **"Generate Bundle"**
4. Show JSON output with:
   - Test results
   - Sign-offs
   - Evidence manifest
   - Audit events
   - Digital signature

> "For audits or certifications, export a complete evidence package with cryptographic proof of integrity."

#### Quality Gates

1. Click **"Settings"** → **"Quality Gates"**
2. Show **"HIPAA Compliance Gate"**:
   - All critical tests must pass: 100%
   - Mandatory sign-offs: tester + qa-lead + security-officer
   - No blocking issues

> "Quality gates block production releases until all criteria are met. This cycle passed all gates."

---

### Part 4: GitHub Integration Demo (3 minutes)

#### Show GitHub App Installation

1. Navigate to GitHub repository (demo repo)
2. Show BetaOps app installed

#### Push Event → Test Cycle Generation

> "When you push code, BetaOps analyzes the diff and automatically suggests impacted features and test scope."

**Simulate** (or show previous example):
1. Developer pushes to `main`
2. BetaOps receives webhook
3. Parses commit diff
4. Maps changed files to features
5. Creates **draft test cycle** with suggested tests

> "Maintainers review AI suggestions, adjust scope, and start the cycle."

#### Pull Request Check

1. Show a GitHub PR
2. Point out **"BetaOps Tests"** check:
   - ✓ Passed: 8/8 tests
   - Details link → opens BetaOps cycle

> "PRs show pass/fail status from your latest test cycle. Fail a test, and the check fails too."

#### Issue Sync

1. Open GitHub issue created from BetaOps
2. Show labels: `betaops`, `test-failure`
3. Close the issue in GitHub
4. Go back to BetaOps → test status changed to **"Retest Required"**

> "Bidirectional sync keeps everything in sync. Close an issue, we prompt a retest."

---

### Part 5: AI Features Deep Dive (3 minutes)

#### Test Case Generation

1. Go back to ShopFast project
2. Create a new user story (manually or AI)
3. Click **"Generate Test Cases from Story"**
4. AI creates 5-7 test cases covering:
   - Happy path
   - Edge cases
   - Error handling
   - Accessibility
   - Security

> "AI understands your project's regulatory regime and risk level, tailoring test cases accordingly."

#### Failure Analysis

1. Open a failed test (or simulate)
2. Click **"Analyze Failure with AI"**
3. AI provides:
   - **Summary**: "API endpoint returning 500 error"
   - **Likely Causes**:
     1. Database query timeout (80% likelihood)
     2. Missing authentication (50% likelihood)
   - **Related Commits**: Links to recent code changes
   - **Recommended Actions**: Specific debugging steps

> "AI analyzes error logs, recent commits, and test context to suggest root causes—saving hours of debugging."

#### Weekly Summary

1. Click **"Analytics"** → **"Weekly Summary"**
2. Show AI-generated report:
   - Key metrics with trends
   - Risk hotspots (features with frequent failures)
   - Test coverage gaps
   - Recommended focus areas for next cycle

> "Every week, AI reviews your testing activity and provides actionable insights."

---

### Part 6: Wrap-Up & Q&A (2 minutes)

#### Recap Key Features

1. **AI-Assisted Testing**: Generate user stories, test cases, analyze failures
2. **GitHub Integration**: Webhooks, issue sync, PR checks
3. **Compliance Ready**: Audit trails, e-signatures, quality gates, export bundles
4. **Flexible**: Simple SPAs to regulated enterprise systems

#### Deployment & Getting Started

> "BetaOps is open source and deploys to Vercel, Railway, or any Node.js host."

**Quick Start**:
```bash
git clone https://github.com/your-org/betaops.git
cd betaops
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

> "Seed data includes these two demo projects. Sign in and explore!"

#### Resources

- **Docs**: See `BETAOPS_ARCHITECTURE.md` and `DEPLOYMENT.md`
- **GitHub**: [github.com/your-org/betaops](https://github.com/your-org/betaops)
- **Questions**: Open an issue or join our Discord

---

## Demo Tips

### Do's
- ✅ Walk through features slowly—AI generation is impressive
- ✅ Show contrast between simple SPA and HIPAA project
- ✅ Highlight audit trail for compliance use cases
- ✅ Emphasize time saved with AI test generation
- ✅ Show GitHub integration—developers love it

### Don'ts
- ❌ Rush through sign-offs and compliance features
- ❌ Skip showing AI generation live
- ❌ Forget to emphasize flexibility (works for all project sizes)
- ❌ Overcomplicate—keep it simple and practical

### Common Questions

**Q: "How much does AI cost?"**  
A: ~$0.01-0.03 per test case with OpenAI. Local models are free but slower.

**Q: "Does this replace manual testing?"**  
A: No, it assists and automates tedious parts. Testers still execute and validate.

**Q: "What about non-web projects?"**  
A: Adaptable. Works for APIs, mobile, desktop. GitHub integration is flexible.

**Q: "Is this HIPAA/SOC2 compliant?"**  
A: BetaOps helps YOU achieve compliance by providing audit trails and controls. Actual compliance depends on your deployment and processes.

**Q: "Can we customize AI prompts?"**  
A: Yes! Prompt templates are in `src/lib/ai/safety.ts`. Easy to adjust.

---

## Post-Demo Follow-Up

### Send Attendees

1. **GitHub Repo**: Link to clone and try
2. **Deployment Guide**: `DEPLOYMENT.md`
3. **Architecture Docs**: `BETAOPS_ARCHITECTURE.md`
4. **Demo Recording**: If recorded

### Next Steps

- Install on their projects
- Schedule 1:1 for custom setup
- Join community Discord
- Star the repo ⭐

---

**Demo Version**: 1.0  
**Last Updated**: 2025-10-30  
**Feedback**: demo-feedback@betaops.dev
