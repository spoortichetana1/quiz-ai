const BACKEND_BASE_URL = "http://127.0.0.1:8000";

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

const btnGenerate = document.getElementById("btnGenerate");
const btnLoadMock = document.getElementById("btnLoadMock");
const btnCancelLoading = document.getElementById("btnCancelLoading");
const loadingTitle = document.getElementById("loadingTitle");
const loadingHint = document.getElementById("loadingHint");

const quizTitle = document.getElementById("quizTitle");
const quizMeta = document.getElementById("quizMeta");
const progressText = document.getElementById("progressText");
const quizProgressBar = document.getElementById("quizProgressBar");
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

let quiz = null;
let currentIndex = 0;
let userAnswers = [];
let abortController = null;
let lastQuizPayload = null;

function showView(which) {
  [viewSetup, viewLoading, viewQuiz, viewResults].forEach((view) => view.classList.add("hidden"));
  which.classList.remove("hidden");
}

function showError(msg) {
  errorBar.textContent = msg;
  errorBar.classList.remove("hidden");
  window.clearTimeout(showError.timer);
  showError.timer = window.setTimeout(() => errorBar.classList.add("hidden"), 4200);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

function setStatus(ok, mock) {
  if (!statusPill) return;

  if (!ok) {
    statusPill.textContent = "Backend: offline";
    statusHint.textContent = "Start the backend to generate quizzes.";
    return;
  }

  statusPill.textContent = `Backend: online (${mock ? "mock" : "AI"})`;
  statusHint.textContent = mock
    ? "Backend is running in mock mode."
    : "Backend is connected and ready.";
}

async function checkBackend() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/health`, { method: "GET" });
    const data = await res.json();
    setStatus(true, !!data.mock);
  } catch {
    setStatus(false, true);
  }
}

function updateProgress() {
  if (!quiz) return;
  const total = quiz.questions.length;
  const answered = userAnswers.filter((item) => item !== null).length;
  const percent = total === 0 ? 0 : Math.round((currentIndex + 1) / total * 100);
  progressText.textContent = `${currentIndex + 1} / ${total}`;
  quizProgressBar.style.width = `${percent}%`;
  btnPrev.disabled = currentIndex === 0;
  btnNext.disabled = currentIndex === total - 1;
  btnSubmit.textContent = answered === total ? "Submit Quiz" : `Submit Quiz (${total - answered} unanswered)`;
}

function renderQuestion() {
  if (!quiz) return;

  const q = quiz.questions[currentIndex];
  const selected = userAnswers[currentIndex];

  questionArea.innerHTML = `
    <div class="qText">${escapeHtml(q.question)}</div>
    ${q.options.map((option, index) => `
      <label class="option">
        <input type="radio" name="question-option" value="${index}" ${selected === index ? "checked" : ""} />
        <span>${escapeHtml(option)}</span>
      </label>
    `).join("")}
  `;

  questionArea.querySelectorAll("input[type='radio']").forEach((radio) => {
    radio.addEventListener("change", (event) => {
      userAnswers[currentIndex] = Number(event.target.value);
      updateProgress();
    });
  });

  updateProgress();
}

function startQuiz(quizPayload) {
  lastQuizPayload = quizPayload;
  quiz = quizPayload;
  currentIndex = 0;
  userAnswers = new Array(quiz.questions.length).fill(null);

  quizTitle.textContent = `Quiz: ${quiz.topic}`;
  quizMeta.textContent = `${quiz.difficulty.toUpperCase()} • ${quiz.questions.length} questions`;
  if (reviewArea) reviewArea.classList.add("hidden");
  btnReview.textContent = "Review Answers";

  showView(viewQuiz);
  renderQuestion();
}

function calculateScore() {
  return quiz.questions.reduce((score, question, index) => (
    userAnswers[index] === question.answer_index ? score + 1 : score
  ), 0);
}

function buildReviewCards() {
  if (!reviewArea) return;

  reviewArea.innerHTML = "";

  quiz.questions.forEach((question, index) => {
    const userAnswer = userAnswers[index];
    const correctAnswer = question.answer_index;
    const isCorrect = userAnswer === correctAnswer;

    const card = document.createElement("div");
    card.className = "reviewCard";
    const explanationHtml = question.explanation
      ? `<div class="explanation"><strong>Explanation:</strong> ${escapeHtml(question.explanation)}</div>`
      : "";
    card.innerHTML = `
      <div class="badge ${isCorrect ? "good" : "wrong"}">${isCorrect ? "Correct" : "Needs review"}</div>
      <div class="qText">${escapeHtml(question.question)}</div>
      <div class="muted"><strong>Your answer:</strong> ${escapeHtml(userAnswer === null ? "No answer" : question.options[userAnswer])}</div>
      <div class="muted"><strong>Correct answer:</strong> ${escapeHtml(question.options[correctAnswer])}</div>
      ${explanationHtml}
    `;
    reviewArea.appendChild(card);
  });
}

function showResults() {
  const total = quiz.questions.length;
  const score = calculateScore();
  const pct = total === 0 ? 0 : Math.round((score / total) * 100);

  scoreText.textContent = `${score} / ${total}`;

  let message = "Keep going — every quiz builds confidence.";
  if (pct === 100) message = "Perfect score. Excellent work.";
  else if (pct >= 80) message = "Strong performance. You're close to mastery.";
  else if (pct >= 60) message = "Good progress. A second run will help.";

  scoreMessage.textContent = `${message} (${pct}%)`;
  buildReviewCards();
  reviewArea.classList.add("hidden");
  btnReview.textContent = "Review Answers";
  showView(viewResults);
}

function loadDemoQuiz() {
  startQuiz({
    topic: "Solar System",
    difficulty: "easy",
    questions: [
      {
        question: "Which planet is known as the Red Planet?",
        options: ["Earth", "Mars", "Jupiter", "Venus"],
        answer_index: 1,
        explanation: "Mars appears red because of iron oxide on its surface."
      },
      {
        question: "What is the name of our galaxy?",
        options: ["Andromeda", "Milky Way", "Whirlpool", "Sombrero"],
        answer_index: 1,
        explanation: "Our solar system is located in the Milky Way galaxy."
      },
      {
        question: "What does the Sun mainly consist of?",
        options: ["Water", "Rock", "Hydrogen and helium", "Ice"],
        answer_index: 2,
        explanation: "The Sun is mostly hydrogen with helium as the second most common element."
      },
      {
        question: "Which planet has rings that are easy to see?",
        options: ["Saturn", "Mercury", "Mars", "Earth"],
        answer_index: 0,
        explanation: "Saturn is the most famous ringed planet in our solar system."
      },
      {
        question: "What do we call a rock that burns in Earth's atmosphere?",
        options: ["Comet", "Meteor", "Planet", "Asteroid belt"],
        answer_index: 1,
        explanation: "A meteor is the visible streak caused when a space rock burns up in the atmosphere."
      }
    ]
  });
}

async function generateQuizFromBackend() {
  const topic = topicInput.value.trim();
  const difficulty = difficultySelect.value;
  const count = Number(countSelect.value);

  if (topic.length < 2) {
    showError("Type a topic first.");
    return;
  }

  loadingTitle.textContent = "Generating your quiz…";
  loadingHint.textContent = `Creating ${count} ${difficulty} questions for ${topic}.`;
  btnCancelLoading.disabled = false;
  showView(viewLoading);

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
      throw new Error(err.detail || `Backend error (${res.status})`);
    }

    const quizPayload = await res.json();
    startQuiz(quizPayload);
    checkBackend();
  } catch (error) {
    if (error.name === "AbortError") {
      showError("Generation cancelled.");
      showView(viewSetup);
      return;
    }

    showError(`Could not generate quiz: ${error.message}`);
    showView(viewSetup);
  } finally {
    abortController = null;
  }
}

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
  const unanswered = userAnswers.filter((answer) => answer === null).length;
  if (unanswered > 0 && !confirm(`You still have ${unanswered} unanswered question(s). Submit anyway?`)) {
    return;
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
  reviewArea.classList.add("hidden");
  btnReview.textContent = "Review Answers";
  showView(viewSetup);
});

btnReview.addEventListener("click", () => {
  reviewArea.classList.toggle("hidden");
  btnReview.textContent = reviewArea.classList.contains("hidden") ? "Review Answers" : "Hide Review";
});

btnTryAgain.addEventListener("click", () => {
  if (!lastQuizPayload) {
    showError("No previous quiz to retry.");
    return;
  }
  startQuiz(lastQuizPayload);
});

checkBackend();
setInterval(checkBackend, 8000);
