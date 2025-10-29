# Overview

The OBT Mentor Companion is an AI-powered full-stack web application designed for YWAM Oral Bible Translation (OBT) facilitators. It provides mentorship tracking and assessment capabilities through an AI assistant, powered by Google Gemini AI. The project aims to enhance mentorship effectiveness, facilitate cross-learning among facilitators, and offer comprehensive facilitator portfolio management, including competencies, qualifications, activities, and quarterly report generation. A key capability is global memory search using Qdrant Cloud for semantic search across all facilitator conversations.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Design
- **Brand Color**: #86884C (olive-green tone)
- **UI Framework**: Radix UI primitives with shadcn/ui and Tailwind CSS, maintaining a consistent olive-green palette across light and dark modes.
- **Typography**: Inter font family with English UI labels.
- **Logo System**: Unified white logo icon with theme-colored backgrounds, dynamic favicon updates.

## Technical Implementation
- **Frontend**: React with TypeScript (Vite), TanStack Query for state management, Wouter for routing.
- **Backend**: Node.js with Express.js, TypeScript (ESM modules).
- **Authentication**: Replit Auth (OpenID Connect), Express sessions with PostgreSQL store, Passport.js, HTTP-only cookies, and admin approval for new users.
- **Database**: PostgreSQL (Neon serverless driver), Drizzle ORM for schema management.
- **Data Models**: Users, Facilitators, 11 OBT core Competencies, Qualifications (with certificate attachments), Activities, Quarterly Reports, Chats, and Messages.
- **AI Integration (LangChain Multi-Agent System with Google Gemini 2.5)**:
    - **Framework**: LangChain/LangGraph with React Agent pattern, powered by Google Gemini 2.5 models.
    - **2-Agent Architecture**: Conversational Agent (Gemini 2.5 Pro) for natural conversations, portfolio management, and competency tracking; Report Agent (Gemini 2.5 Pro) for narrative generation. A Supervisor/Router directs traffic between agents.
    - **Cost Optimization**: Utilizes Google Gemini 2.5 exclusively for all AI features (chat, transcription, TTS, embeddings).
    - **Audio Features**: Gemini 2.5 Pro native audio for transcription (supports up to 9.5 hours, speaker diarization, 24+ languages); Gemini 2.5 Flash TTS for text-to-speech (automatic multilingual native pronunciation); Google text-embedding-004 for vector memory. Voice recording UI features WhatsApp-style waveform visualization.
    - **Tools**: DynamicStructuredTool for managing qualifications, activities, competencies, and certificate attachments with duplicate detection.
    - **Context System**: Four-layer injection: portfolio data, recent message history, Qdrant semantic vector search, conversation analysis for competency detection, and awareness of message attachments.
    - **Intelligent Competency Evaluation**: Automatic scoring based on qualifications and activities; AI tracks all 11 competencies from natural conversations, with strength scoring and automatic updates after sufficient observations.
    - **Certificate Verification**: AI extracts and reads text from uploaded PDF/DOCX certificates for content verification.
    - **Conversational System Prompt**: AI acts as a trusted mentor, observing, evaluating, and correcting based on documentation, with strict OBT-only scope enforcement and explicit document citation.
    - **Agent Behavioral Improvements**: Agent proactively asks targeted questions, prohibits auto-promotion requests, enforces advanced level requirements (education + experience), maintains transparency boundaries, and directs technical issues to app feedback.
    - **Visual Competency Formatting**: Agent displays competencies with colored emoji indicators (🟢 Advanced, 🟡 Proficient, 🔵 Developing, ⚪ Not Started) and proper translations, eliminating technical jargon and code-style formatting for improved user experience.
    - **Evidence-Based Competency Persistence**: Implemented a `statusSource` enum ('auto', 'manual', 'evidence') to ensure evidence-based and manual competency updates persist across recalculations.
    - **Automatic Evidence Application**: `applyPendingEvidence()` function automatically applies accumulated competency evidence during conversations, promoting competency levels based on observations.
- **Vector Memory System**: Qdrant Cloud for global memory, using Google `text-embedding-004` (768 dimensions) for embeddings. Enhanced RAG document chunking with semantic chunking and competency tagging.
- **API Design**: RESTful, secured with session-based authentication, CSRF protection, and authorization checks.
- **Portfolio Management**: Comprehensive tracking of competencies, qualifications (with multiple certificate uploads, download, preview, delete), activities, and quarterly reports.
- **User Roles and Permissions**: Three-tier system (Admin, Supervisor, Regular User) with granular access control.
- **Security Features**: Session-based auth, HTTP-only cookies, authorization, hierarchical access control, CSRF protection, admin/supervisor-controlled user approval.

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL
- **Authentication**: Replit Auth OIDC
- **AI Service**: Google Gemini 2.5 API (chat agents, audio transcription, embeddings)
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
- **AI Frameworks**: LangChain (@langchain/core, @langchain/google-genai, @langchain/langgraph)
- **Google Cloud Services**: @google/generative-ai
- **Agent Orchestration**: LangGraph
- **Language Detection**: franc