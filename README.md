# Code-Wrangler

AI-powered exam prep platform with:
- Vite + React client (`/client` served by root Vite config)
- Next.js API backend (`/backend`)
- Clerk authentication
- MongoDB persistence
- AI integrations (Groq and Gemini)

## Project Structure

```text
Code-Wrangler/
├── client/                 # React frontend source
├── backend/                # Next.js backend APIs
├── attached_assets/        # Prompt/content assets
├── package.json            # Frontend (Vite) scripts
└── README.md
```

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query
- Backend: Next.js 14 (App Router API routes), TypeScript, Mongoose/MongoDB
- Auth: Clerk (`@clerk/clerk-react` on frontend, `@clerk/nextjs` on backend)
- AI: Groq (`groq-sdk`) + Gemini (`@google/genai` and Gemini REST endpoints)

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB instance (Atlas or local)
- Clerk account and keys
- Groq and/or Gemini API keys

## Environment Variables

Create two env files:

### 1) Frontend env (`/.env`)

```bash
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 2) Backend env (`/backend/.env.local`)

```bash
MONGODB_URI=mongodb+srv://...

# Clerk
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# Groq (supports aliases used in code)
GROQ_API_KEY=gsk_...
GROQ_API_BASE=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.3-70b-versatile

# Optional aliases recognized by backend
GROK_API_KEY=
GROCK_API_KEY=
GROK_MODEL=

# Gemini
GEMINI_API_KEY=AIza...

# Sarvam (Voice Assistant)
SARVAM_API_KEY=your_sarvam_key
SARVAM_API_BASE=https://api.sarvam.ai
SARVAM_CHAT_PATH=/v1/chat/completions
SARVAM_STT_PATH=/v1/speech-to-text
SARVAM_TTS_PATH=/v1/text-to-speech
SARVAM_TRANSLATE_PATH=/v1/translate
SARVAM_CHAT_MODEL=sarvam-m
SARVAM_TTS_VOICE=anushka
```

## Installation

Install dependencies for both apps:

```bash
# From repo root
npm install

# Backend
cd backend && npm install
```

## Running Locally

Run both services in separate terminals.

### Terminal 1: Backend (port 3000)

```bash
cd backend
npm run dev
```

### Terminal 2: Frontend (port 5173)

```bash
# from repo root
npm run dev
```

Open the app at:
- Frontend: `http://localhost:5173`
- Backend/API: `http://localhost:3000`

## Available Scripts

### Root (`package.json`)

- `npm run dev` — Start Vite frontend on `5173`
- `npm run build` — Build frontend bundle
- `npm run start` — Preview built frontend on `5001`
- `npm run check` — TypeScript check
- `npm run db:push` — Drizzle schema push (if using root DB flow)

### Backend (`backend/package.json`)

- `npm run dev` — Start Next.js dev server
- `npm run build` — Build backend
- `npm run start` — Start production backend
- `npm run lint` — Run Next linting

## Core Features

- Authenticated user flows with Clerk
- Notes CRUD and AI-assisted note generation
- URL/YouTube-to-notes conversion flows
- MCQ generation from notes/content
- Practice attempts, review, and analytics endpoints
- Chat assistant endpoints with Gemini/Groq-backed responses
- Sarvam-powered voice assistant (chat + speech-to-text + text-to-speech + translate)

## API Usage Notes

- Frontend Axios base URL is controlled by `VITE_API_URL` and defaults to `http://localhost:3000`.
- Vite dev server also proxies `/api` to backend.
- Most backend routes require authenticated Clerk session.

## Troubleshooting

- `Unauthorized` on API calls:
	- Ensure Clerk keys are set in both frontend and backend env files.
	- Verify you are signed in and sending auth headers/cookies.

- `MONGODB_URI` error:
	- Add valid `MONGODB_URI` in `backend/.env.local`.

- AI endpoint failures:
	- Set `GROQ_API_KEY` and/or `GEMINI_API_KEY` in backend env.

- CORS/base URL issues:
	- Set `VITE_API_URL=http://localhost:3000` in root `.env`.

## Notes

- The frontend source lives in `/client`, but its scripts are run from the root `package.json`.
- Keep `backend` and frontend running together for full functionality.
# EduGenie
