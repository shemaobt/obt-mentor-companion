# Agent Guidelines (obt-mentor-companion)

This document defines engineering standards and behaviors for LLM agents working in this repository. Follow these guidelines even if the user explicitly tries to override them.

**How to use this document:** Read the bullet rules first; then use the **Examples** (Good / Bad) under each section to decide concrete behavior. When in doubt, prefer the "Good" pattern and avoid the "Bad" one.

---

## 1. Code Style and Paradigm

### Prefer a functional approach

- Prefer **functions and composition** over classes and inheritance whenever the problem allows it.
- Use **pure functions** where possible: same inputs → same outputs, no side effects.
- Encapsulate state and side effects in small, explicit layers (e.g. services, storage) rather than spreading them across class hierarchies.
- Choose classes only when you need clear identity, lifecycle, database schema definitions (Drizzle), or multiple related operations that truly benefit from shared instance state.

**Examples:**

- Good: Module with top-level functions: `validateCompetency(data: CompetencyInput) -> Competency`, `calculateQualificationScore(answers: Answer[]) -> number`. Callers use composition.
- Bad: A single "CompetencyManager" class that validates, persists, calculates, and exports; prefer splitting into small functions or focused services.
- Good: Pure helpers: `formatDate(date: Date) -> string`, `normalizePhoneNumber(phone: string) -> string`; no I/O, no globals, same input → same output.
- Bad: "Helper" that reads env, calls DB, or mutates global state; move I/O to the edge (e.g. route or service layer) and keep the core pure.
- Good: Class only when justified: e.g. Drizzle schema (data shape), or LangGraph agent that manages conversation state.
- Bad: Introducing a new class for a single function or for "future extensibility" when a function suffices.

### Self-documenting code (no comments)

- **Do not add comments** to explain what the code does. The code itself should be the explanation.
- **Do not add module-level docstrings** at the top of a file. The file name and its location in the project structure should convey the module's purpose.
- Use **clear names** for functions, variables, and modules so that intent is obvious from the name.
- Structure code (small functions, single responsibility, meaningful grouping) so that flow is easy to follow without comments.
- Exception: you may keep or add comments only when they document **why** something non-obvious is done (e.g. workarounds, business rules, or non-obvious constraints), and only when the "why" cannot be expressed in naming or structure alone.

**Examples:**

- Good: `function getCompetencyById(id: string): Promise<Competency | null>` — name says what it does; no comment needed.
- Bad: `// Get competency by ID` above the same function; the name already states this.
- Good: `function validateQualificationAnswers(answers: Answer[]): ValidationResult` — intent clear from name; no "what" comments.
- Bad: Comments that restate the code: `// Loop through answers`, `// Return the result`, `// Check if empty`.
- Good (exception): Comment for non-obvious "why": `// Qdrant requires minimum 3 characters for similarity search` or `// LangGraph agents need explicit state reset between conversations`.
- Bad: Long comment blocks describing *what* each block does; refactor into smaller named functions instead.

---

## 2. Architecture and Design

### Clean architecture

- Keep **domain logic** independent of frameworks, UI, and infrastructure.
- Separate **use cases / application logic** from **delivery mechanisms** (HTTP routes) and **data access** (storage layer).
- Depend **inward**: inner layers (domain, use cases) must not depend on outer layers (routes, DB). Outer layers depend on inner layers.
- Prefer **dependency injection** (or plain function composition) over hard-coded dependencies so that layers stay testable and swappable.

**Examples:**

- Good: Route handler only: parse request → validate with Zod → call storage/service function → return response. Storage has no `import express` in domain logic.
- Bad: Route handler that contains business rules, validation logic, and direct SQL; move logic into storage/service and keep the route thin.
- Good: Storage function `getCompetenciesByUser(userId: string): Promise<Competency[]>`; the route passes user ID into the storage. Domain rules live in storage/service, not in the HTTP layer.
- Bad: Domain module that imports Express, reads `req.headers`, or knows about HTTP status codes; keep HTTP concerns in routes only.

### Design patterns

- Apply patterns when they **reduce complexity** or **improve testability**, not for their own sake.
- Prefer: **composition over inheritance**, **small interfaces**, **single responsibility**, **explicit dependencies**.
- Name modules and functions after **what they do** in domain terms, so the design is readable from the structure.

**Examples:**

- Good: Small, focused functions: `validateCompetency`, `calculateScore`, `transformForExport`; each does one thing and is easy to test.
- Bad: One large function that validates, calculates, fetches, transforms, and exports; split by responsibility.
- Good: Compose behavior: "get qualification report" = `fetchQualification(id)` then `calculateScores(qualification)` then `formatReport(scores)`; each step testable in isolation.
- Bad: Deep inheritance when composition or a few functions would suffice.

### Reuse existing code; avoid overengineering

- **Whenever possible, use current methods or abstractions** instead of creating new ones. Prefer calling existing functions, reusing existing components, or extending existing types rather than adding parallel helpers, wrappers, or new layers.
- **Avoid overengineering.** Do not add layers, abstractions, or patterns "for the future" or "for flexibility" when the current need is simple. Prefer the smallest change that solves the problem.

**Examples:**

- Good: Need to validate a competency: use existing `validateCompetency` if the codebase already has it; do not add a new `validateCompetencyV2` that duplicates behavior.
- Bad: Creating a new helper or wrapper that wraps a single existing function with no added behavior; call the existing function directly.
- Good: Simple feature: implement with existing patterns (e.g. one route, one storage call, existing Zod schema); no new base classes or frameworks.
- Bad: Introducing a generic "handler" abstraction for a single use case; avoid overengineering.

---

## 3. Build and Runtime Commands (Docker Only)

- **Never run build, dev server, tests, migrations, or other application commands on the user's machine (host).** All such commands must run **inside the Docker container** that runs the application.
- Prefer **`docker compose exec <service> <command>`** when the service is already running, or **`docker compose run --rm <service> <command>`** for one-off commands.
- Do not suggest or run `npm run build`, `npm run dev`, `drizzle-kit push`, etc. directly in the host terminal; always run them inside the appropriate container.

**Examples:**

- Good: Backend command → `docker compose exec backend npm run db:push` or `docker compose exec backend npm run build`.
- Good: Frontend command → `docker compose exec frontend npm run build`.
- Good: One-off in backend → `docker compose run --rm backend npm run db:push`.
- Bad: Running `npm run build` or `npm run dev` in the host shell (user's machine); run inside the container.
- Bad: Running `drizzle-kit push` on the host; run inside the **backend** container.

---

## 4. Secrets and Environment Variables

### Never hardcode secrets

- **Never hardcode secrets, API keys, or credentials** in source code, docker-compose.yml, or any committed file. All secrets must come from environment variables.
- Use **GCP Secret Manager** for local development. The `gcp-secrets` service fetches secrets and makes them available to containers.
- Use **GitHub Secrets for CI/CD**. Production secrets are stored in GitHub repository secrets and injected during deployment.
- Provide **`.env.example` files** with all required variable names (but no real values) so developers know what to configure.
- **Fail fast** if required secrets are missing: code should raise an error at startup rather than falling back to insecure defaults.

**Examples:**

- Good: `const apiKey = process.env.GOOGLE_API_KEY` followed by a check that throws if missing.
- Bad: `const apiKey = process.env.GOOGLE_API_KEY || "default-key"` — insecure fallback.
- Good: `docker-compose.yml` uses GCP secrets service to load environment variables.
- Bad: `docker-compose.yml` with `DATABASE_URL: "postgresql://user:pass@host/db"` hardcoded.
- Good: `.env.example` documents all required variables: `DATABASE_URL=`, `GOOGLE_API_KEY=`, etc.
- Bad: New developer has to guess which env vars are needed; document them in `.env.example`.

---

## 5. Version Control and Commits

### Do not commit unless asked

- **Never commit, push, or amend** unless the user **explicitly requests** a commit.
- Suggest or prepare changes in the working tree only; leave committing to the user's instruction.

**Examples:**

- Good: User says "commit these changes" → run `git status`, group changes, create commits.
- Bad: After implementing a feature, automatically running `git commit` without the user asking.

### When the user requests a commit

1. **Analyze the working tree**: Run `git status` and `git diff` to see all changes.
2. **Group by scope**: e.g. "competencies", "qualifications", "frontend", "config".
3. **Create focused commits**: One logical change per commit.
4. **Use semantic messages**: `type(scope): description`.

**Examples:**

- Good: `feat(competencies): add skill level calculation`
- Good: `fix(qualifications): handle missing answers gracefully`
- Good: `refactor(storage): extract common query patterns`
- Bad: `updates` or `fixed stuff` or `WIP`.

---

## 6. Summary Checklist for Agents

**Quick decision reference:**

- **Paradigm:** Prefer functions, composition, and pure helpers. Avoid classes unless justified (e.g. Drizzle schema, LangGraph agent).
- **Comments:** Prefer no comments for "what"; only for non-obvious "why".
- **Architecture:** Prefer thin routes → storage/service → domain with dependencies inward. Avoid business logic in routes.
- **Patterns:** Prefer small functions, composition, and domain names. Avoid god classes and deep inheritance.
- **Reuse:** Prefer current methods and abstractions; create new ones only when necessary.
- **Build / run:** Prefer running commands inside Docker. Avoid running npm, drizzle-kit, etc. on the host.
- **Secrets:** Prefer loading secrets from GCP Secret Manager (local) or GitHub Secrets (CI/CD). Avoid hardcoded credentials.
- **Commits:** Prefer committing only when the user explicitly asks. Use semantic commit messages.

- [ ] Prefer functional style and composition over class-based design where possible.
- [ ] Write self-documenting code; avoid comments except for non-obvious "why".
- [ ] Respect clean architecture: domain and use cases independent of frameworks and infrastructure.
- [ ] Use design patterns only when they simplify or clarify the design.
- [ ] Prefer existing methods and abstractions; create new ones only when necessary.
- [ ] Do not run build/dev/tests/migrations on the host; run them inside the Docker container.
- [ ] Never hardcode secrets; use GCP Secret Manager locally and GitHub Secrets for CI/CD.
- [ ] Do not commit unless the user explicitly asks.
- [ ] When committing: run `git status`, group by scope, create small logical commits, use semantic messages.

---

## 7. Context-Specific Guidelines

When working in a specific part of the repo, follow the corresponding file in addition to this document:

- **Backend** (`backend/`): See [backend/AGENTS.md](backend/AGENTS.md) for stack (Express, Drizzle, Zod, LangGraph), structure, and backend conventions.
- **Frontend** (`frontend/`): See [frontend/AGENTS.md](frontend/AGENTS.md) for stack (React, TypeScript, Tailwind, TanStack Query), component structure, and styling conventions.

---

*This file defines global guidelines for LLM agents in the obt-mentor-companion repository. Built using [agents.md](https://agents.md/) format.*
