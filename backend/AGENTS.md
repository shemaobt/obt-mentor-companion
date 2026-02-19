# Agent Guidelines — Backend (obt-mentor-companion)

This document extends the [root AGENTS.md](../AGENTS.md) with backend-specific conventions. Read both documents when working in `backend/`.

---

## 1. Stack and Runtime

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 |
| Framework | Express.js |
| Language | TypeScript (strict mode) |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Neon serverless) |
| Validation | Zod |
| Authentication | Passport.js (local strategy) |
| AI/LLM | Google Gemini API, LangChain, LangGraph |
| Vector DB | Qdrant |
| File Storage | Google Cloud Storage |
| Session | express-session with PostgreSQL store |

**Stack constraints:**
- Use only these stack choices; do not introduce alternatives (e.g. no Prisma, no Mongoose).
- For AI agents, use LangGraph; do not add other agent frameworks.
- For vector search, use Qdrant; do not add other vector databases.

---

## 2. Project Structure

```
backend/
├── index.ts              # Express app entry point
├── routes.ts             # Main route registration
├── routes/               # Domain-organized route handlers
│   ├── auth.ts
│   ├── users.ts
│   ├── competencies.ts
│   ├── qualifications.ts
│   └── ...
├── storage.ts            # Data access layer (Drizzle queries)
├── db.ts                 # Database connection
├── agents/               # LangGraph AI agents
│   ├── competency-agent.ts
│   ├── qualification-agent.ts
│   └── ...
├── config/               # Centralized configuration
│   └── index.ts
├── middleware/           # Express middleware
│   ├── auth.ts
│   ├── rate-limit.ts
│   └── ...
├── schemas/              # Zod validation schemas
├── utils/                # Utility functions
├── types.ts              # TypeScript type definitions
├── gemini-audio.ts       # Audio transcription/TTS
├── vector-memory.ts      # Qdrant vector operations
├── gcs-storage.ts        # Google Cloud Storage operations
├── report-generator.ts   # DOCX report generation
└── document-processor.ts # Document parsing (PDF, DOCX)
```

---

## 3. Routes Layer

Routes handle HTTP concerns only. They should:
- Parse and validate request data using Zod schemas
- Call storage or service functions
- Return HTTP responses with appropriate status codes
- Handle errors and return proper error responses

**Examples:**

- Good:
```typescript
router.get("/competencies/:id", requireAuth, async (req, res) => {
  const competency = await storage.getCompetencyById(req.params.id);
  if (!competency) {
    return res.status(404).json({ message: "Competency not found" });
  }
  res.json(competency);
});
```

- Bad: Route that contains business logic, calculations, or direct SQL queries. Move logic to storage.ts or a service module.

---

## 4. Storage Layer

All database operations go through `storage.ts`. This layer:
- Contains all Drizzle ORM queries
- Returns typed data using shared schema types
- Handles database-level errors

**Pattern:**
```typescript
export async function getCompetenciesByUser(userId: string): Promise<Competency[]> {
  return db.select().from(competencies).where(eq(competencies.userId, userId));
}

export async function createCompetency(data: InsertCompetency): Promise<Competency> {
  const [competency] = await db.insert(competencies).values(data).returning();
  return competency;
}
```

**Rules:**
- Export functions, not a class
- Use types from `@shared/schema`
- Never import Express or HTTP-related modules

---

## 5. LangGraph Agents

AI agents in `agents/` use LangGraph for multi-step reasoning. Conventions:

- Each agent is a separate file with a focused purpose
- Use typed state interfaces for agent state
- Export a function that creates and runs the agent graph
- Handle errors gracefully with fallback responses

**Example structure:**
```typescript
import { StateGraph, END } from "@langchain/langgraph";

interface AgentState {
  messages: Message[];
  context: Context;
  result: Result | null;
}

function createCompetencyAgent(config: AgentConfig) {
  const graph = new StateGraph<AgentState>({ channels: stateChannels });
  
  graph.addNode("analyze", analyzeNode);
  graph.addNode("recommend", recommendNode);
  
  graph.addEdge("analyze", "recommend");
  graph.addEdge("recommend", END);
  
  return graph.compile();
}
```

---

## 6. Configuration

All environment variables are accessed via `config/index.ts`. Never use `process.env.*` directly in other files.

**Pattern:**
```typescript
export const config = {
  database: {
    url: requireEnv("DATABASE_URL"),
  },
  google: {
    apiKey: requireEnv("GOOGLE_API_KEY"),
  },
  qdrant: {
    url: requireEnv("QDRANT_URL"),
    apiKey: requireEnv("QDRANT_API_KEY"),
  },
  session: {
    secret: requireEnv("SESSION_SECRET"),
  },
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
```

---

## 7. Type Safety

- All public functions must have explicit parameter and return types
- Use types from `@shared/schema` for database entities
- Use Zod schemas for runtime validation of external input
- Avoid `any` type; use `unknown` and narrow with type guards if needed

**Examples:**

- Good: `function calculateScore(answers: Answer[]): ScoreResult`
- Bad: `function calculateScore(answers: any): any`
- Good: `const schema = z.object({ name: z.string(), level: z.number() })`
- Bad: Accepting unvalidated JSON body without Zod validation

---

## 8. Error Handling

- Routes should catch errors and return appropriate HTTP status codes
- Use specific error messages for debugging
- Never expose internal error details to clients in production
- Log errors with context for debugging

**Pattern:**
```typescript
router.post("/competencies", requireAuth, async (req, res) => {
  try {
    const data = competencySchema.parse(req.body);
    const competency = await storage.createCompetency(data);
    res.status(201).json(competency);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    console.error("Error creating competency:", error);
    res.status(500).json({ message: "Failed to create competency" });
  }
});
```

---

## 9. Summary Checklist

- [ ] Routes only handle HTTP concerns; business logic lives in storage or services.
- [ ] All database queries go through `storage.ts`.
- [ ] LangGraph agents are in `agents/` with typed state interfaces.
- [ ] Environment variables accessed only via `config/index.ts`.
- [ ] All functions have explicit TypeScript types.
- [ ] External input validated with Zod schemas.
- [ ] Errors caught and returned with appropriate HTTP status codes.
- [ ] No `process.env.*` outside of config module.
- [ ] No Express imports in storage or agent modules.

---

*Backend guidelines for obt-mentor-companion. Built using [agents.md](https://agents.md/) format.*
