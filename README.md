# OBT Mentor Companion

AI-powered mentorship tracking system for YWAM Oral Bible Translation (OBT) facilitators. Track competencies, manage qualifications, log activities, generate reports, and get AI mentorship guidance.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
DATABASE_URL=postgresql://localhost/obt_mentor
GOOGLE_API_KEY=your_gemini_api_key
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_key
SESSION_SECRET=random-32-char-minimum-string

# 3. Setup database
createdb obt_mentor
npm run db:push

# 4. Start app
npm run dev
```

Open **http://localhost:5000**

---

## 📋 Features

### Core Features
- **AI Mentor Assistant** - Google Gemini 2.5 Pro powered conversations
- **Competency Tracking** - 11 core OBT competencies with 5 status levels
- **Portfolio Management** - Qualifications, activities, and reports
- **Semantic Memory** - Qdrant vector search across all conversations
- **Quarterly Reports** - Auto-generated DOCX reports

### Competencies Tracked
1. Interpersonal Skills
2. Intercultural Communication
3. Multimodal Skills
4. Translation Theory & Process
5. Languages & Communication
6. Biblical Languages
7. Biblical Studies & Theology
8. Planning & Quality Assurance
9. Consulting & Mentoring
10. Applied Technology
11. Reflective Practice

**Status Levels**: Not Yet Started → Emerging → Growing → Proficient → Advanced

### Key Business Rules
- **No Downgrades**: Competencies can only progress forward
- **Advanced Requirements**: Requires both:
  - Education: Bachelor degree or higher
  - Experience: 3+ years in relevant activities

---

## 🛠 Tech Stack

**Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui

**Backend**: Node.js + Express + TypeScript + Drizzle ORM + PostgreSQL

**AI**: Google Gemini 2.5 Pro (conversations) + Gemini 2.5 Flash (translations)

**Vector DB**: Qdrant Cloud (semantic search with text-embedding-004)

**Auth**: Passport.js + OpenID Connect

---

## 📦 Installation

### Prerequisites
- Node.js 18+
- **Neon PostgreSQL** database ([Create free](https://neon.tech/))
- Google Gemini API key ([Get it here](https://makersuite.google.com/app/apikey))
- Qdrant Cloud account ([Create free](https://qdrant.io/))

### Environment Variables

Create `.env` file:

```bash
# Required - Use Neon PostgreSQL connection string
DATABASE_URL=postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/obt_mentor?sslmode=require
GOOGLE_API_KEY=your_google_gemini_api_key
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key
SESSION_SECRET=your-secure-random-string-32-chars-minimum
```

### Development

```bash
npm install          # Install dependencies
npm run db:push      # Sync database schema (works with Neon)
npm run dev          # Start dev server (port 5000)
```

**Note**: Using Neon PostgreSQL eliminates the need for local PostgreSQL installation. Just get your connection string from [Neon Console](https://console.neon.tech/) and add it to `.env`.

### Production

```bash
npm run build        # Build frontend + backend
npm start            # Start production server
```

---

## 🧪 Testing

Comprehensive integration tests using **pytest** (functional approach):

```bash
# Setup (first time)
createdb obt_test
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-test.txt

# Run tests
./run_tests.sh                 # All tests
npm test                       # Same as above
npm run test:coverage          # With coverage
npm run test:parallel          # Faster (parallel)
npm run test:competency        # Competency tests only
npm run test:qualification     # Qualification tests only
npm run test:activity          # Activity tests only
npm run test:workflow          # End-to-end tests
```

**Test Coverage**: 66+ integration tests covering all business rules

Full documentation: [`tests/README.md`](tests/README.md)

---

## 🏗 Architecture

### Database (PostgreSQL + Drizzle ORM)

**18 Tables**:
- `users`, `facilitators`, `sessions`
- `facilitator_competencies`, `facilitator_qualifications`, `mentorship_activities`
- `quarterly_reports`, `competency_evidence`, `competency_change_history`
- `chats`, `messages`, `chat_chains`, `message_attachments`
- `documents`, `qualification_attachments`
- `api_keys`, `api_usage`, `feedback`

### AI System

**Multi-Agent Architecture** (LangGraph):
- **Conversational Agent**: Gemini 2.5 Pro for mentorship guidance
- **Report Agent**: Gemini 2.5 Pro for narrative generation
- **Supervisor**: Routes between agents

**Cost Optimization**: Migrated from OpenAI GPT-4o → Gemini 2.5 Pro
- **Before**: ~$5/M tokens
- **After**: ~$0.13/M tokens
- **Savings**: 75-98% 🎉

### Vector Memory
- **Model**: Google text-embedding-004 (768 dimensions)
- **Storage**: Qdrant Cloud
- **Features**: Semantic search, global cross-learning

---

## 📡 API Endpoints

### Authentication
All endpoints require session cookies (automatic via Passport.js)

### Facilitator Endpoints

```http
GET    /api/facilitator                    # Get profile
PUT    /api/facilitator                    # Update profile
GET    /api/facilitator/competencies       # Get competencies
POST   /api/facilitator/competencies       # Update competency
GET    /api/facilitator/qualifications     # Get qualifications
POST   /api/facilitator/qualifications     # Create qualification
DELETE /api/facilitator/qualifications/:id # Delete qualification
GET    /api/facilitator/activities         # Get activities
POST   /api/facilitator/activities         # Create activity
DELETE /api/facilitator/activities/:id     # Delete activity
GET    /api/facilitator/reports            # Get reports
POST   /api/facilitator/reports/generate   # Generate report
DELETE /api/facilitator/reports/:id        # Delete report
```

### Chat Endpoints

```http
GET    /api/chats                          # Get all chats
POST   /api/chats                          # Create chat
GET    /api/chats/:id/messages             # Get messages
POST   /api/chats/:id/messages             # Send message (with AI)
DELETE /api/chats/:id                      # Delete chat
```

### Admin Endpoints

```http
GET    /api/admin/users                    # List users
PUT    /api/admin/users/:id/approve        # Approve user
GET    /api/admin/feedback                 # View feedback
GET    /api/admin/documents                # Manage RAG documents
POST   /api/admin/documents/upload         # Upload document
```

---

## 💾 Database Management

### Backups

```bash
# Manual backup
npx tsx scripts/backup-database.ts

# Restore from backup
npx tsx scripts/restore-database.ts backup-2025-01-24.sql

# List backups
ls -lh backups/
```

**Auto-retention**: Keeps last 7 backups

### Migrations

```bash
# Push schema changes to database
npm run db:push

# Pre-publish safety check (prevents destructive changes)
PRODUCTION_DATABASE_URL=<url> npx tsx scripts/pre-publish-check.ts

# Post-publish verification
PRODUCTION_DATABASE_URL=<url> npx tsx backend/verify-production-users.ts
```

---

## 🎨 Themes

6 color themes available (user-selectable):

1. **Areia** (sandy beige)
2. **Azul** (soft blue-teal)
3. **Telha** (terracotta orange)
4. **Verde Claro** (light olive green) - Default
5. **Verde** (dark forest green)
6. **Preto** (deep charcoal)

Change theme: User Profile → Theme button

Customize: Edit `frontend/src/lib/themes.ts`

---

## 🚢 Deployment

### Google Cloud Run (Recommended)

Complete infrastructure-as-code setup with Terraform:

```bash
# See full guide: DEPLOYMENT.md

# Quick deploy
cd /Users/lucas/Desktop/shemaobt/tf/environments/obt-prod
terraform init
terraform apply -var-file=obt-prod.tfvars

# Then push to GitHub - automatic deployment via GitHub Actions
git push origin main
```

**Features**:
- ✅ Automatic scaling (0-5 instances)
- ✅ HTTPS by default
- ✅ CI/CD with GitHub Actions
- ✅ Neon PostgreSQL integration
- ✅ Custom domain support
- ✅ ~$5-20/month cost

📚 **Full Setup**: Run `./deploy.sh` after configuring `.env`

### Docker Compose (Local Testing)

```bash
# Build and run locally
docker-compose up

# Access:
# Frontend: http://localhost:8080
# Backend: http://localhost:5000
```

### Manual Deployment

```bash
npm run build
# Output:
# - dist/public/  (frontend)
# - dist/index.js (backend)

# Deploy to any Node.js hosting platform
```

### Other Platforms

- **Heroku/Railway**: Compatible
- **Render**: Compatible
- **Any Docker platform**: Dockerfiles included

---

## 📚 Project Structure

```
obt-mentor-companion/
├── frontend/             # React frontend
│   └── src/
│       ├── components/   # UI components (57 files)
│       ├── pages/        # Route pages (15 files)
│       ├── hooks/        # Custom hooks (7 files)
│       └── lib/          # Utilities (4 files)
├── backend/              # Express backend
│   ├── index.ts          # Server entry
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Database queries
│   ├── langchain-agents.ts  # AI agents
│   ├── gemini-audio.ts   # Audio/translation
│   ├── vector-memory.ts  # Qdrant integration
│   └── utils.ts          # Utilities
├── shared/
│   └── schema.ts         # Database schema (18 tables)
├── tests/                # Integration tests (66+ tests)
│   ├── conftest.py       # Test fixtures
│   └── test_*.py         # Test suites
└── scripts/              # Utility scripts
    ├── backup-database.ts
    ├── restore-database.ts
    └── pre-publish-check.ts
```

---

## 🔧 Development Scripts

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server
npm run check            # TypeScript type checking
npm run db:push          # Sync database schema
npm test                 # Run integration tests
npm run test:coverage    # Tests with coverage
npm run test:parallel    # Faster parallel tests
```

---

## 🐛 Troubleshooting

### Database Connection Error

```bash
# Check PostgreSQL is running
psql -l

# Verify DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:pass@host:port/database

# Recreate database
dropdb obt_mentor && createdb obt_mentor
npm run db:push
```

### API Key Errors

```bash
# Verify keys are set
echo $GOOGLE_API_KEY
echo $QDRANT_URL

# Check .env file exists
cat .env
```

### Port Already in Use

```bash
# Change port in .env
PORT=3000

# Or kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### Migration Fails

```bash
# Drop and recreate (caution: data loss!)
dropdb obt_mentor
createdb obt_mentor
npm run db:push
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

**Code Style**:
- TypeScript for all code
- Functional programming for tests
- Follow existing patterns
- Add tests for new features

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- **YWAM** - Oral Bible Translation program
- **Google Gemini** - AI models and APIs
- **Qdrant** - Vector database
- **shadcn/ui** - Component library

---

## 📞 Support

For issues or questions:
1. Check this README
2. Review `tests/README.md` for testing help
3. Check error logs: `logs/` directory
4. Open an issue on GitHub

---

**Made with ❤️ for OBT Facilitators**
# Database updated to November data
