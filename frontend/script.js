// ===============================
// AI Quiz Generator (Frontend)
// ===============================
//
// This file controls the whole UI:
// - Setup view -> Loading -> Quiz -> Results
// - Calls backend to generate quiz
// - Tracks user answers
//
// IMPORTANT:
// Live Server runs the FRONTEND.
// Backend runs separately on http://127.0.0.1:8000
//

const BACKEND_BASE_URL = "http://127.0.0.1:8000";

// UI elements
const viewSetup = document.getElementById("viewSetup");
const viewLoading = document.getElementById("viewLoading");
const viewQuiz = document.getElementById("viewQuiz");
const viewResults = document.getElementById("viewResults");
const errorBar = document.getElementById("errorBar");
const statusPill = document.getElementById("statusPill");

const topicInput = document.getElementById("topicInput");
const difficultySelect = document.getElementById("difficultySelect");
const countSelect = document.getElementById("countSelect");

const btnGenerate = document.getElementById("btnGenerate");
const btnLoadMock = document.getElementById("btnLoadMock");
const btnCancelLoading = document.getElementById("btnCancelLoading");

const quizTitle = document.getElementById("quizTitle");
const quizMeta = document.getElementById("quizMeta");
const progressText = document.getElementById("progressText");
const questionArea = document.getElementById("questionArea");

const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnSubmit = document.getElementById("btnSubmit");
const btnRestart = document.getElementById("btnRestart");

const scoreText = document.getElementById("scoreText");
const scoreMessage = document.getElementById("scoreMessage");
const reviewArea = document.getElementById("reviewArea");
const btnNewQuiz = document.getElementById("btnNewQuiz");

// App state
let quiz = null;                // quiz payload from backend
let currentIndex = 0;           // which question user is on
let userAnswers = [];           // array of selected option indexes (number or null)
let abortController = null;     // for cancelling fetch

// ---------- Helpers ----------
function showView(which) {
  // Hide all
  viewSetup.classList.add("hidden");
  viewLoading.classList.add("hidden");
  viewQuiz.classList.add("hidden");
  viewResults.classList.add("hidden");

  // Show one
  which.classList.remove("hidden");
}

function showError(msg) {
  errorBar.textContent = msg;
  errorBar.classList.remove("hidden");
  setTimeout(() => errorBar.classList.add("hidden"), 4500);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ---------- Backend health ----------
async function checkBackend() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/health`, { method: "GET" });
    const data = await res.json();
    statusPill.textContent = `Backend: OK (${data.mock ? "mock" : "AI"})`;
  } catch {
    statusPill.textContent = "Backend: OFF (demo works)";
  }
}
checkBackend();

// ---------- Quiz rendering ----------
function renderQuestion() {
  if (!quiz) return;

  const q = quiz.questions[currentIndex];
  const total = quiz.questions.length;

  progressText.textContent = `${currentIndex + 1} / ${total}`;

  btnPrev.disabled = currentIndex === 0;
  btnNext.disabled = currentIndex === total - 1;

  const selected = userAnswers[currentIndex]; // number or null

  const optionsHtml = q.options.map((opt, idx) => {
    const checked = selected === idx ? "checked" : "";
    return `
      <label class="option">
        <input type="radio" name="opt" value="${idx}" ${checked}/>
        <span>${escapeHtml(opt)}</span>
      </label>
    `;
  }).join("");

  questionArea.innerHTML = `
    <div class="qText">${escapeHtml(q.question)}</div>
    <div>${optionsHtml}</div>
  `;

  // Attach listeners to radio buttons
  const radios = questionArea.querySelectorAll("input[type='radio']");
  radios.forEach(r => {
    r.addEventListener("change", (e) => {
      const val = Number(e.target.value);
      userAnswers[currentIndex] = val;
    });
  });
}

function startQuiz(quizPayload) {
  quiz = quizPayload;
  currentIndex = 0;
  userAnswers = new Array(quiz.questions.length).fill(null);

  quizTitle.textContent = `Quiz: ${quiz.topic}`;
  quizMeta.textContent = `Difficulty: ${quiz.difficulty} • Questions: ${quiz.questions.length}`;

  showView(viewQuiz);
  renderQuestion();
}

// ---------- Results ----------
function calculateScore() {
  let score = 0;
  for (let i = 0; i < quiz.questions.length; i++) {
    if (userAnswers[i] === quiz.questions[i].answer_index) score++;
  }
  return score;
}

function showResults() {
  const total = quiz.questions.length;
  const score = calculateScore();

  scoreText.textContent = `${score} / ${total}`;

  // Simple message
  let msg = "Good try!";
  const pct = Math.round((score / total) * 100);
  if (pct === 100) msg = "Perfect! 🏆";
  else if (pct >= 80) msg = "Great job! 🔥";
  else if (pct >= 60) msg = "Nice! Keep going 💪";
  else msg = "No worries — practice makes you better.";

  scoreMessage.textContent = `${msg} (${pct}%)`;

  // Build review cards
  reviewArea.innerHTML = "";
  quiz.questions.forEach((q, i) => {
    const ua = userAnswers[i];
    const correct = q.answer_index;
    const isCorrect = ua === correct;

    const badgeClass = isCorrect ? "badge good" : "badge wrong";
    const badgeText = isCorrect ? "Correct" : "Wrong";

    const yourAnswerText = ua === null ? "No answer" : q.options[ua];
    const correctText = q.options[correct];

    const card = document.createElement("div");
    card.className = "reviewCard";
    card.innerHTML = `
      <div class="${badgeClass}">${badgeText}</div>
      <div class="qText">${escapeHtml(q.question)}</div>
      <div class="muted"><strong>Your answer:</strong> ${escapeHtml(yourAnswerText)}</div>
      <div class="muted"><strong>Correct answer:</strong> ${escapeHtml(correctText)}</div>
      <div style="margin-top:8px;"><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</div>
    `;
    reviewArea.appendChild(card);
  });

  showView(viewResults);
}

// ---------- Demo quiz (no backend needed) ----------
function loadDemoQuiz() {
  const demo = {
    topic: "Demo: Solar System",
    difficulty: "easy",
    questions: [
      {
        question: "Which planet is known as the Red Planet?",
        options: ["Earth", "Mars", "Jupiter", "Venus"],
        answer_index: 1,
        explanation: "Mars looks reddish because of iron oxide (rust) on its surface."
      },
      {
        question: "What is the name of our galaxy?",
        options: ["Andromeda", "Milky Way", "Whirlpool", "Sombrero"],
        answer_index: 1,
        explanation: "We live in the Milky Way galaxy."
      },
      {
        question: "What does the Sun mainly consist of?",
        options: ["Water", "Rock", "Hydrogen and helium", "Ice"],
        answer_index: 2,
        explanation: "The Sun is mostly hydrogen, with helium as the second most common element."
      },
      {
        question: "Which planet has rings that are easy to see?",
        options: ["Saturn", "Mercury", "Mars", "Earth"],
        answer_index: 0,
        explanation: "Saturn is famous for its large, visible ring system."
      },
      {
        question: "What do we call a rock that burns in Earth's atmosphere?",
        options: ["Comet", "Meteor", "Planet", "Asteroid belt"],
        answer_index: 1,
        explanation: "A meteor is the streak of light when a space rock burns up in the atmosphere."
      }
    ]
  };
  startQuiz(demo);
}

// ---------- Generate quiz (calls backend) ----------
async function generateQuizFromBackend() {
  const topic = topicInput.value.trim();
  const difficulty = difficultySelect.value;
  const count = Number(countSelect.value);

  if (topic.length < 2) {
    showError("Type a topic first (at least 2 letters).");
    return;
  }

  showView(viewLoading);
  btnCancelLoading.disabled = false;

  abortController = new AbortController();

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/generate-quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({ topic, difficulty, count })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.detail || `Backend error (${res.status})`;
      throw new Error(msg);
    }

    const quizPayload = await res.json();
    startQuiz(quizPayload);
    checkBackend(); // refresh status pill (mock/ai)
  } catch (e) {
    if (e.name === "AbortError") {
      showError("Cancelled.");
      showView(viewSetup);
      return;
    }
    showError(`Could not generate quiz: ${e.message}`);
    showView(viewSetup);
  } finally {
    abortController = null;
  }
}

// ---------- Button wiring ----------
btnGenerate.addEventListener("click", generateQuizFromBackend);
btnLoadMock.addEventListener("click", loadDemoQuiz);

btnCancelLoading.addEventListener("click", () => {
  if (abortController) abortController.abort();
});

btnPrev.addEventListener("click", () => {
  if (!quiz) return;
  currentIndex = Math.max(0, currentIndex - 1);
  renderQuestion();
});

btnNext.addEventListener("click", () => {
  if (!quiz) return;
  currentIndex = Math.min(quiz.questions.length - 1, currentIndex + 1);
  renderQuestion();
});

btnSubmit.addEventListener("click", () => {
  if (!quiz) return;

  // Basic check: allow submit even if some unanswered, but warn once
  const unanswered = userAnswers.filter(a => a === null).length;
  if (unanswered > 0) {
    const ok = confirm(`You left ${unanswered} question(s) unanswered. Submit anyway?`);
    if (!ok) return;
  }

  showResults();
});

btnRestart.addEventListener("click", () => {
  // Restart same quiz (keep questions, clear answers)
  if (!quiz) return;
  currentIndex = 0;
  userAnswers = new Array(quiz.questions.length).fill(null);
  renderQuestion();
});

btnNewQuiz.addEventListener("click", () => {
  quiz = null;
  currentIndex = 0;
  userAnswers = [];
  showView(viewSetup);
});
