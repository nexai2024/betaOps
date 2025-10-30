# BetaOps

> **AI-Assisted Beta Testing Platform for Modern Development Teams**

BetaOps helps individual developers and small software shops manage AI-powered beta testing across projects of any complexity—from simple SPAs to HIPAA-compliant, regulated systems.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748)](https://www.prisma.io/)

---

## ✨ Features

### 🤖 AI-Powered Test Generation
- **Automatic test case creation** from code diffs, user stories, and project context
- **Intelligent failure analysis** with root cause suggestions
- **Weekly insights** highlighting risk hotspots and recommended test scope
- **Powered by Google Gemini** (default) - Also supports OpenAI, Anthropic, or local models (Ollama)

### 🔗 Deep GitHub Integration
- **GitHub App** for seamless repo connection
- **Webhook automation**: Push events trigger suggested test cycles
- **Issue sync**: Create issues from failed tests, bidirectional status updates
- **PR checks**: Show test results directly on pull requests

### 📊 Flexible Project Management
- **Hierarchical feature modeling** with risk levels and tags
- **Multiple test artifact types**: User stories, test cases, charters, acceptance criteria
- **Test cycle management** with version tracking and commit linking
- **Kanban execution board** with real-time status updates

### 🛡️ Compliance & Audit Ready
- **Regulatory regime support**: HIPAA, PCI, GDPR, SOC2, FDA
- **Electronic sign-offs** with cryptographic signatures
- **Quality gates** to block releases on failing critical tests
- **Audit bundle export**: Complete evidence packages for certifications
- **Immutable audit trail** of all actions
- **PII detection and redaction**

### 👥 Team Collaboration
- **Role-based access control**: Owner, Maintainer, Tester, External
- **Test assignments** with environment tracking
- **Evidence attachments**: Screenshots, HAR files, logs
- **Notifications**: Email, Slack, Microsoft Teams
- **Beta tester invites** with NDA acceptance tracking

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- **GitHub Account** (for OAuth and GitHub App)
- **Google Gemini API Key** (free tier available at [Google AI Studio](https://makersuite.google.com/app/apikey))
  - Alternative: OpenAI, Anthropic, or local models

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/betaops.git
cd betaops

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
npm run db:migrate

# Seed sample data (optional)
npm run db:seed

# Start development server
npm run dev
```

Visit `http://localhost:3000` and sign in with:
- **Email**: `alice@betaops.dev`
- **Password**: `password123`

---

## 📖 Documentation

- **[Architecture Overview](./BETAOPS_ARCHITECTURE.md)** - System design, data model, and technical decisions
- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment with Vercel, Railway, Fly.io, or Docker
- **[Demo Script](./DEMO_SCRIPT.md)** - Complete walkthrough of all features
- **[Multi-Tenancy Guide](./MULTI_TENANCY.md)** - Organization management and data isolation
- **[Gemini Setup](./GEMINI_SETUP.md)** - Google Gemini AI configuration and best practices

---

## 🏗️ Tech Stack

### Frontend
- **Next.js 15** (App Router)
- **TypeScript**
- **TailwindCSS** + **shadcn/ui**
- **React Query** (TanStack Query)
- **tRPC** (type-safe API)

### Backend
- **Next.js API Routes**
- **Prisma ORM**
- **PostgreSQL**
- **NextAuth** (GitHub + Email/Password)

### Integrations
- **GitHub App** (webhooks, issues, PRs)
- **OpenAI** / Anthropic (AI generation)
- **Sentry** (error tracking)
- **Slack/Teams** (notifications)

---

## 🎯 Use Cases

### For Solo Developers
- Auto-generate test cases from commits with Google Gemini
- Track testing progress across multiple projects
- Simple setup with free-tier AI included
- Multi-organization support for managing multiple projects

### For Small Teams
- Multi-tenant organization management
- Coordinate testing across team members and projects
- GitHub issue integration keeps everything in sync
- AI assists with test planning and failure analysis
- Role-based access control (Owner, Admin, Member, Guest)

### For Regulated Industries
- HIPAA, PCI, GDPR compliance support
- Electronic sign-offs and audit trails
- Quality gates prevent non-compliant releases
- Evidence export for certifications

---

## 📊 Sample Projects (Seeded)

### 1. ShopFast - E-commerce SPA
- **Type**: Simple SPA (React/Next.js)
- **Risk Level**: Medium
- **Features**: Product catalog, cart, checkout, auth
- **Test Cycle**: Sprint 12 in progress
- **Demonstrates**: Basic testing workflow, AI generation, GitHub integration

### 2. MedConnect - Patient Portal
- **Type**: HIPAA-compliant healthcare platform
- **Risk Level**: Critical
- **Regulatory Regime**: HIPAA
- **Features**: Patient auth (MFA), medical records, secure messaging
- **Test Cycle**: Q1 2024 security audit (completed)
- **Demonstrates**: Compliance mode, electronic sign-offs, audit export, quality gates

---

## 🔐 Security & Privacy

- **Row-level security** via project membership
- **Encrypted sensitive data** (tokens, PII)
- **Audit logging** of all privileged actions
- **Content moderation** and prompt injection guards
- **Rate limiting** (100 req/min/user)
- **OAuth scopes**: Minimal required permissions

---

## 🗺️ Roadmap

### Phase 1 (Current)
- [x] Core test management
- [x] GitHub integration
- [x] AI test generation
- [x] Compliance mode
- [x] Audit trails

### Phase 2 (Q2 2024)
- [ ] Browserstack/SauceLabs integration
- [ ] Mobile app for testers
- [ ] Advanced AI: defect deduplication with embeddings
- [ ] Feature flag integration (LaunchDarkly)
- [ ] Lighthouse CI for performance

### Phase 3 (Q3 2024)
- [ ] Visual regression testing
- [ ] API contract testing
- [ ] Load testing integration
- [ ] Multi-tenant SaaS mode
- [ ] White-label options

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Install dependencies
npm install

# Run tests
npm run test

# Type check
npm run type-check

# Lint
npm run lint

# Format
npm run format
```

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Next.js Team** for the amazing framework
- **Prisma** for type-safe database access
- **shadcn/ui** for beautiful, accessible components
- **tRPC** for end-to-end type safety
- **OpenAI & Anthropic** for AI capabilities

---

## 📧 Contact & Support

- **Documentation**: [betaops.dev/docs](https://betaops.dev/docs)
- **GitHub Issues**: [github.com/your-org/betaops/issues](https://github.com/your-org/betaops/issues)
- **Discord**: [discord.gg/betaops](https://discord.gg/betaops)
- **Email**: [support@betaops.dev](mailto:support@betaops.dev)

---

## ⭐ Show Your Support

If BetaOps helps you ship better software, give it a ⭐️ on GitHub!

---

**Built with ❤️ by developers, for developers.**

*Last Updated: 2025-10-30 | Version: 1.0.0*
