# Overview

The OBT Mentor Companion is an AI-powered full-stack web application designed for YWAM Oral Bible Translation (OBT) facilitators. It provides mentorship tracking and assessment capabilities through an AI assistant, powered by Google Gemini AI. Key features include user authentication with admin approval, comprehensive facilitator portfolio management (competencies, qualifications, activities), quarterly report generation, and global memory search using Qdrant Cloud for semantic search across all facilitator conversations. The project aims to enhance mentorship effectiveness and facilitate cross-learning among facilitators.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Design
- **Brand Color**: #86884C (olive-green tone)
- **UI Framework**: Consistent olive-green palette across light and dark modes, using Radix UI primitives with shadcn/ui and Tailwind CSS.
- **Typography**: Inter font family with English UI labels.
- **Logo System**: Unified white logo icon with theme-colored backgrounds, dynamic favicon updates.

## Technical Implementation
- **Frontend**: React with TypeScript (Vite), TanStack Query for state management, Wouter for routing.
- **Backend**: Node.js with Express.js, TypeScript (ESM modules).
- **Authentication**: Replit Auth (OpenID Connect), Express sessions with PostgreSQL store, Passport.js, HTTP-only cookies, admin approval for new users.
- **Database**: PostgreSQL (Neon serverless driver), Drizzle ORM for schema management.
- **Data Models**: Users, Facilitators, Competencies (11 OBT core competencies with bilingual names and status levels), Qualifications (with mandatory descriptions and optional certificate attachments supporting PDF, JPEG, PNG, DOCX), Activities, Quarterly Reports, Chats, Messages.
- **AI Integration (LangChain Multi-Agent System with Google Gemini 2.5)**:
    - **Framework**: LangChain/LangGraph with React Agent pattern, powered by Google Gemini 2.5 models.
    - **2-Agent Architecture**:
        - **Conversational Agent** (Gemini 2.5 Pro): Natural conversations, portfolio management, competency tracking with strict OBT-only scope limitation
        - **Report Agent** (Gemini 2.5 Pro): High-quality narrative generation for quarterly reports
        - **Supervisor/Router**: Routes between agents based on user intent
        - Note: Portfolio operations are integrated into Conversational Agent via specialized tools
    - **Cost Optimization**: Migrated from OpenAI GPT-4o ($5/M tokens) to Gemini 2.5 (75-98% cost reduction)
    - **Audio Features**:
        - **Transcription**: Gemini 2.5 native audio (supports up to 9.5 hours, speaker diarization, 24+ languages)
        - **TTS**: OpenAI tts-1-hd with automatic multilingual native pronunciation (supports 50+ languages with automatic language detection)
        - **Embeddings**: Google text-embedding-004 (768 dimensions) for vector memory
    - **Tools**: DynamicStructuredTool for managing qualifications, activities, competencies, and certificate attachments. Features robust duplicate detection.
    - **Context System**: Four-layer injection including portfolio data, recent message history, Qdrant-powered semantic vector search, conversation analysis for competency detection, and awareness of message attachments.
    - **Intelligent Competency Evaluation**: Automatic scoring based on qualifications and activities with strict scoring rules, ensuring credit for actual study/work.
    - **Competency Observation System**: AI silently tracks competency signals (`track_competency_evidence`) and proactively suggests level changes (`suggest_competency_update`) based on accumulated evidence, requiring user approval.
    - **Certificate Verification**: AI extracts and reads text from uploaded PDF/DOCX certificates (up to 2000 chars) to verify content matches qualification details before attaching.
    - **Conversational System Prompt**: AI acts as a trusted mentor, observing, evaluating, and correcting based on uploaded documentation. It does not automatically add experiences/qualifications; explicit user request is needed.
    - **Document Citation System**: AI explicitly cites specific document names (e.g., "Segundo o Manual OBT...") instead of generic references, with clear citation rules in the prompt.
    - **Strict Scope Enforcement**: AI is configured to ONLY respond to OBT-related questions (mentorship, translation, facilitation, competencies). Politely declines all out-of-scope requests (general questions, technical support, personal advice, etc.).
- **Vector Memory System**: Qdrant Cloud for global memory, using Google `text-embedding-004` (768 dimensions) for embeddings.
    - **Enhanced RAG Document Chunking**: Semantic chunking (~100-word chunks) with automatic competency tagging, rich metadata storage, and backward compatibility.
- **API Design**: RESTful, secured with session-based authentication, CSRF protection, and authorization checks.
- **Portfolio Management**: Comprehensive tracking of competencies, qualifications (with multiple certificate uploads, download, preview, delete), activities, and quarterly reports.
- **User Roles and Permissions**: Three-tier system (Admin, Supervisor, Regular User) with granular access control, including supervisor assignment and approval workflows.
- **Security Features**: Session-based auth, HTTP-only cookies, authorization, hierarchical access control, CSRF protection, admin/supervisor-controlled user approval.
- **Database Synchronization**: One-way (production → development) syncing of `users` and `facilitators` tables for testing, with password security.

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL
- **Authentication**: Replit Auth OIDC
- **AI Service**: Google Gemini 2.5 API (chat agents, audio transcription, embeddings), OpenAI API (multilingual TTS with automatic native pronunciation)
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
- **AI Frameworks**: LangChain (@langchain/core, @langchain/google-genai, @langchain/langgraph), OpenAI SDK (multilingual TTS)
- **Google Cloud Services**: @google/generative-ai (Gemini embeddings and chat)
- **Agent Orchestration**: LangGraph
- **Language Detection**: franc (automatic language detection for logging/analytics)

## Development Tools
- **Build Tools**: Vite (frontend), esbuild (backend)
- **Type Checking**: TypeScript
- **Database Schema**: Drizzle Kit