# Contributing to BetaOps

Thank you for your interest in contributing to BetaOps! This guide will help you get started.

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build great software together.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/your-org/betaops/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Screenshots if applicable

### Suggesting Features

1. Check [Issues](https://github.com/your-org/betaops/issues) for existing requests
2. Create a new issue with:
   - Clear use case
   - Expected behavior
   - Why it's valuable
   - Mockups or examples if applicable

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**:
   - Follow the code style (Prettier + ESLint)
   - Add tests for new features
   - Update documentation if needed
   - Ensure all tests pass

4. **Commit your changes**:
   ```bash
   git commit -m "feat: add amazing feature"
   ```
   
   Use conventional commits:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation
   - `style:` - Code style (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance

5. **Push to your fork**:
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Open a Pull Request**:
   - Describe what changed and why
   - Link related issues
   - Add screenshots for UI changes

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Git

### Local Setup

```bash
# Clone your fork
git clone https://github.com/your-username/betaops.git
cd betaops

# Add upstream remote
git remote add upstream https://github.com/your-org/betaops.git

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your config

# Set up database
docker-compose up -d postgres
npm run db:migrate
npm run db:seed

# Start dev server
npm run dev
```

### Development Workflow

```bash
# Run tests
npm run test

# Type check
npm run type-check

# Lint
npm run lint

# Format code
npm run format

# Run all checks
npm run validate
```

### Project Structure

```
betaops/
├── prisma/               # Database schema & migrations
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   └── (site)/       # Pages
│   ├── components/       # React components
│   ├── lib/              # Utilities
│   │   ├── ai/           # AI provider abstraction
│   │   ├── github/       # GitHub integration
│   │   └── trpc/         # tRPC client
│   ├── server/           # Backend
│   │   └── trpc/         # tRPC routers & context
│   ├── types/            # TypeScript types
│   └── utils/            # Helper functions
├── public/               # Static assets
└── docs/                 # Documentation
```

## Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (runs on commit)
- **Linting**: ESLint
- **Components**: Functional with hooks
- **Imports**: Absolute imports with `@/`

### Example Component

```typescript
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
}

export function FeatureList({ projectId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const { data: features, isLoading } = trpc.features.list.useQuery({
    projectId,
  });
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div className="space-y-2">
      {features?.map((feature) => (
        <div
          key={feature.id}
          onClick={() => setSelectedId(feature.id)}
          className="p-4 border rounded-lg cursor-pointer hover:bg-accent"
        >
          {feature.name}
        </div>
      ))}
    </div>
  );
}
```

## Testing

### Unit Tests

```typescript
// features.test.ts
import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/utils";

describe("slugify", () => {
  it("converts string to slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  
  it("handles special characters", () => {
    expect(slugify("Test @ #123")).toBe("test-123");
  });
});
```

### E2E Tests

```typescript
// features.spec.ts
import { test, expect } from "@playwright/test";

test("can create a feature", async ({ page }) => {
  await page.goto("/projects/test-project/features");
  
  await page.click('button:has-text("New Feature")');
  await page.fill('input[name="name"]', "Test Feature");
  await page.click('button:has-text("Create")');
  
  await expect(page.locator('text="Test Feature"')).toBeVisible();
});
```

## Database Changes

### Creating Migrations

```bash
# Create migration
npx prisma migrate dev --name add_feature_tags

# Apply migration
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset
```

### Schema Guidelines

- Use descriptive model names (PascalCase)
- Add indexes for foreign keys
- Use enums for fixed value sets
- Include `createdAt` and `updatedAt` timestamps
- Add comments for complex fields

## Documentation

- Update `README.md` for user-facing changes
- Update `BETAOPS_ARCHITECTURE.md` for architectural changes
- Add JSDoc comments for complex functions
- Update API documentation for new endpoints

## Release Process

1. Version bump in `package.json`
2. Update `CHANGELOG.md`
3. Create Git tag: `git tag v1.x.x`
4. Push tag: `git push --tags`
5. GitHub Actions will create release

## Questions?

- Open a [Discussion](https://github.com/your-org/betaops/discussions)
- Join our [Discord](https://discord.gg/betaops)
- Email: dev@betaops.dev

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
