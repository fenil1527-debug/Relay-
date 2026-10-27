# Relay — Provider-Neutral AI Coding Agent

> Sessions survive provider failure. The agent keeps working.

Relay is a browser-based AI coding agent where sessions are **provider-neutral**. When a model provider rate-limits, times out, overflows its context window, or hits a token cap, Relay automatically hands the session to the next provider in a configurable fallback chain. Architectural decisions, files, and conversation history carry over seamlessly. Users can also swap providers manually at any time.

---

## Problem Statement

AI coding assistants are tightly coupled to a single model provider. When that provider goes down, hits rate limits, or runs out of context window, the entire coding session is disrupted — the developer loses context, has to re-explain their problem, and starts over.

**Relay solves this** by decoupling the coding session from any single provider. It introduces a canonical data model, a structured decision ledger, and a handoff engine that makes switching between Anthropic Claude, OpenAI GPT-4, Groq, and other providers completely transparent.

## Target Users

- **Developers** who use AI assistants for coding and want uninterrupted sessions
- **Teams** evaluating multiple LLM providers and want a single interface
- **Anyone** who has hit rate limits mid-conversation and lost their entire context

## Solution

Relay wraps multiple LLM providers behind a single agent interface. It persists every step to a database, maintains a structured decision ledger that survives context trimming, and uses a virtual file system so the AI can read, write, and manage code files — all in the browser.

When a provider fails:
1. The **Error Classifier** categorizes the failure (retryable, failover, or fatal)
2. The **Provider Router** retries with exponential backoff or triggers a handoff
3. The **Handoff Engine** builds a packet from the database (not the failed provider), repairs any in-flight tool state, and passes it to the next provider
4. The new provider continues exactly where the old one left off

---

## Key Features

### 1. Automatic Multi-Model Failover
Configure a fallback chain (e.g., Claude → GPT-4o → Groq). When the primary provider rate-limits or errors, the session automatically continues on the next provider with full context preserved.

### 2. Structured Decision Ledger
Architectural decisions, constraints, and TODOs are extracted from every conversation turn and stored as structured entries. This memory **always** fits in the context window, even when older messages are trimmed — so a fresh provider never forgets "use Drizzle, not Prisma" or "all routes must be authed."

### 3. Virtual File System with Monaco Editor
The agent works with a database-backed virtual file tree. Users can browse files in a tree view, edit them in a Monaco editor with syntax highlighting, and see diffs. The agent uses `list_files`, `read_file`, `write_file`, and `delete_file` tools — with optimistic concurrency control.

### 4. Resilience Timeline
Every provider attempt, retry, and handoff is logged and displayed in a visual timeline. Users can see exactly when failovers happened, which providers were tried, latency, and error classifications.

### 5. SSE Streaming + Step-Level Persistence
Agent responses stream in real-time via Server-Sent Events. Every step is persisted **before** the next begins, so interrupted sessions can be resumed from the last checkpoint.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, Vite 8, React Router 7 | SPA with client-side routing & theme persistence |
| **Editor** | Monaco Editor (via @monaco-editor/react) | Adaptive in-browser code editing (`vs` / `vs-dark`) |
| **Backend** | Node.js, Express 4 | REST API + SSE streaming orchestrator |
| **Database** | Supabase (PostgreSQL) & MongoDB | Document / relational storage for sessions, files, ledger |
| **Auth** | Passport.js (GitHub OAuth) + JWT | Authentication with httpOnly cookies & 1-Click Demo login |
| **AI Providers** | Anthropic, OpenAI, Groq (`gpt-oss-120b`) | Provider-neutral adapter pipeline with auto-failover |
| **Validation** | Zod | Schema validation at API boundaries |
| **Rate Limiting** | express-rate-limit | Per-user request throttling |
| **Styling** | Vanilla CSS (Studio Design System) | Adaptive Light/Dark mode, glassmorphism, Inter + JetBrains Mono |

---

## Architecture

```
Browser (React + Vite)
  ├── Chat UI (SSE streaming)
  ├── Monaco Editor (virtual file system)
  ├── Ledger Panel (structured memory)
  └── Handoff Timeline (resilience visibility)
          │
          ▼
Express API Server
  ├── Auth (GitHub OAuth + JWT + Demo Login)
  ├── Orchestrator (agent loop, step cap)
  │     ├── Context Budgeter (fits history to model window)
  │     ├── Provider Router (fallback chain + error classifier)
  │     │     ├── Anthropic Adapter (Claude)
  │     │     └── OpenAI-compatible Adapter (GPT-4, Groq, OpenRouter)
  │     ├── Tool Executor (virtual FS: list, read, write, delete)
  │     ├── Ledger Updater (extracts decisions/constraints/TODOs)
  │     └── Handoff Engine (builds HandoffPacket, repairs tool state)
  └── MongoDB
        ├── users, sessions, files, messages
        ├── turns, provider_attempts
        ├── handoffs, ledger_entries
        └── Indexes: partial unique (one running turn), compound (session+path)
```

### Core Invariants

1. **Step-level persistence**: Every step is persisted before the next begins. If the server crashes, the session is consistent.
2. **Tool-result completeness**: Every `tool_use` has a matching `tool_result` before the next model call.
3. **Single running turn**: A partial unique index ensures only one agent loop runs per session at a time.
4. **Ownership isolation**: Every database query is scoped by `userId` through `sessions`. Unauthorized and nonexistent resources return the same 404.

For the full architecture document, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Local Setup

### Prerequisites

- **Node.js** v18+ (recommended: v20+)
- **Supabase** project (or local PostgreSQL / MongoDB)
- At least one AI provider API key (Groq, Anthropic, or OpenAI)

### Installation & Supabase Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/relay.git
cd relay

# 2. Install all dependencies (root + server + client)
npm run install:all

# 3. Create database tables in Supabase
# Open your Supabase SQL Editor and execute the schema file:
# supabase_schema.sql

# 4. Create your environment file
cp .env.example .env
# Edit .env and add your Supabase URL & Key, plus AI API keys
```

### Running the App

```bash
# Start both server and client concurrently
npm run dev

# Or start them separately:
npm run dev:server   # Express API on http://localhost:3001
npm run dev:client   # Vite dev server on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

### Quick Start (Demo Mode)

1. Click **"Launch Studio Workspace (1-Click)"** on the login page — no GitHub OAuth needed
2. Click **"New Session"** to create your first coding workspace
3. Choose your primary provider and failover provider (e.g. Anthropic → OpenAI → Groq)
4. Start chatting — the agent will plan in the Decision Ledger and create/edit files in Monaco Editor!

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Recommended | Supabase project URL (`https://xyz.supabase.co`) |
| `SUPABASE_KEY` | Recommended | Supabase public/anon or service role key |
| `DATABASE_URL` | Fallback | MongoDB connection string (if not using Supabase) |
| `AUTH_SECRET` | Yes | JWT signing secret |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth (optional — 1-click login works without it) |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth secret |
| `CLIENT_URL` | Yes | Frontend URL (default: `http://localhost:5173`) |
| `ANTHROPIC_API_KEY` | Conditional | Required if using Anthropic Claude |
| `OPENAI_API_KEY` | Conditional | Required if using OpenAI GPT-4 |
| `OPENAI_COMPAT_BASE_URL` | No | Base URL for OpenAI-compatible APIs (e.g. `https://api.groq.com/openai/v1`) |
| `OPENAI_COMPAT_API_KEY` | Conditional | API key for Groq / OpenAI-compatible endpoint |
| `OPENAI_COMPAT_MODEL` | No | Model name (default: `openai/gpt-oss-120b` on Groq) |
| `ENABLE_SIMULATION` | No | Enable `X-Relay-Simulate` header for deterministic handoff testing |
| `PORT` | No | Server port (default: 3001) |

> **Security**: Never commit `.env` to git. The `.gitignore` is already configured.

---

## Project Structure

```
relay/
├── client/                     # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/           # ProtectedRoute
│   │   │   ├── Chat/           # ChatContainer, ChatInput, MessageBubble, ToolCallCard
│   │   │   ├── Editor/         # FileTree, CodeEditor (Monaco)
│   │   │   ├── Layout/         # Navbar
│   │   │   ├── Ledger/         # LedgerPanel (structured memory display)
│   │   │   ├── Timeline/       # HandoffTimeline (resilience visibility)
│   │   │   └── common/         # Icons (SVG icon library)
│   │   ├── context/            # AuthContext
│   │   ├── pages/              # LoginPage, DashboardPage, SessionPage
│   │   ├── services/           # API client + SSE streaming
│   │   └── index.css           # Design system (1700+ lines)
│   └── vite.config.js          # Vite config with API proxy
│
├── server/                     # Express.js backend
│   ├── src/
│   │   ├── config/             # Environment and feature config
│   │   ├── middleware/         # auth (JWT), rateLimit, validate (Zod)
│   │   ├── models/             # Mongoose schemas (8 models)
│   │   ├── providers/          # Anthropic + OpenAI adapters + base interface
│   │   ├── routes/             # auth, sessions, turns (SSE), files
│   │   ├── services/           # orchestrator, router, context, errors,
│   │   │                       # handoff, ledger, tools
│   │   ├── validators/         # Zod schemas
│   │   ├── index.js            # Express app entry point
│   │   └── seed.js             # Database seeder
│   └── package.json
│
├── .env.example                # Environment template
├── .gitignore
├── ARCHITECTURE.md             # Detailed architecture document
├── package.json                # Root package with dev scripts
└── README.md                   # This file
```

---

## API Endpoints

| Method & Route | Purpose |
|---|---|
| `GET/POST /api/auth/*` | GitHub OAuth + demo login |
| `GET /api/sessions` | List user's sessions |
| `POST /api/sessions` | Create a session (title, fallback chain) |
| `GET /api/sessions/:id` | Full session data (messages, ledger, handoffs, files) |
| `POST /api/sessions/:id/turn` | Run an agent turn (SSE stream) |
| `POST /api/sessions/:id/turn/resume` | Resume an interrupted turn |
| `PATCH /api/sessions/:id/provider` | Manual provider swap |
| `GET/PUT /api/sessions/:id/files/*` | Read/save files in the virtual workspace |
| `DELETE /api/sessions/:id` | Delete a session and all data |

**SSE Events**: `step_start`, `text_delta`, `tool_call`, `tool_result`, `file_changed`, `attempt_failed`, `handoff`, `ledger_updated`, `done`, `error`

---

## Deployment

- **Frontend**: Build with `npm run build` (outputs to `client/dist/`), deploy to Vercel/Netlify
- **Backend**: Deploy to Render/Railway/Fly.io with `npm start`
- **Database**: MongoDB Atlas (free tier works)
- **Environment**: Set all env vars in your hosting provider's dashboard

---

## Demo Video

[Link to demo video will be added before submission]

---

## License

MIT
