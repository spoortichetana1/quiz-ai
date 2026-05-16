const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();
const port = process.env.PORT || 8000;
const openAIKey = process.env.OPENAI_API_KEY?.trim();
const useMock = process.env.QUIZ_USE_MOCK === "true";
const model = process.env.OPENAI_MODEL || "gpt-4o";

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", mock: useMock || !openAIKey });
});

app.post("/generate-quiz", async (req, res) => {
  const { topic, difficulty, count } = req.body || {};

  if (!topic || typeof topic !== "string" || topic.trim().length < 2) {
    return res.status(400).json({ detail: "Topic must be a non-empty string." });
  }

  const normalizedDifficulty = ["easy", "medium", "hard"].includes(difficulty)
    ? difficulty
    : "medium";

  const questionCount = Number(count) || 5;
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 20) {
    return res.status(400).json({ detail: "count must be an integer between 1 and 20." });
  }

  try {
    const quiz = await generateQuiz(topic.trim(), normalizedDifficulty, questionCount);
    res.json(quiz);
  } catch (error) {
    console.error("Quiz generation failed:", error);
    res.status(502).json({ detail: error?.message || "Failed to generate quiz using the LLM." });
  }
});

app.use((req, res) => {
  res.status(404).json({ detail: "Not found" });
});

app.listen(port, () => {
  console.log(`Quiz backend running on http://127.0.0.1:${port}`);
  console.log(`Mock mode: ${useMock}`);
});

async function generateQuiz(topic, difficulty, count) {
  if (!openAIKey && !useMock) {
    throw new Error("OPENAI_API_KEY is required to generate quizzes. Set QUIZ_USE_MOCK=true to enable mock mode.");
  }

  if (useMock || !openAIKey) {
    return generateMockQuiz(topic, difficulty, count);
  }

  const payload = createQuizPrompt(topic, difficulty, count);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAIKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${bodyText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response did not contain a completion message.");
  }

  const quiz = parseQuizJson(content);
  validateQuizPayload(quiz, topic, difficulty, count);
  return quiz;
}

function createQuizPrompt(topic, difficulty, count) {
  return {
    model,
    temperature: 0.7,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "You are a quiz generation assistant. Respond with valid JSON only, without markdown or any text outside the JSON object."
      },
      {
        role: "user",
        content: `Generate a multiple-choice quiz on the topic "${topic}" with difficulty "${difficulty}". Return a single JSON object with this schema:\n\n{\n  \"topic\": string,\n  \"difficulty\": string,\n  \"questions\": [\n    {\n      \"question\": string,\n      \"options\": [string, string, string, string],\n      \"answer_index\": number,\n      \"explanation\": string\n    }\n  ]\n}\n\nUse exactly ${count} questions. Choose the question text, four answer options, the correct index, and an explanation yourself. Do not include any additional text outside the JSON object.`
      }
    ]
  };
}

function parseQuizJson(text) {
  const jsonText = extractJson(text);
  return JSON.parse(jsonText);
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unable to extract JSON from LLM response.");
  }
  return text.slice(start, end + 1);
}

function validateQuizPayload(quiz, topic, difficulty, count) {
  if (!quiz || quiz.topic !== topic || quiz.difficulty !== difficulty || !Array.isArray(quiz.questions)) {
    throw new Error("Invalid quiz payload from LLM.");
  }

  if (quiz.questions.length !== count) {
    throw new Error(`Expected ${count} questions but got ${quiz.questions.length}.`);
  }

  for (const question of quiz.questions) {
    if (
      !question ||
      typeof question.question !== "string" ||
      !Array.isArray(question.options) ||
      question.options.length !== 4 ||
      typeof question.answer_index !== "number" ||
      question.answer_index < 0 ||
      question.answer_index > 3 ||
      typeof question.explanation !== "string"
    ) {
      throw new Error("Invalid question format returned by LLM.");
    }
  }
}

function generateMockQuiz(topic, difficulty, count) {
  return {
    topic,
    difficulty,
    questions: Array.from({ length: count }, (_, index) => ({
      question: `Quiz placeholder ${index + 1} for ${topic}`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      answer_index: 0,
      explanation: "This is a placeholder quiz because LLM generation is not enabled."
    }))
  };
}
