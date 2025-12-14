"""
AI Quiz Generator Backend (FastAPI)

What this backend does:
- Exposes:
  - GET  /health
  - POST /generate-quiz
- Generates quizzes either using:
  - OpenAI LLM (when QUIZ_USE_MOCK=false and OPENAI_API_KEY is set)
  - Mock generator (fallback for development)

Run backend (Windows PowerShell):
1) cd bhackend
2) python -m venv .venv
3) .\.venv\Scripts\Activate.ps1
4) pip install -r requirements.txt
5) copy .env.example .env   (then edit .env)
6) uvicorn main:app --reload --port 8000

Then run frontend with Live Server:
- Open frontend/index.html with Live Server
"""

from __future__ import annotations

import json
import os
import random
from typing import List, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, conint

# Load env variables from .env
load_dotenv()

# -----------------------------
# Types + config
# -----------------------------
Difficulty = Literal["easy", "medium", "hard"]

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
QUIZ_USE_MOCK = os.getenv("QUIZ_USE_MOCK", "true").lower() == "true"

# OpenAI SDK (optional, only required if using LLM)
try:
    from openai import OpenAI
except Exception:
    OpenAI = None  # type: ignore


# -----------------------------
# API Contracts (Pydantic models)
# -----------------------------
class QuizRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=80)
    difficulty: Difficulty
    count: conint(ge=1, le=15)


class QuizQuestion(BaseModel):
    question: str = Field(..., min_length=5)
    options: List[str] = Field(..., min_length=4, max_length=4)  # exactly 4
    answer_index: conint(ge=0, le=3)  # 0..3
    explanation: str = Field(..., min_length=3)


class QuizResponse(BaseModel):
    topic: str
    difficulty: Difficulty
    questions: List[QuizQuestion]


# -----------------------------
# FastAPI app
# -----------------------------
app = FastAPI(title="Quiz AI Backend", version="1.1.0")

# Dev-friendly CORS so Live Server can call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only (tighten later)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def should_use_mock() -> bool:
    """
    Decide when to use mock mode.
    We use mock if:
    - QUIZ_USE_MOCK=true
    - API key is missing
    - OpenAI SDK isn't installed/available
    """
    if QUIZ_USE_MOCK:
        return True
    if not OPENAI_API_KEY:
        return True
    if OpenAI is None:
        return True
    return False


@app.get("/health")
def health():
    """
    Quick status endpoint for the frontend.
    """
    return {"status": "ok", "mock": should_use_mock(), "model": OPENAI_MODEL}


# -----------------------------
# Mock quiz generator (offline)
# -----------------------------
def generate_mock_quiz(topic: str, difficulty: Difficulty, count: int) -> QuizResponse:
    """
    Generates a quiz without calling any AI.
    This is useful if backend is on but you don't want to spend API credits.
    """
    rng = random.Random(f"{topic}-{difficulty}-{count}")

    base_q = [
        f"Which statement about {topic} is correct?",
        f"What is a key idea in {topic}?",
        f"Choose the best answer about {topic}.",
        f"Which option best matches {topic}?",
        f"What would be an example of {topic}?",
    ]

    questions: List[QuizQuestion] = []
    for i in range(count):
        qtext = f"{base_q[i % len(base_q)]} (Q{i+1})"

        options = [
            f"{topic}: basic idea ({difficulty})",
            f"{topic}: common mistake ({difficulty})",
            f"{topic}: deeper detail ({difficulty})",
            f"{topic}: unrelated choice ({difficulty})",
        ]

        answer_index = rng.randint(0, 3)
        explanation = (
            f"Mock mode is ON. Option {answer_index + 1} is marked correct so the app works without AI."
        )

        questions.append(
            QuizQuestion(
                question=qtext,
                options=options,
                answer_index=answer_index,
                explanation=explanation,
            )
        )

    return QuizResponse(topic=topic, difficulty=difficulty, questions=questions)


# -----------------------------
# OpenAI quiz generator
# -----------------------------
SYSTEM_PROMPT = (
    "You are a strict quiz generator. "
    "Return ONLY valid JSON. "
    "No markdown. No code fences. No extra text."
)


def build_user_prompt(topic: str, difficulty: Difficulty, count: int) -> str:
    """
    We describe the exact JSON contract we want back.
    NOTE: We avoid using ["A","B","C","D"] so the model does not literally output A/B/C/D.
    """
    return f"""
Create a multiple-choice quiz.

Constraints:
- Topic: {topic}
- Difficulty: {difficulty}
- Number of questions: {count}
- Each question must have exactly 4 options.
- Exactly one correct option.
- Avoid trick questions.
- Explanations must explain WHY in 1–2 sentences.

Return JSON with this exact shape:
{{
  "topic": "{topic}",
  "difficulty": "{difficulty}",
  "questions": [
    {{
      "question": "string",
      "options": ["option 1", "option 2", "option 3", "option 4"],
      "answer_index": 0,
      "explanation": "short explanation"
    }}
  ]
}}

Rules:
- answer_index must be 0,1,2, or 3
- options must be 4 short strings
- Keep questions unambiguous
""".strip()


def call_openai_quiz(topic: str, difficulty: Difficulty, count: int) -> QuizResponse:
    """
    Calls OpenAI and enforces JSON output.
    Uses response_format=json_object to reduce 'invalid JSON' responses.
    """
    if OpenAI is None:
        raise RuntimeError("OpenAI library not available.")
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set.")

    client = OpenAI(api_key=OPENAI_API_KEY)

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(topic, difficulty, count)},
            ],
            temperature=0.4,
            # IMPORTANT: Ask the model to return strict JSON.
            response_format={"type": "json_object"},
        )
    except Exception as e:
        # Network issues, auth issues, model issues, etc.
        raise RuntimeError(f"OpenAI request failed: {e}")

    content = (resp.choices[0].message.content or "").strip()

    # Parse JSON
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(f"AI returned invalid JSON: {e}")

    # Validate schema
    try:
        quiz = QuizResponse.model_validate(data)
    except Exception as e:
        raise ValueError(f"AI JSON did not match schema: {e}")

    # Extra sanity checks
    if len(quiz.questions) != count:
        raise ValueError(f"Expected {count} questions but got {len(quiz.questions)}.")

    # Ensure each question has exactly 4 options (pydantic enforces, but keep it explicit)
    for i, q in enumerate(quiz.questions):
        if len(q.options) != 4:
            raise ValueError(f"Question {i+1} has {len(q.options)} options (expected 4).")

    return quiz


# -----------------------------
# API route
# -----------------------------
@app.post("/generate-quiz", response_model=QuizResponse)
def generate_quiz(req: QuizRequest):
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty.")

    # If mock mode is enabled OR key is missing, return mock quiz
    if should_use_mock():
        return generate_mock_quiz(topic, req.difficulty, req.count)

    # Otherwise, call OpenAI
    try:
        return call_openai_quiz(topic, req.difficulty, req.count)
    except ValueError as e:
        # Usually JSON/schema issues from the LLM
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        # Any other backend issue
        raise HTTPException(status_code=500, detail=f"Backend error: {e}")
