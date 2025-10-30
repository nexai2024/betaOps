# Multi-Tenancy in BetaOps

BetaOps is built with **multi-tenancy** from the ground up, allowing multiple organizations to use the platform with complete data isolation and independent workflows.

---

## Architecture Overview

### Organization Hierarchy

```
Organization (Tenant)
  ├─ Members (Users with roles)
  ├─ Projects
  │   ├─ Features
  │   ├─ Test Artifacts
  │   ├─ Test Cycles
  │   └─ Team Members
  ├─ Settings
  └─ Subscription/Plan
```

### Key Concepts

**Organization**: The top-level tenant entity. Each organization has:
- Unique slug for URLs
- Members with roles (Owner, Admin, Member, Guest)
- Projects that belong exclusively to that organization
- Independent settings and configurations
- Subscription plan with limits

**Organization Member**: Links users to organizations with a specific role:
- **Owner**: Full control, can delete organization
- **Admin**: Manage members, settings, projects
- **Member**: Create and work on projects
- **Guest**: Read-only access

**Current Organization**: Each user has a "current organization" that determines which organization's data they see. Users can switch between organizations they belong to.

---

## Data Model

### Core Models

```prisma
model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  plan        String   @default("free") // free, pro, enterprise
  planLimits  Json?    // Storage, projects, users limits
  settings    Json?
  
  members     OrganizationMember[]
  projects    Project[]
}

model OrganizationMember {
  id             String           @id
  organizationId String
  userId         String
  role           OrganizationRole // OWNER, ADMIN, MEMBER, GUEST
  
  organization   Organization @relation(...)
  user           User         @relation(...)
  
  @@unique([organizationId, userId])
}

model User {
  id                    String  @id
  currentOrganizationId String? // Active organization
  
  organizationMemberships OrganizationMember[]
  currentOrganization     Organization?
}

model Project {
  id             String  @id
  organizationId String  // Belongs to organization
  
  organization   Organization @relation(...)
}
```

---

## API & Data Isolation

### tRPC Context

Every API request includes the current organization:

```typescript
export const createTRPCContext = async (opts) => {
  const session = await getSession(opts);
  
  // Get user's current organization
  let organizationId = null;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currentOrganizationId: true },
    });
    organizationId = user?.currentOrganizationId;
  }
  
  return {
    session,
    organizationId, // ← Current organization
    prisma,
  };
};
```

### Automatic Filtering

All queries are automatically filtered by organization:

```typescript
// ✅ Correct: Filtered by organization
const projects = await prisma.project.findMany({
  where: {
    organizationId: ctx.organizationId, // ← Automatic isolation
    archivedAt: null,
  },
});

// ❌ Wrong: Would leak data across organizations
const projects = await prisma.project.findMany({
  where: { archivedAt: null },
});
```

### Middleware Protection

```typescript
const isAuth = t.middleware(({ ctx, next }) => {
  // Require authentication
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  
  // Require organization selection
  if (!ctx.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No organization selected",
    });
  }
  
  return next({ ctx });
});
```

---

## User Workflows

### 1. First-Time User

```
1. Sign up / Sign in
2. No organizations → Prompt to create one
3. Create organization (becomes Owner)
4. Organization set as current
5. → Proceed to create projects
```

### 2. Invited User

```
1. Receive invitation email
2. Sign up / Sign in
3. Accept invitation → Join organization
4. Organization set as current
5. → Access shared projects
```

### 3. Multi-Organization User

```
1. Sign in
2. See organization selector (top nav)
3. Switch organization → Updates currentOrganizationId
4. All data filtered to selected organization
5. Can switch anytime
```

---

## API Endpoints

### Organizations

```typescript
// List organizations user belongs to
trpc.organizations.list.useQuery();

// Get current organization details
trpc.organizations.getCurrent.useQuery();

// Switch to different organization
trpc.organizations.switch.useMutation({
  organizationId: "org_123",
});

// Create new organization
trpc.organizations.create.useMutation({
  name: "My Company",
  slug: "my-company",
  description: "...",
});

// Invite member
trpc.organizations.inviteMember.useMutation({
  organizationId: "org_123",
  email: "user@example.com",
  role: "MEMBER",
});

// Update member role
trpc.organizations.updateMemberRole.useMutation({
  organizationId: "org_123",
  userId: "user_456",
  role: "ADMIN",
});

// Remove member
trpc.organizations.removeMember.useMutation({
  organizationId: "org_123",
  userId: "user_456",
});
```

### Projects (Scoped to Organization)

```typescript
// List projects in current organization
trpc.projects.list.useQuery();
// → Automatically filtered by ctx.organizationId

// Create project in current organization
trpc.projects.create.useMutation({
  name: "My Project",
  slug: "my-project",
  // organizationId is automatic
});
```

---

## Frontend Implementation

### Organization Selector

```tsx
"use client";

import { trpc } from "@/lib/trpc/client";

export function OrganizationSelector() {
  const { data: current } = trpc.organizations.getCurrent.useQuery();
  const { data: orgs } = trpc.organizations.list.useQuery();
  const switchOrg = trpc.organizations.switch.useMutation();
  
  return (
    <select
      value={current?.id}
      onChange={(e) => {
        switchOrg.mutate({ organizationId: e.target.value });
        window.location.reload(); // Refresh to load new org data
      }}
    >
      {orgs?.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
```

### Protected Routes

```tsx
"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

export function ProtectedLayout({ children }) {
  const router = useRouter();
  const { data: org, isLoading } = trpc.organizations.getCurrent.useQuery();
  
  if (isLoading) return <div>Loading...</div>;
  
  // No organization selected
  if (!org) {
    router.push("/onboarding/create-organization");
    return null;
  }
  
  return <>{children}</>;
}
```

---

## Security Considerations

### 1. Row-Level Security

✅ **Every query must filter by organizationId**
- Prevents cross-organization data leaks
- Enforced by middleware and query structure

### 2. Project Access

✅ **Two-level access control**
- Organization membership (can see organization)
- Project membership (can see project)

```typescript
const project = await prisma.project.findFirst({
  where: {
    id: projectId,
    organizationId: ctx.organizationId, // ← Org-level
    members: {
      some: {
        userId: ctx.session.user.id, // ← Project-level
      },
    },
  },
});
```

### 3. Organization Switching

✅ **Verify membership before switching**

```typescript
const membership = await prisma.organizationMember.findUnique({
  where: {
    organizationId_userId: {
      organizationId: input.organizationId,
      userId: ctx.session.user.id,
    },
  },
});

if (!membership) {
  throw new TRPCError({ code: "FORBIDDEN" });
}
```

---

## Subscription Plans

### Plan Limits

Each organization has a plan with limits:

```typescript
interface PlanLimits {
  maxProjects: number;
  maxUsers: number;
  maxStorageGB: number;
  maxAIGenerationsPerMonth: number;
  features: string[];
}

const PLANS = {
  free: {
    maxProjects: 1,
    maxUsers: 3,
    maxStorageGB: 1,
    maxAIGenerationsPerMonth: 50,
    features: ["basic_testing"],
  },
  pro: {
    maxProjects: 10,
    maxUsers: 25,
    maxStorageGB: 50,
    maxAIGenerationsPerMonth: 1000,
    features: ["basic_testing", "ai_generation", "github_integration"],
  },
  enterprise: {
    maxProjects: -1, // unlimited
    maxUsers: -1,
    maxStorageGB: 1000,
    maxAIGenerationsPerMonth: -1,
    features: ["all"],
  },
};
```

### Enforcing Limits

```typescript
// Before creating a project
const projectCount = await prisma.project.count({
  where: { organizationId: ctx.organizationId },
});

const org = await prisma.organization.findUnique({
  where: { id: ctx.organizationId },
});

const limits = org.planLimits as PlanLimits;

if (projectCount >= limits.maxProjects) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Project limit reached. Upgrade your plan.",
  });
}
```

---

## Migration Guide

### Existing Single-Tenant to Multi-Tenant

If upgrading from a single-tenant system:

```sql
-- 1. Add organization
INSERT INTO "Organization" (id, name, slug, plan)
VALUES ('default-org', 'Default Organization', 'default', 'free');

-- 2. Link all projects to organization
UPDATE "Project"
SET "organizationId" = 'default-org';

-- 3. Create organization memberships for all users
INSERT INTO "OrganizationMember" ("organizationId", "userId", "role")
SELECT 'default-org', id, 'OWNER'
FROM "User";

-- 4. Set current organization for all users
UPDATE "User"
SET "currentOrganizationId" = 'default-org';
```

---

## Testing Multi-Tenancy

### Unit Tests

```typescript
describe("Multi-tenancy", () => {
  it("should isolate data by organization", async () => {
    const org1 = await createOrganization({ name: "Org 1" });
    const org2 = await createOrganization({ name: "Org 2" });
    
    const project1 = await createProject({ organizationId: org1.id });
    const project2 = await createProject({ organizationId: org2.id });
    
    // User in org1 should only see org1 projects
    const ctx1 = { organizationId: org1.id };
    const projects = await trpc.projects.list({ ctx: ctx1 });
    
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(project1.id);
  });
});
```

### E2E Tests

```typescript
test("organization switching", async ({ page }) => {
  await page.goto("/");
  await login(page, "user@example.com");
  
  // Switch organization
  await page.click('[data-testid="org-selector"]');
  await page.click('text="Org 2"');
  
  // Verify projects changed
  await expect(page.locator("text=Org 2 Project")).toBeVisible();
  await expect(page.locator("text=Org 1 Project")).not.toBeVisible();
});
```

---

## Best Practices

### ✅ Do

- Always filter by `organizationId` in queries
- Verify organization membership before switching
- Use middleware to enforce organization context
- Test cross-organization data leakage
- Implement plan limit checks
- Provide clear UI for organization switching

### ❌ Don't

- Trust client-provided organizationId
- Allow organization switching without verification
- Forget to filter by organization in new queries
- Share resources across organizations
- Skip organization checks in middleware

---

## Seed Data

The seed script creates two sample organizations:

```
Acme Corp (acme-corp) - Pro Plan
├─ Alice (Owner)
├─ Bob (Admin)
├─ Carol (Member)
└─ Project: ShopFast E-commerce

HealthTech Solutions (healthtech-solutions) - Enterprise Plan
├─ Alice (Owner)
├─ Bob (Admin)
├─ David (Member)
└─ Project: MedConnect Patient Portal
```

Login as `alice@betaops.dev` and switch between organizations to see multi-tenancy in action.

---

## Future Enhancements

- **White-labeling**: Custom domains per organization
- **Organization analytics**: Usage dashboards
- **Billing integration**: Stripe subscriptions per organization
- **Audit logs**: Organization-level audit trails
- **Data export**: Per-organization data exports
- **Resource quotas**: Real-time quota enforcement
- **Organization templates**: Pre-configured setups

---

**Version**: 1.0  
**Last Updated**: 2025-10-30  
**Maintainer**: BetaOps Team
