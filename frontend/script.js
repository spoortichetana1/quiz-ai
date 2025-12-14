// ===============================
// AI Quiz Generator (Frontend) — UPDATED
// ===============================
//
// Updated to match your UPDATED index.html:
// - Adds: statusHint, preset chips, explainSelect, loadingHint
// - Adds results controls: btnReview, btnTryAgain
// - Review area is hidden by default and toggled
//
// IMPORTANT:
// Live Server runs the FRONTEND.
// Backend runs separately on http://127.0.0.1:8000
//

const BACKEND_BASE_URL = "http://127.0.0.1:8000";

// ------------------------------
// UI Elements
// ------------------------------
const viewSetup = document.getElementById("viewSetup");
const viewLoading = document.getElementById("viewLoading");
const viewQuiz = document.getElementById("viewQuiz");
const viewResults = document.getElementById("viewResults");

const errorBar = document.getElementById("errorBar");

const statusPill = document.getElementById("statusPill");
const statusHint = document.getElementById("statusHint");

const topicInput = document.getElementById("topicInput");
const difficultySelect = document.getElementById("difficultySelect");
const countSelect = document.getElementById("countSelect");
const explainSelect = document.getElementById("explainSelect");

const btnGenerate = document.getElementById("btnGenerate");
const btnLoadMock = document.getElementById("btnLoadMock");

const btnCancelLoading = document.getElementById("btnCancelLoading");
const loadingHint = document.getElementById("loadingHint");

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
const btnReview = document.getElementById("btnReview");
const btnTryAgain = document.getElementById("btnTryAgain");

// Preset chips (optional)
const presetChips = document.querySelectorAll(".chip[data-preset]");

// ------------------------------
// App State
// ------------------------------
let quiz = null;                // quiz payload from backend
let currentIndex = 0;           // which question user is on
let userAnswers = [];           // array of selected option indexes (number or null)
let abortController = null;     // for cancelling fetch

// We keep a copy of the latest fetched quiz so "Try Again" can restart it cleanly
let lastQuizPayload = null;

// ------------------------------
// Helpers
// ------------------------------
function showView(which) {
  viewSetup.classList.add("hidden");
  viewLoading.classList.add("hidden");
  viewQuiz.classList.add("hidden");
  viewResults.classList.add("hidden");
  which.classList.remove("hidden");
}

function showError(msg) {
  errorBar.textContent = msg;
  errorBar.classList.remove("hidden");
  setTimeout(() => errorBar.classList.add("hidden"), 4500);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

function isExplainOn() {
  // If explainSelect doesn't exist for any reason, default to YES
  if (!explainSelect) return true;
  return explainSelect.value === "yes";
}

function setStatus(ok, mock) {
  if (!statusPill) return;

  if (!ok) {
    statusPill.textContent = "Backend: OFF (demo works)";
    if (statusHint) statusHint.textContent = "Start bhackend to use AI generation.";
    return;
  }

  statusPill.textContent = `Backend: OK (${mock ? "mock" : "AI"})`;
  if (statusHint) {
    statusHint.textContent = mock
      ? "Backend is ON, but in MOCK mode. Set QUIZ_USE_MOCK=false for real AI."
      : "Backend is ON and using AI 🎉";
  }
}

// ------------------------------
// Backend health
// ------------------------------
async function checkBackend() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/health`, { method: "GET" });
    const data = await res.json();
    setStatus(true, !!data.mock);
  } catch {
    setStatus(false, true);
  }
}

// Call once on load
checkBackend();

// ------------------------------
// Quiz Rendering
// ------------------------------
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
  lastQuizPayload = quizPayload; // store for "Try Again"
  quiz = quizPayload;
  currentIndex = 0;
  userAnswers = new Array(quiz.questions.length).fill(null);

  quizTitle.textContent = `Quiz: ${quiz.topic}`;
  quizMeta.textContent = `Difficulty: ${quiz.difficulty} • Questions: ${quiz.questions.length}`;

  // Hide results review by default when starting quiz
  if (reviewArea) reviewArea.classList.add("hidden");

  showView(viewQuiz);
  renderQuestion();
}

// ------------------------------
// Results
// ------------------------------
function calculateScore() {
  let score = 0;
  for (let i = 0; i < quiz.questions.length; i++) {
    if (userAnswers[i] === quiz.questions[i].answer_index) score++;
  }
  return score;
}

function buildReviewCards() {
  if (!reviewArea) return;

  reviewArea.innerHTML = "";

  quiz.questions.forEach((q, i) => {
    const ua = userAnswers[i];
    const correct = q.answer_index;
    const isCorrect = ua === correct;

    const badgeClass = isCorrect ? "badge good" : "badge wrong";
    const badgeText = isCorrect ? "Correct" : "Wrong";

    const yourAnswerText = ua === null ? "No answer" : q.options[ua];
    const correctText = q.options[correct];

    const explanationBlock = isExplainOn()
      ? `<div style="margin-top:8px;"><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</div>`
      : "";

    const card = document.createElement("div");
    card.className = "reviewCard";
    card.innerHTML = `
      <div class="${badgeClass}">${badgeText}</div>
      <div class="qText">${escapeHtml(q.question)}</div>
      <div class="muted"><strong>Your answer:</strong> ${escapeHtml(yourAnswerText)}</div>
      <div class="muted"><strong>Correct answer:</strong> ${escapeHtml(correctText)}</div>
      ${explanationBlock}
    `;
    reviewArea.appendChild(card);
  });
}

function showResults() {
  const total = quiz.questions.length;
  const score = calculateScore();
  scoreText.textContent = `${score} / ${total}`;

  const pct = Math.round((score / total) * 100);
  let msg = "Good try!";
  if (pct === 100) msg = "Perfect! 🏆";
  else if (pct >= 80) msg = "Great job! 🔥";
  else if (pct >= 60) msg = "Nice! Keep going 💪";
  else msg = "No worries — practice makes you better.";

  scoreMessage.textContent = `${msg} (${pct}%)`;

  // Build review cards but keep hidden until user clicks "Review Answers"
  buildReviewCards();
  if (reviewArea) reviewArea.classList.add("hidden");

  showView(viewResults);
}

// ------------------------------
// Demo quiz (no backend needed)
// ------------------------------
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

// ------------------------------
// Generate quiz (calls backend)
// ------------------------------
async function generateQuizFromBackend() {
  const topic = topicInput.value.trim();
  const difficulty = difficultySelect.value;
  const count = Number(countSelect.value);

  if (topic.length < 2) {
    showError("Type a topic first (at least 2 letters).");
    return;
  }

  showView(viewLoading);
  if (loadingHint) loadingHint.textContent = "Generating your quiz… This may take a few seconds.";
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

    // Refresh backend status pill (mock/ai)
    checkBackend();
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

// ------------------------------
// Button wiring
// ------------------------------
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

  const unanswered = userAnswers.filter(a => a === null).length;
  if (unanswered > 0) {
    const ok = confirm(`You left ${unanswered} question(s) unanswered. Submit anyway?`);
    if (!ok) return;
  }

  showResults();
});

btnRestart.addEventListener("click", () => {
  if (!quiz) return;
  currentIndex = 0;
  userAnswers = new Array(quiz.questions.length).fill(null);
  renderQuestion();
});

btnNewQuiz.addEventListener("click", () => {
  quiz = null;
  lastQuizPayload = null;
  currentIndex = 0;
  userAnswers = [];
  if (reviewArea) reviewArea.classList.add("hidden");
  showView(viewSetup);
});

// New: Toggle review in results view
btnReview.addEventListener("click", () => {
  if (!reviewArea) return;
  reviewArea.classList.toggle("hidden");
  btnReview.textContent = reviewArea.classList.contains("hidden") ? "Review Answers" : "Hide Review";
});

// New: Try the SAME quiz again (same questions, fresh answers)
btnTryAgain.addEventListener("click", () => {
  if (!lastQuizPayload) {
    showError("No previous quiz to retry.");
    return;
  }
  startQuiz(lastQuizPayload);
});

// ------------------------------
// Preset chips
// ------------------------------
presetChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const preset = chip.getAttribute("data-preset") || "";
    topicInput.value = preset;
    topicInput.focus();
  });
});

// Refresh backend status every ~8 seconds (helps kids see when it turns on/off)
setInterval(checkBackend, 8000);
