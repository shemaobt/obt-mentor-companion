# Overview

The OBT Mentor Companion is an AI-powered full-stack web application designed for YWAM Oral Bible Translation (OBT) facilitators. It provides mentorship tracking and assessment capabilities through an AI assistant, utilizing OpenAI's Assistant API. Key features include user authentication with admin approval, comprehensive facilitator portfolio management (competencies, qualifications, activities), quarterly report generation with English UI, and global memory search using Qdrant Cloud for semantic search across all facilitator conversations. The project aims to enhance mentorship effectiveness and facilitate cross-learning among facilitators.

## Design System
- **Brand Color**: #86884C (olive-green tone) - RGB(134, 136, 76) - HSL(62, 28%, 42%)
- **UI Framework**: Consistent olive-green palette throughout light and dark modes
- **Typography**: Inter font family with English UI labels
- **Logo System**: Unified white logo icon with theme-colored backgrounds across all 6 themes
  - Single white logo file (`/logo-white.png`) used universally
  - LogoWithBackground component dynamically applies theme colors
  - Favicon automatically updates with theme changes using canvas generation
  - Theme switcher shows white logos on colored backgrounds for all theme previews

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
- **Framework**: React with TypeScript (Vite)
- **UI**: Radix UI primitives with shadcn/ui and Tailwind CSS (light/dark modes)
- **State Management**: TanStack Query
- **Routing**: Wouter

## Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM modules)
- **Development**: tsx
- **Production**: esbuild

## Authentication
- **Provider**: Replit Auth (OpenID Connect)
- **Session Management**: Express sessions with PostgreSQL store, Passport.js
- **Security**: HTTP-only cookies, admin approval for new users.

## Database
- **Database**: PostgreSQL (Neon serverless driver)
- **ORM**: Drizzle ORM
- **Schema Management**: Drizzle Kit

## Data Models
- **Core Entities**: Users, Facilitators, Facilitator Competencies, Facilitator Qualifications, Mentorship Activities, Quarterly Reports, Chats, Messages, Message Attachments.
- **Competencies**: Tracks 11 OBT core competencies with bilingual names and status levels (not_started, emerging, growing, proficient, advanced).

### 11 Core Competencies (Bilingual Framework)
1. **Habilidades Interpessoais / Interpersonal Skills** - Lead team with active listening, empathy, facilitation
2. **Comunicação Intercultural / Intercultural Communication** - Honor cultural codes, adjust communication naturally
3. **Habilidades Multimodais / Multimodal Skills** - Lead oral, embodied process with stories, gestures, objects
4. **Teorias e Processos de Tradução / Translation Theory & Process** - Understand translation methods, prioritize meaning in oral contexts
5. **Línguas e Comunicação / Languages & Communication** - Understand language mechanics, semantics, metaphor, discourse
6. **Línguas Bíblicas / Biblical Languages** - Consult Hebrew/Greek using exegetical tools when needed
7. **Estudos Bíblicos e Teologia / Biblical Studies & Theology** - Bring historical-cultural background and hermeneutics
8. **Planejamento e Garantia de Qualidade / Planning & Quality Assurance** - Transform vision into simple plans with ongoing QA
9. **Consultoria e Mentoria / Consulting & Mentoring** - Serve as servant-leader who teaches by doing
10. **Tecnologia Aplicada / Applied Technology** - Choose and operate tools for orality (recording, AI, collaboration)
11. **Prática Reflexiva / Reflective Practice** - Exercise self-awareness, align actions with values, welcome feedback

## AI Integration

### LangChain Multi-Agent System (Active)

The application uses LangChain/LangGraph for AI-powered mentorship guidance with intelligent competency evaluation:

#### Core System (USE_LANGCHAIN=true)
- **Framework**: LangChain/LangGraph with React Agent pattern
- **Provider**: OpenAI GPT-4o for all agents
- **Agent**: LangGraph `createReactAgent` (modern 2025 approach)
- **Tools**: DynamicStructuredTool with Zod validation (add_qualification, add_activity, update_competency, create_general_experience)
- **Duplicate Detection**: Robust text normalization with Unicode handling, diacritic removal, whitespace collapsing, preserving significant symbols (+, #, .) for technical terms. Returns idempotent success responses to prevent AI retries.
- **Thread Management**: Message history managed by LangGraph
- **Context System**: Enhanced three-layer injection:
    1. **Portfolio Data**: Facilitator profile, competencies, qualifications, activities with two-pillar gap analysis
    2. **Recent Message History**: Last 20 messages with role-based formatting
    3. **Semantic Vector Search**: Qdrant-powered facilitator-specific + global search
- **Vision**: Planned (currently logs attachment awareness)
- **Audio**: Whisper API for transcription
- **Validation**: Requires facilitator profile
- **Intelligent Competency Evaluation**: Automatic scoring based on education (qualifications) and experience (activities) with course-level multipliers and duration weighting

### Shared Infrastructure
- **Global Memory**: Qdrant Cloud vector database for conversation embeddings
- **Semantic Search**: Retrieves relevant past conversations for contextual AI responses
- **Multimodal**: Audio transcription via Whisper API (both systems)
- **Embeddings**: text-embedding-3-small for vector storage (both systems)

## Vector Memory System
- **Provider**: Qdrant Cloud
- **Collection**: obt_global_memory
- **Embeddings**: text-embedding-3-small (1536 dimensions)
- **Search**: Facilitator-specific and global searches for contextual relevance.

## API Design
- **Style**: RESTful
- **Security**: Session-based authentication, CSRF protection, authorization checks (ownership validation).

## Portfolio Management
- **Competencies**: Track progress and update status.
- **Qualifications**: Record formal courses and credentials.
- **Activities**: Log language translation mentorship work.
- **Reports**: Generate, view, and delete quarterly reports. All portfolio sections include English labels.

## User Roles and Permissions

### Three-Tier User System
1. **Admin** - Full system access
   - Access all users (supervised and unsupervised)
   - Manage system prompt and RAG documents
   - Promote users to supervisor status
   - Assign supervisors to users
   - Approve/reject any user
   - View and modify any facilitator profile

2. **Supervisor** - Limited management access
   - View only supervised users (assigned via supervisorId)
   - Approve/reject supervised users pending approval
   - View supervised users' facilitator profiles (competencies, qualifications, activities)
   - Update supervised users' competency levels
   - Download supervised users' quarterly reports
   - Cannot access system prompt or RAG documents
   - Cannot see users they don't supervise

3. **Regular User** - Personal access only
   - Manage own facilitator profile
   - Chat with AI mentor
   - Generate own quarterly reports
   - Can select supervisor during registration

### Supervisor Assignment Flow
- New users can select a supervisor during signup (optional)
- If supervisor is assigned, approval requests go to that supervisor
- Admin can assign/reassign supervisors to existing users
- Admin can promote/demote users to/from supervisor status

## Security Features
- Session-based authentication with HTTP-only cookies.
- Authorization with ownership validation for sensitive operations.
- Hierarchical access control (Admin > Supervisor > User).
- CSRF protection for state-changing endpoints.
- Admin and supervisor-controlled user approval workflow.
- Secure report access (only to owning facilitator or their supervisor/admin).
- One-way database synchronization (production → development) with password security.

## Database Synchronization (Admin Feature)
- **Purpose**: Sync production user data to development environment for testing and development.
- **Direction**: One-way only (production → development), never writes back to production.
- **Scope**: Syncs `users` and `facilitators` tables only. Does NOT sync chats, messages, documents, or vector memory.
- **Security**: 
  - Production passwords are NEVER copied to development
  - New synced users receive random unusable password hashes
  - Existing users with production hashes are automatically remediated on sync
  - Admin-only access with CSRF protection
- **Access**: Admin UI at `/admin/db-sync` with status display and manual sync trigger.
- **Files**: `server/db-sync.ts`, `server/routes-db-sync.ts`, `client/src/pages/admin-db-sync.tsx`

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL
- **Authentication**: Replit Auth OIDC
- **AI Service**: OpenAI API (Assistant endpoints, Embeddings API)
- **Vector Database**: Qdrant Cloud

## Frontend Libraries
- **UI Components**: Radix UI
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Date Handling**: date-fns
- **Form Handling**: React Hook Form with Zod
- **Icons**: lucide-react

## Backend Services
- **Web Framework**: Express.js
- **Database ORM**: Drizzle ORM
- **Authentication**: Passport.js with OpenID Connect
- **Session Storage**: connect-pg-simple
- **Password Hashing**: bcryptjs
- **Vector Database Client**: @qdrant/js-client-rest
- **AI Frameworks**: LangChain (@langchain/core, @langchain/openai, @langchain/langgraph)
- **Agent Orchestration**: LangGraph with React Agent pattern

## Development Tools
- **Build Tools**: Vite (frontend), esbuild (backend)
- **Type Checking**: TypeScript
- **Database Schema**: Drizzle Kit