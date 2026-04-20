
// ============================================
// StudyBuddy - AI Study Companion
// ============================================
 
const CLAUDE_MODEL = 'claude-sonnet-4-6';
 
// ---- State ----
 
let apiKey = localStorage.getItem('studybuddy_api_key') || '';
let currentTopic = '';
let currentExplanation = '';
let questions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let fontSize = parseInt(localStorage.getItem('studybuddy_font_size')) || 16;
let capturedImageBase64 = null;
let capturedImageMediaType = null;
 
// ---- DOM Elements ----
 
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
 
const apiSetup = $('#api-setup');
const apiKeyInput = $('#api-key-input');
const saveApiKeyBtn = $('#save-api-key');
 
const stepExplain = $('#step-explain');
const topicInput = $('#topic-input');
const explainBtn = $('#explain-btn');
 
const stepExplanation = $('#step-explanation');
const explanationContent = $('#explanation-content');
const quizBtn = $('#quiz-btn');
const newTopicBtn = $('#new-topic-btn');
 
const stepQuiz = $('#step-quiz');
const questionCounter = $('#question-counter');
const questionText = $('#question-text');
const choicesDiv = $('#choices');
const feedbackArea = $('#feedback-area');
const nextQuestionBtn = $('#next-question-btn');
 
const stepResults = $('#step-results');
const scoreDisplay = $('#score-display');
const resultsBreakdown = $('#results-breakdown');
const retryQuizBtn = $('#retry-quiz-btn');
const newTopicBtn2 = $('#new-topic-btn-2');
 
const loading = $('#loading');
const loadingText = $('#loading-text');
 
const themeToggle = $('#theme-toggle');
const themePanel = $('#theme-panel');
const closeThemePanel = $('#close-theme-panel');
 
// ---- Initialize ----
 
function init() {
  if (apiKey) {
    apiSetup.classList.add('hidden');
  } else {
    stepExplain.classList.add('hidden');
  }
 
  applyFontSize();
  loadTheme();
  bindEvents();
}
 
// ---- Event Bindings ----
 
function bindEvents() {
  saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
  $('#clear-api-key').addEventListener('click', handleClearApiKey);
  explainBtn.addEventListener('click', handleExplain);
  quizBtn.addEventListener('click', handleGenerateQuiz);
  newTopicBtn.addEventListener('click', resetToStart);
  newTopicBtn2.addEventListener('click', resetToStart);
  nextQuestionBtn.addEventListener('click', handleNextQuestion);
  retryQuizBtn.addEventListener('click', handleRetryQuiz);
 
  // Theme panel
  themeToggle.addEventListener('click', () => themePanel.classList.add('open'));
  closeThemePanel.addEventListener('click', () => themePanel.classList.remove('open'));
 
  // Preset themes
  $$('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyPresetTheme(btn.dataset.theme);
    });
  });
 
  // Background styles
  $$('.bg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.bg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyBackground(btn.dataset.bg);
    });
  });
 
  // Custom colors
  $('#accent-color').addEventListener('input', (e) => {
    setCustomColors({ accent: e.target.value });
  });
  $('#bg-color').addEventListener('input', (e) => {
    setCustomColors({ bg: e.target.value });
  });
  $('#text-color').addEventListener('input', (e) => {
    setCustomColors({ text: e.target.value });
  });
 
  // Font size
  $('#font-decrease').addEventListener('click', () => changeFontSize(-1));
  $('#font-increase').addEventListener('click', () => changeFontSize(1));
 
  // Custom background upload
  $('#bg-upload').addEventListener('change', handleBgUpload);
  $('#remove-custom-bg').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeCustomBg();
  });

  // Reset theme
  $('#reset-theme').addEventListener('click', resetTheme);
 
  // Camera / photo upload
  $('#photo-input').addEventListener('change', handlePhotoSelected);
  $('#remove-photo-btn').addEventListener('click', clearPhoto);

  // Enter key on textarea
  topicInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExplain();
    }
  });
 
  // Enter key on API input
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSaveApiKey();
  });
}
 
function handleClearApiKey() {
  themePanel.classList.remove('open');
  const previousKey = apiKey;
  history.pushState({ apiChange: true, previousKey }, '');
  apiKey = '';
  localStorage.removeItem('studybuddy_api_key');
  apiKeyInput.value = '';
  apiSetup.classList.remove('hidden');
  stepExplain.classList.add('hidden');
  stepExplanation.classList.add('hidden');
  stepQuiz.classList.add('hidden');
  stepResults.classList.add('hidden');
}

window.addEventListener('popstate', (e) => {
  if (e.state?.apiChange && e.state.previousKey) {
    apiKey = e.state.previousKey;
    localStorage.setItem('studybuddy_api_key', apiKey);
    apiSetup.classList.add('hidden');
    stepExplain.classList.remove('hidden');
  }
});

// ---- Photo Handling ----

function handlePhotoSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const objectUrl = URL.createObjectURL(file);
  const preview = $('#photo-preview');

  // Show thumbnail area immediately
  $('#photo-preview-wrap').classList.remove('hidden');
  $('#camera-btn').classList.add('hidden');
  $('#topic-input').closest('.textarea-wrap').classList.add('has-photo');

  preview.onerror = async () => {
    // Browser can't display this format (e.g. HEIC on Chrome) — convert via heic2any
    preview.onerror = null;
    URL.revokeObjectURL(objectUrl);
    if (typeof heic2any === 'undefined') return;
    try {
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      const convertedUrl = URL.createObjectURL(blob);
      preview.src = convertedUrl;
      prepareForApi(blob, convertedUrl);
    } catch (err) {
      console.warn('HEIC conversion failed:', err);
    }
  };

  preview.onload = () => {
    preview.onload = null;
    prepareForApi(file, objectUrl);
  };

  preview.src = objectUrl;
}

function prepareForApi(file, objectUrl) {
  const img = new Image();
  img.onload = () => {
    const MAX = 1600;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
      else { w = Math.round(w * MAX / h); h = MAX; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const [header, base64Data] = jpegDataUrl.split(',');
    capturedImageBase64 = base64Data;
    capturedImageMediaType = header.match(/data:([^;]+)/)[1];
    URL.revokeObjectURL(objectUrl);
  };
  img.src = objectUrl;
}

function clearPhoto() {
  capturedImageBase64 = null;
  capturedImageMediaType = null;
  $('#photo-input').value = '';
  $('#photo-preview-wrap').classList.add('hidden');
  $('#camera-btn').classList.remove('hidden');
  $('#topic-input').closest('.textarea-wrap').classList.remove('has-photo');
}

// ---- API Key ----
 
function handleSaveApiKey() {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  apiKey = key;
  localStorage.setItem('studybuddy_api_key', key);
  apiSetup.classList.add('hidden');
  stepExplain.classList.remove('hidden');
}
 
// ---- Claude API Call ----
 
async function callClaude(systemPrompt, userMessage, imageBase64 = null, imageMediaType = null) {
  let content;
  if (imageBase64) {
    content = [
      { type: 'image', source: { type: 'base64', media_type: imageMediaType, data: imageBase64 } },
      { type: 'text', text: userMessage }
    ];
  } else {
    content = userMessage;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content }]
    })
  });
 
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your key and try again.');
    }
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }
 
  const data = await response.json();
  return data.content[0].text;
}
 
// ---- Feature 1: Explain This to Me ----
 
async function handleExplain() {
  const topic = topicInput.value.trim();
  if (!topic && !capturedImageBase64) return;

  currentTopic = topic || 'the content in the photo';
  showLoading('Breaking it down for you...');
  explainBtn.disabled = true;

  try {
    const systemPrompt = `You are a friendly, patient study tutor. Your job is to explain topics in clear, simple language that anyone can understand. Use short paragraphs, bullet points where helpful, and real-world analogies. Avoid jargon unless you immediately define it. Write in a warm, encouraging tone. Format your response in HTML using <p>, <ul>, <li>, <ol>, and <strong> tags for structure.`;

    const userMessage = topic
      ? `Please explain this topic to me in a clear and simple way:\n\n${topic}`
      : `Please look at this image and explain the topic or content shown in it in a clear and simple way.`;

    const explanation = await callClaude(systemPrompt, userMessage, capturedImageBase64, capturedImageMediaType);
    currentExplanation = explanation;
 
    explanationContent.innerHTML = explanation;
    hideLoading();
    stepExplain.classList.add('hidden');
    stepExplanation.classList.remove('hidden');
  } catch (err) {
    hideLoading();
    alert(err.message);
  } finally {
    explainBtn.disabled = false;
  }
}
 
// ---- Feature 2: Practice Question Generator ----
 
async function handleGenerateQuiz() {
  showLoading('Creating practice questions...');
  quizBtn.disabled = true;
 
  try {
    const systemPrompt = `You are a study quiz generator. Based on the topic and explanation provided, generate exactly 5 multiple-choice questions to test understanding. Each question should have 4 options (A, B, C, D) with exactly one correct answer.
 
IMPORTANT: Return ONLY valid JSON, no other text. Use this exact format:
{
  "questions": [
    {
      "question": "The question text",
      "choices": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "correctIndex": 0,
      "explanation": "A 1-2 sentence explanation of why the correct answer is right and why a common wrong answer is wrong."
    }
  ]
}`;
 
    const userMsg = `Topic: ${currentTopic}\n\nExplanation given:\n${stripHtml(currentExplanation)}\n\nGenerate 5 practice questions.`;
    const response = await callClaude(systemPrompt, userMsg);
 
    // Parse JSON from response (handle possible markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    jsonStr = jsonStr.trim();
 
    const parsed = JSON.parse(jsonStr);
    questions = parsed.questions;
    currentQuestionIndex = 0;
    userAnswers = [];
 
    hideLoading();
    stepExplanation.classList.add('hidden');
    stepQuiz.classList.remove('hidden');
    showQuestion();
  } catch (err) {
    hideLoading();
    alert('Error generating quiz: ' + err.message);
  } finally {
    quizBtn.disabled = false;
  }
}
 
// ---- Feature 3: Answer Feedback ----
 
function showQuestion() {
  const q = questions[currentQuestionIndex];
  questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
  questionText.textContent = q.question;
 
  feedbackArea.classList.add('hidden');
  feedbackArea.className = 'feedback hidden';
  nextQuestionBtn.classList.add('hidden');
 
  choicesDiv.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];
 
  q.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<span class="choice-letter">${letters[i]}</span><span>${escapeHtml(choice)}</span>`;
    btn.addEventListener('click', () => handleAnswer(i, btn));
    choicesDiv.appendChild(btn);
  });
}
 
function handleAnswer(selectedIndex, selectedBtn) {
  const q = questions[currentQuestionIndex];
  const isCorrect = selectedIndex === q.correctIndex;
 
  // Disable all buttons
  const allBtns = choicesDiv.querySelectorAll('.choice-btn');
  allBtns.forEach(btn => btn.disabled = true);
 
  // Highlight selected answer
  if (isCorrect) {
    selectedBtn.classList.add('correct');
  } else {
    selectedBtn.classList.add('incorrect');
    // Show the correct answer
    allBtns[q.correctIndex].classList.add('show-correct');
  }
 
  // Show feedback
  feedbackArea.classList.remove('hidden');
  if (isCorrect) {
    feedbackArea.className = 'feedback correct-feedback';
    feedbackArea.innerHTML = `<span class="feedback-icon">&#10003;</span> <strong>Correct!</strong> ${escapeHtml(q.explanation)}`;
  } else {
    feedbackArea.className = 'feedback incorrect-feedback';
    feedbackArea.innerHTML = `<span class="feedback-icon">&#10007;</span> <strong>Not quite.</strong> ${escapeHtml(q.explanation)}`;
  }
 
  userAnswers.push({
    questionIndex: currentQuestionIndex,
    selected: selectedIndex,
    correct: isCorrect
  });
 
  // Show next button
  if (currentQuestionIndex < questions.length - 1) {
    nextQuestionBtn.textContent = 'Next Question';
  } else {
    nextQuestionBtn.textContent = 'See Results';
  }
  nextQuestionBtn.classList.remove('hidden');
}
 
function handleNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex < questions.length) {
    showQuestion();
  } else {
    showResults();
  }
}
 
// ---- Results ----
 
function showResults() {
  const correct = userAnswers.filter(a => a.correct).length;
  const total = questions.length;
  const pct = Math.round((correct / total) * 100);
 
  let message = '';
  if (pct === 100) message = 'Perfect score! You really know this topic!';
  else if (pct >= 80) message = 'Great job! You have a solid understanding.';
  else if (pct >= 60) message = 'Good effort! Review the ones you missed.';
  else message = 'Keep studying — you\'ll get there! Try reading the explanation again.';
 
  scoreDisplay.innerHTML = `
    <div class="score-number">${correct}/${total}</div>
    <div class="score-label">${pct}% correct</div>
    <div class="score-message">${message}</div>
  `;
 
  resultsBreakdown.innerHTML = '';
  questions.forEach((q, i) => {
    const answer = userAnswers[i];
    const div = document.createElement('div');
    div.className = `result-item ${answer.correct ? 'correct-result' : 'incorrect-result'}`;
    div.innerHTML = `
      <div class="result-question">${i + 1}. ${escapeHtml(q.question)}</div>
      <div class="result-answer">
        Your answer: ${escapeHtml(q.choices[answer.selected])}
        ${answer.correct ? '&#10003;' : `&#10007; &mdash; Correct: ${escapeHtml(q.choices[q.correctIndex])}`}
      </div>
    `;
    resultsBreakdown.appendChild(div);
  });
 
  stepQuiz.classList.add('hidden');
  stepResults.classList.remove('hidden');
}
 
function handleRetryQuiz() {
  currentQuestionIndex = 0;
  userAnswers = [];
  stepResults.classList.add('hidden');
  stepQuiz.classList.remove('hidden');
  showQuestion();
}
 
function resetToStart() {
  stepExplanation.classList.add('hidden');
  stepQuiz.classList.add('hidden');
  stepResults.classList.add('hidden');
  stepExplain.classList.remove('hidden');
  topicInput.value = '';
  currentTopic = '';
  currentExplanation = '';
  questions = [];
  userAnswers = [];
}
 
// ---- Theme System ----
 
const themes = {
  light: {
    accent: '#6366f1',
    accentHover: '#4f46e5',
    bg: '#f8fafc',
    bgCard: '#ffffff',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    accentTint: '#e0e7ff'
  },
  dark: {
    accent: '#818cf8',
    accentHover: '#6366f1',
    bg: '#1e1e2e',
    bgCard: '#2a2a3e',
    text: '#e2e8f0',
    textSecondary: '#94a3b8',
    border: '#3f3f5e',
    accentTint: '#2e2e4e'
  },
  'soft-pink': {
    accent: '#ec4899',
    accentHover: '#db2777',
    bg: '#fdf2f8',
    bgCard: '#ffffff',
    text: '#1e293b',
    textSecondary: '#6b7280',
    border: '#fbcfe8',
    accentTint: '#fce7f3'
  },
  forest: {
    accent: '#22c55e',
    accentHover: '#16a34a',
    bg: '#f0fdf4',
    bgCard: '#ffffff',
    text: '#1e293b',
    textSecondary: '#6b7280',
    border: '#bbf7d0',
    accentTint: '#dcfce7'
  },
  midnight: {
    accent: '#60a5fa',
    accentHover: '#3b82f6',
    bg: '#0f172a',
    bgCard: '#1e293b',
    text: '#e2e8f0',
    textSecondary: '#94a3b8',
    border: '#334155',
    accentTint: '#1e3a5f'
  },
  sunset: {
    accent: '#f59e0b',
    accentHover: '#d97706',
    bg: '#fffbeb',
    bgCard: '#ffffff',
    text: '#1e293b',
    textSecondary: '#6b7280',
    border: '#fde68a',
    accentTint: '#fef3c7'
  }
};
 
function applyPresetTheme(themeName) {
  const theme = themes[themeName];
  if (!theme) return;
 
  const root = document.documentElement;
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-hover', theme.accentHover);
  root.style.setProperty('--bg', theme.bg);
  root.style.setProperty('--bg-card', theme.bgCard);
  root.style.setProperty('--text', theme.text);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--border', theme.border);
  root.style.setProperty('--accent-tint', theme.accentTint);
 
  // Update color pickers
  $('#accent-color').value = theme.accent;
  $('#bg-color').value = theme.bg;
  $('#text-color').value = theme.text;
 
  saveTheme(themeName);
}
 
function applyBackground(bgType) {
  document.body.classList.remove('bg-gradient', 'bg-library', 'bg-coffee', 'bg-stars', 'bg-custom');
  if (bgType === 'custom') {
    const saved = localStorage.getItem('studybuddy_custom_bg');
    if (saved) {
      document.body.style.backgroundImage = `url(${saved})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.classList.add('bg-custom');
    }
  } else {
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    if (bgType !== 'solid') document.body.classList.add('bg-' + bgType);
  }
  localStorage.setItem('studybuddy_bg', bgType);
  updateCustomBgPill();
}

function handleBgUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      localStorage.setItem('studybuddy_custom_bg', ev.target.result);
    } catch {
      alert('Image is too large to save. Please try a smaller image.');
      return;
    }
    $$('.bg-btn').forEach(b => b.classList.remove('active'));
    $('#custom-bg-btn').classList.add('active');
    applyBackground('custom');
  };
  reader.readAsDataURL(file);
}

function removeCustomBg() {
  localStorage.removeItem('studybuddy_custom_bg');
  $('#bg-upload').value = '';
  $$('.bg-btn').forEach(b => b.classList.toggle('active', b.dataset.bg === 'solid'));
  applyBackground('solid');
}

function updateCustomBgPill() {
  const hasBg = !!localStorage.getItem('studybuddy_custom_bg');
  $('#custom-bg-label').classList.toggle('hidden', hasBg);
  $('#custom-bg-thumb').classList.toggle('hidden', !hasBg);
  if (hasBg) {
    $('#custom-bg-preview').src = localStorage.getItem('studybuddy_custom_bg');
  }
}
 
function setCustomColors({ accent, bg, text }) {
  const root = document.documentElement;
  if (accent) {
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-hover', accent);
  }
  if (bg) root.style.setProperty('--bg', bg);
  if (text) root.style.setProperty('--text', text);
 
  // Deselect preset
  $$('.preset-btn').forEach(b => b.classList.remove('active'));
 
  localStorage.setItem('studybuddy_custom_colors', JSON.stringify({
    accent: $('#accent-color').value,
    bg: $('#bg-color').value,
    text: $('#text-color').value
  }));
}
 
function changeFontSize(delta) {
  fontSize = Math.max(12, Math.min(24, fontSize + delta));
  applyFontSize();
  localStorage.setItem('studybuddy_font_size', fontSize);
}
 
function applyFontSize() {
  document.documentElement.style.setProperty('--font-size', fontSize + 'px');
  $('#font-size-label').textContent = fontSize + 'px';
}
 
function saveTheme(themeName) {
  localStorage.setItem('studybuddy_theme', themeName);
  // Clear custom colors when a preset is selected
  localStorage.removeItem('studybuddy_custom_colors');
}
 
function loadTheme() {
  // Load font size
  applyFontSize();
 
  // Load preset theme
  const savedTheme = localStorage.getItem('studybuddy_theme');
  if (savedTheme && themes[savedTheme]) {
    applyPresetTheme(savedTheme);
    $$('.preset-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === savedTheme);
    });
  }
 
  // Load custom colors (overrides preset)
  const savedCustom = localStorage.getItem('studybuddy_custom_colors');
  if (savedCustom) {
    try {
      const colors = JSON.parse(savedCustom);
      if (colors.accent) {
        document.documentElement.style.setProperty('--accent', colors.accent);
        $('#accent-color').value = colors.accent;
      }
      if (colors.bg) {
        document.documentElement.style.setProperty('--bg', colors.bg);
        $('#bg-color').value = colors.bg;
      }
      if (colors.text) {
        document.documentElement.style.setProperty('--text', colors.text);
        $('#text-color').value = colors.text;
      }
      $$('.preset-btn').forEach(b => b.classList.remove('active'));
    } catch (e) { /* ignore */ }
  }
 
  // Load background
  const savedBg = localStorage.getItem('studybuddy_bg');
  if (savedBg) {
    applyBackground(savedBg);
    $$('.bg-btn').forEach(b => b.classList.toggle('active', b.dataset.bg === savedBg));
  }
  updateCustomBgPill();
}
 
function resetTheme() {
  localStorage.removeItem('studybuddy_theme');
  localStorage.removeItem('studybuddy_custom_colors');
  localStorage.removeItem('studybuddy_bg');
  localStorage.removeItem('studybuddy_custom_bg');
  localStorage.removeItem('studybuddy_font_size');
 
  fontSize = 16;
  applyFontSize();
  applyPresetTheme('light');
  applyBackground('solid');
 
  $$('.preset-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === 'light');
  });
  $$('.bg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.bg === 'solid');
  });
}
 
// ---- Utility ----
 
function showLoading(text) {
  loadingText.textContent = text || 'Thinking...';
  loading.classList.remove('hidden');
}
 
function hideLoading() {
  loading.classList.add('hidden');
}
 
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
 
function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}
 
// ---- Start ----
 
init();