import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.main import QuizQuestion, QuizResponse, app  # noqa: E402

client = TestClient(app)


def build_sample_quiz(topic: str, difficulty: str, count: int) -> QuizResponse:
    questions = []
    for i in range(count):
        options = [f"Option {idx}" for idx in range(1, 5)]
        questions.append(
            QuizQuestion(
                question=f"Sample question {i+1}",
                options=options,
                answer_index=i % 4,
                explanation="Sample explanation.",
            )
        )
    return QuizResponse(topic=topic, difficulty=difficulty, questions=questions)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["mock"] is False
    assert payload["mode"] == "ai"
    assert "model" in payload


def test_generate_quiz_endpoint(monkeypatch):
    def fake_call_openai_quiz(topic: str, difficulty: str, count: int) -> QuizResponse:
        return build_sample_quiz(topic, difficulty, count)

    monkeypatch.setattr("backend.main.call_openai_quiz", fake_call_openai_quiz)

    payload = {"topic": "space exploration", "difficulty": "easy", "count": 2}
    response = client.post("/generate-quiz", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["topic"] == payload["topic"]
    assert body["difficulty"] == payload["difficulty"]
    assert isinstance(body["questions"], list)
    assert len(body["questions"]) == payload["count"]

    for question in body["questions"]:
        options = question["options"]
        assert isinstance(options, list)
        assert len(options) == 4
        answer_index = question["answer_index"]
        assert isinstance(answer_index, int)
        assert 0 <= answer_index <= 3
