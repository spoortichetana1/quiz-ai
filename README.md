# Quiz AI

A lightweight AI quiz generator with a polished browser UI and a small Express backend.

## What it does

- Generate multiple-choice quizzes from any topic
- Choose difficulty and question count
- Review answers and retry the same quiz
- Run in mock mode when no OpenAI key is configured

## Project structure

- `frontend/` — static quiz UI
- `backend/` — Express API for quiz generation
- `start.sh` — kills existing port holders and starts both apps together

## Requirements

- Node.js 18+
- Python 3 (used by the frontend static server in `start.sh`)

## Setup

### 1) Backend environment

Create `backend/.env` with one of these options:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o
QUIZ_USE_MOCK=false
PORT=8000
```

Or run in mock mode:

```env
QUIZ_USE_MOCK=true
PORT=8000
```

### 2) Start everything

From the repo root:

```bash
./start.sh
```

The script will:

- stop anything already using ports `5500` and `8000`
- start the backend on `http://127.0.0.1:8000`
- start the frontend on `http://127.0.0.1:5500`

## Manual start

### Backend

```bash
cd backend
npm start
```

### Frontend

```bash
cd frontend
python3 -m http.server 5500 --bind 127.0.0.1
```

## Notes

- The quiz UI is designed to feel clean, responsive, and focused.
- If the backend is unavailable, the demo quiz still works.
- The frontend talks to the backend at `http://127.0.0.1:8000`.
