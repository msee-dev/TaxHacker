# CLAUDE.md — TaxHacker

## Project Overview

TaxHacker is an AI-powered, self-hostable accounting app for freelancers and small businesses. Built with Next.js 15 (App Router), React 19, TypeScript, Prisma ORM, and PostgreSQL. Supports multiple LLM providers (OpenAI, Google Gemini, Mistral) for automated receipt/invoice analysis.

## Tech Stack

- **Framework**: Next.js 15.2.4 with App Router and Turbopack (dev)
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 19, Radix UI (shadcn/ui "new-york" style), Tailwind CSS 3.4
- **Database**: PostgreSQL 17 via Prisma 6.6 ORM
- **Auth**: Better Auth 1.2 with email OTP
- **AI**: LangChain 0.3 abstracting OpenAI, Google Gemini, Mistral, OpenRouter
- **Payments**: Stripe
- **Email**: Resend
- **File Processing**: Sharp (images), pdf2pic + Ghostscript (PDFs), JSZip
- **Monitoring**: Sentry (optional)

## Quick Commands

```bash
npm run dev          # Start dev server on port 7331 (Turbopack)
npm run build        # Production build
npm run start        # Run migrations + start production server
npm run lint         # ESLint (next lint)
```

## Project Structure

```
app/                    # Next.js App Router pages and API routes
  (app)/                # Protected application routes (dashboard, transactions, settings, etc.)
  (auth)/               # Authentication flows (login, cloud signup, self-hosted setup)
  api/                  # API routes (auth, currency, progress, stripe webhooks)
components/             # React components organized by feature
  ui/                   # shadcn/ui base components (Radix wrappers)
  dashboard/            # Dashboard charts and analytics
  transactions/         # Transaction table, detail views
  settings/             # Settings forms
  files/                # File upload and preview
  unsorted/             # Unprocessed document handling
  agents/               # AI agent UI components
  emails/               # Email templates (React Email)
lib/                    # Shared utilities and configuration
  config.ts             # Zod-validated environment config
  db.ts                 # Prisma client singleton
  auth.ts               # Better Auth setup
  llm-providers.ts      # LLM provider configuration
  files.ts              # File upload/processing helpers
  stripe.ts             # Stripe integration
  email.ts              # Email sending via Resend
models/                 # Database query layer (repository pattern)
  transactions.ts       # Transaction queries (largest file — complex filtering/aggregation)
  categories.ts         # Category management
  projects.ts           # Project management
  fields.ts             # Custom dynamic fields
  files.ts              # File metadata queries
  users.ts              # User queries
  settings.ts           # User settings
  stats.ts              # Analytics/statistics
  export_and_import.ts  # Data import/export
ai/                     # AI integration layer
  analyze.ts            # Main analysis orchestration (server action)
  schema.ts             # JSON schema for structured LLM output
  prompt.ts             # Prompt templates
  providers/            # LLM provider abstraction
forms/                  # Zod form validation schemas
hooks/                  # Custom React hooks
prisma/                 # Database schema and migrations
  schema.prisma         # Prisma schema definition
  migrations/           # Migration history (12 migrations)
public/                 # Static assets
docs/                   # Documentation
```

## Architecture Patterns

- **Server Components + Server Actions**: Data fetching via RSC, mutations via server actions in `models/`
- **Repository/Model layer**: All database queries go through `models/*.ts` files — never call Prisma directly from components
- **Zod validation everywhere**: Environment config (`lib/config.ts`), form schemas (`forms/`), AI output schemas (`ai/schema.ts`)
- **React `cache()`**: Used in models for request-level deduplication
- **Multi-tenancy**: Supports self-hosted (single-user) and cloud SaaS modes, controlled by `SELF_HOSTED_MODE` env var
- **Path alias**: `@/*` maps to project root (e.g., `@/lib/db`, `@/models/transactions`)

## Database

- **ORM**: Prisma with PostgreSQL
- **Schema location**: `prisma/schema.prisma`
- **Key models**: User, Transaction (with line items, multi-currency, custom fields), Category, Project, Field, File, Setting, Currency, Progress
- **Migrations**: Run `npx prisma migrate dev` for development, `prisma migrate deploy` for production
- **After schema changes**: Run `npx prisma generate` to regenerate the client

## Code Style & Conventions

- **Formatting** (Prettier): 2-space indent, no semicolons, double quotes, 120 char line width, trailing commas (ES5)
- **Linting**: ESLint with `next/core-web-vitals` and `next/typescript` (flat config format)
- **Component library**: Use existing shadcn/ui components from `components/ui/` — add new ones via `npx shadcn@latest add <component>`
- **File naming**: kebab-case for files, PascalCase for React components
- **Imports**: Use `@/` path alias for all project imports
- **No test framework**: The project currently has no automated tests

## Environment Variables

Required environment variables (see `.env.example`):

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — (required) |
| `BETTER_AUTH_SECRET` | Auth encryption secret (min 16 chars) | — (required) |
| `SELF_HOSTED_MODE` | Enable self-hosted mode | `true` |
| `PORT` | Server port | `7331` |
| `BASE_URL` | Public URL | `http://localhost:7331` |
| `OPENAI_API_KEY` | OpenAI API key | optional |
| `OPENAI_MODEL_NAME` | OpenAI model | `gpt-4o-mini` |
| `GOOGLE_API_KEY` | Google AI API key | optional |
| `GOOGLE_MODEL_NAME` | Google model | `gemini-2.5-flash` |
| `MISTRAL_API_KEY` | Mistral API key | optional |
| `MISTRAL_MODEL_NAME` | Mistral model | `mistral-medium-latest` |
| `OPENROUTER_API_KEY` | OpenRouter API key | optional |
| `OPENROUTER_MODEL_NAME` | OpenRouter model | `openai/gpt-4o-mini` |
| `RESEND_API_KEY` | Email service key | optional |
| `STRIPE_SECRET_KEY` | Stripe payments key | optional (cloud mode) |

## Deployment

- **Docker**: Multi-stage Dockerfile, builds for `linux/amd64` and `linux/arm64`
- **Docker Compose**: `docker-compose.yml` includes PostgreSQL 17 + app on port 7331
- **System dependencies** (runtime): Ghostscript, GraphicsMagick, libwebp (for PDF/image processing)
- **CI/CD**: GitHub Actions — auto-publish to GHCR on version tags (`v*`) and main branch pushes
- **Startup**: `docker-entrypoint.sh` waits for PostgreSQL, runs migrations, then starts the app

## Common Development Tasks

**Add a new page**: Create route in `app/(app)/your-route/page.tsx` — it's automatically protected by middleware

**Add a database field**: Edit `prisma/schema.prisma`, run `npx prisma migrate dev --name describe-change`, update relevant model in `models/`

**Add a new UI component**: `npx shadcn@latest add <component-name>` — components land in `components/ui/`

**Work with AI analysis**: Core logic is in `ai/analyze.ts` (server action), schemas in `ai/schema.ts`, prompts in `ai/prompt.ts`

**File processing pipeline**: Upload → Sharp/pdf2pic conversion → LLM analysis → Transaction creation. See `lib/files.ts` and `ai/analyze.ts`
