# Overview

The OBT Mentor Companion is an AI-powered full-stack web application designed for YWAM Oral Bible Translation (OBT) facilitators. It provides mentorship tracking and assessment capabilities through an AI assistant, powered by Google Gemini AI. Key features include user authentication with admin approval, comprehensive facilitator portfolio management (competencies, qualifications, activities), quarterly report generation, and global memory search using Qdrant Cloud for semantic search across all facilitator conversations. The project aims to enhance mentorship effectiveness and facilitate cross-learning among facilitators.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## October 29, 2025 - Evidence-Based Competency Persistence System
- **CRITICAL FIX: Three-Way StatusSource Architecture** - Implemented proper distinction between competency update sources by expanding `statusSource` enum to include 'auto', 'manual', AND 'evidence'. This prevents evidence-based competencies from being overwritten by auto-recalculations.
- **SCHEMA UPDATE**: Added 'evidence' to `facilitatorCompetencies.statusSource` enum to distinguish conversation-based updates from calculation-based ('auto') and supervisor-edited ('manual') competencies.
- **PRESERVATION LOGIC**: Modified `recalculateCompetencies()` to preserve BOTH 'manual' and 'evidence' statusSource types (not just 'manual'). Only competencies with statusSource='auto' are overwritten during recalculation.
- **EVIDENCE APPLICATION**: Updated `applyPendingEvidence()` to set `statusSource: 'evidence'` when promoting competencies based on conversation observations, ensuring persistence across qualification/activity changes.
- **FUNCTION ENHANCEMENT**: Enhanced `updateCompetencyStatus()` to accept optional statusSource parameter for proper source tracking across all competency update pathways.
- **VERIFIED END-TO-END**: Database confirms competencies updated with statusSource='evidence' (reflective_practice and planning_quality → proficient) persist correctly across recalculations.
- **IMPACT**: Evidence-based competency updates now permanently preserve facilitator growth observed through conversations, creating durable competency progression independent of auto-calculations.

## October 29, 2025 - Bug Fix: Evidence Application Function Error
- **FIXED: Critical Runtime Error in applyPendingEvidence()** - Fixed "storage.getFacilitator is not a function" error that prevented automatic competency updates from persisting to database. Root cause: called non-existent `getFacilitator()` method.
- **SOLUTION: Optimized User Lookup** - Replaced inefficient `getAllFacilitators().find()` approach with direct `getUserByFacilitatorId()` call that performs efficient database JOIN to retrieve user context.
- **VERIFIED**: System now successfully updates competencies automatically (tested: reflective_practice and planning_quality promoted from not_started → proficient with 35 evidence pieces marked as applied).
- **IMPACT**: Automatic evidence application system now fully operational end-to-end without errors.

## October 29, 2025 - Automatic Evidence Application System
- **NEW FEATURE: Autonomous Evidence Application** - Implemented `applyPendingEvidence()` function that automatically applies accumulated competency evidence to facilitator profiles during conversations. System groups evidence by competency, calculates average strength scores, and promotes competency levels when 3+ observations with 6+ average strength are detected.
- **AUTOMATIC INTEGRATION** - Evidence application now runs automatically before every chat message (both text and voice), eliminating need for manual button clicks. Uses non-blocking error handling to prevent chat failures.
- **BACKUP MANUAL TRIGGER** - Added POST `/api/facilitator/apply-pending-evidence` route and "Apply Evidence" button in Portfolio UI for manual forcing when needed. Button shows update results in toast notifications.
- **BALANCED CHAT ANALYSIS PROMPT** - Removed "SPECIAL FOCUS ON APPLIED_TECHNOLOGY" bias from `analyzeConversationsForEvidence()` prompt. Added balanced guidelines emphasizing all 11 competencies equally, with instructions to recognize both explicit and implicit evidence.
- **IMPACT**: System now autonomously updates competencies based on conversations without user intervention. Database shows 209 pending evidence pieces across all 11 competencies ready for automatic application (avg strengths 7.1-9.4).

## October 29, 2025 - Critical Bug Fixes for Activity Duration Scoring & Chat Analysis
- **FIXED: Activity Duration Field Mapping** - Corrected competency scoring system to properly read `durationYears` and `durationMonths` fields from database. Previously used deprecated `yearsOfExperience` field which was NULL for all activities.
- **FIXED: Nullish Coalescing for Zero Values** - Changed from `|| null` to `?? null` when passing activity fields to prevent zero-valued durations from being discarded. Now activities with "0 years, 6 months" calculate correctly as 0.5 years instead of being lost.
- **FIXED: Chat Analysis Model Initialization** - Created dedicated `analysisModel` instance in `analyzeConversationsForEvidence()` function to resolve "mainModel is undefined" crash.
- **FIXED: Frontend JSON Parsing Bug** - Added `await response.json()` to analyzeChatHistoryMutation to properly parse server response. Previously cast Response object directly as JSON, causing "Failed to analyze chat history" error even when backend succeeded.
- **Impact**: User's 18 years of OBT experience (1yr OBT LAB, 6yrs Favelas, 5yrs Oral School, 6yrs Tenharin) now properly counted in competency scoring. "Analyze Chats" feature fully functional - successfully extracts ~24-28 pieces of competency evidence from conversations.

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
    - **Cost Optimization**: Migrated from OpenAI GPT-4o ($5/M tokens) to Gemini 2.5 (75-98% cost reduction). All AI features (chat, transcription, TTS, embeddings) now use Google Gemini exclusively.
    - **Audio Features**:
        - **Transcription**: Gemini 2.5 Pro native audio (supports up to 9.5 hours, speaker diarization, 24+ languages) with post-processing to remove timestamps for cleaner output
        - **TTS**: Gemini 2.5 Flash TTS with automatic multilingual native pronunciation (supports 24+ languages with automatic language detection, PCM to WAV conversion)
        - **Embeddings**: Google text-embedding-004 (768 dimensions) for vector memory
        - **Voice Recording UI**: WhatsApp-style waveform visualization with Web Audio API, showing real-time sound waves (20 animated bars), recording duration timer, pulsing indicator, and full accessibility support (aria-live, aria-labels for screen readers)
        - **Recording Optimization**: MediaRecorder with 1000ms timeslice chunking and 100ms post-stop delay to prevent audio truncation at end of recordings
    - **Tools**: DynamicStructuredTool for managing qualifications, activities, competencies, and certificate attachments. Features robust duplicate detection.
    - **Context System**: Four-layer injection including portfolio data, recent message history, Qdrant-powered semantic vector search, conversation analysis for competency detection, and awareness of message attachments.
    - **Intelligent Competency Evaluation**: Automatic scoring based on qualifications and activities with strict scoring rules, ensuring credit for actual study/work.
    - **Competency Observation System**: AI proactively tracks ALL 11 competencies from natural conversations using `track_competency_evidence` tool. System trusts Gemini 2.5 Pro's contextual intelligence to understand which competency is demonstrated (not just keyword matching). Strength scoring (1-10) filters weak mentions. Automatic competency updates trigger after 3+ observations with 6+ average strength via `suggest_competency_update` tool.
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
- **AI Frameworks**: LangChain (@langchain/core, @langchain/google-genai, @langchain/langgraph)
- **Google Cloud Services**: @google/generative-ai (Gemini chat, audio transcription, TTS, and embeddings)
- **Agent Orchestration**: LangGraph
- **Language Detection**: franc (automatic language detection for TTS and analytics)

## Development Tools
- **Build Tools**: Vite (frontend), esbuild (backend)
- **Type Checking**: TypeScript
- **Database Schema**: Drizzle Kit