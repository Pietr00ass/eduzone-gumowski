import { fallbackQuestions } from './fallbackQuestions.js';
import { DEFAULT_CONFIG, DEFAULT_USER, GAME_MODES, HISTORY_LIMIT, STORAGE_KEYS } from './constants.js';
import { getCategories, suggestQuestionId, validateQuestions, buildQuestionCardMarkup } from './questions.js';
import {
  buildWeakSpotQuestionSet,
  createHistoryEntry,
  getAccuracyTrend,
  getExamReadiness,
  getHardestCategory,
  getHistoryMetrics,
  getMostMistakenQuestions,
  getRecommendedSession,
  normalizeHistoryEntry,
} from './history.js';
import {
  buildQuizSet,
  computePoints,
  createReviewItem,
  createSessionSummary,
  filterSessionReview,
  getFinishReasonLabel,
  getModeConfig,
  getSessionAchievements,
  getSessionReviewCounts,
  getTimePerQuestionMs,
} from './session.js';
import { clamp, escapeHtml, formatAnswer, formatDuration, formatPercentage, getAvatarLabel, labelForCategory, safeJsonParse } from './utils.js';

const elements = {
  statusBox: document.querySelector('#status'),
  configForm: document.querySelector('#config-form'),
  userForm: document.querySelector('#user-form'),
  questionsEditor: document.querySelector('#questions-editor'),
  questionLibrary: document.querySelector('#question-library'),
  questionSummary: document.querySelector('#question-summary'),
  questionFilter: document.querySelector('#question-filter'),
  leaderboard: document.querySelector('#leaderboard'),
  leaderboardPreview: document.querySelector('#leaderboard-preview'),
  leaderboardFilter: document.querySelector('#leaderboard-filter'),
  quizPanel: document.querySelector('#quiz-panel'),
  quizActions: document.querySelector('#quiz-actions'),
  userSummary: document.querySelector('#user-summary'),
  profileCard: document.querySelector('#profile-card'),
  modeCards: document.querySelector('#mode-cards'),
  modeCardsPlay: document.querySelector('#mode-cards-play'),
  statSource: document.querySelector('#stat-source'),
  statCount: document.querySelector('#stat-count'),
  statMode: document.querySelector('#stat-mode'),
  statBest: document.querySelector('#stat-best'),
  overviewInsights: document.querySelector('#overview-insights'),
  mistakeHotspots: document.querySelector('#mistake-hotspots'),
  sidebarAvatar: document.querySelector('#sidebar-avatar'),
  sidebarNickname: document.querySelector('#sidebar-nickname'),
  sidebarEmail: document.querySelector('#sidebar-email'),
  sidebarGames: document.querySelector('#sidebar-games'),
  sidebarPoints: document.querySelector('#sidebar-points'),
  sidebarAccuracy: document.querySelector('#sidebar-accuracy'),
  configNote: document.querySelector('#config-note'),
  quickQuestionForm: document.querySelector('#quick-question-form'),
  quickQuestionPreview: document.querySelector('#quick-question-preview'),
  startQuizBtn: document.querySelector('#start-quiz-btn'),
  weakSpotsBtn: document.querySelector('#weak-spots-btn'),
  weakSpotsStatus: document.querySelector('#weak-spots-status'),
  recommendedConfigBtn: document.querySelector('#recommended-config-btn'),
  saveQuestionsBtn: document.querySelector('#save-questions-btn'),
  restoreDefaultsBtn: document.querySelector('#restore-defaults-btn'),
  exportBtn: document.querySelector('#export-btn'),
  exportBackupBtn: document.querySelector('#export-backup-btn'),
  importFileInput: document.querySelector('#import-file-input'),
  backupFileInput: document.querySelector('#backup-file-input'),
  seedDemoBtn: document.querySelector('#seed-demo-btn'),
  loginShortcutBtn: document.querySelector('#login-shortcut-btn'),
  clearLeaderboardBtn: document.querySelector('#clear-leaderboard-btn'),
  exportLeaderboardBtn: document.querySelector('#export-leaderboard-btn'),
  resetProfileBtn: document.querySelector('#reset-profile-btn'),
  tabTriggers: [...document.querySelectorAll('[data-tab-trigger]')],
  tabPanels: [...document.querySelectorAll('[data-tab-panel]')],
};

const initialQuestions = loadQuestions();
const initialUser = loadUser();
const initialHistory = loadHistory();
const initialConfig = loadConfig(initialQuestions, initialUser);

const state = {
  questions: initialQuestions,
  config: initialConfig,
  history: initialHistory,
  user: initialUser,
  session: null,
  lastSessionSummary: null,
  timerId: null,
  answerShuffleId: null,
  runnerLoopId: null,
  runnerKeyHandler: null,
  activeTab: 'overview',
  questionFilter: 'all',
  leaderboardFilter: 'all',
};

const RUNNER_START_DISTANCE = 88;
const RUNNER_FINISH_DISTANCE = 18;

function shuffleList(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalizeConfig(rawConfig) {
  const config = { ...DEFAULT_CONFIG, ...(rawConfig && typeof rawConfig === 'object' ? rawConfig : {}) };
  const mode = GAME_MODES[config.mode] ? config.mode : DEFAULT_CONFIG.mode;
  const modeConfig = getModeConfig(mode);

  return {
    mode,
    category: typeof config.category === 'string' ? config.category : DEFAULT_CONFIG.category,
    limit: clamp(Number(config.limit) || DEFAULT_CONFIG.limit, 1, 50),
    timeLimit: clamp(Number(config.timeLimit) || DEFAULT_CONFIG.timeLimit, 5, 120),
    shuffle: config.shuffle !== false,
    timerEnabled: modeConfig.forceTimer ? true : Boolean(config.timerEnabled ?? modeConfig.defaultTimerEnabled),
    retryIncorrect: modeConfig.allowRetryToggle ? Boolean(config.retryIncorrect) : false,
  };
}

function normalizeUser(rawUser) {
  const user = { ...DEFAULT_USER, ...(rawUser && typeof rawUser === 'object' ? rawUser : {}) };
  return {
    nickname: user.nickname?.toString().trim() || DEFAULT_USER.nickname,
    email: user.email?.toString().trim() || DEFAULT_USER.email,
    weeklyGoal: clamp(Number(user.weeklyGoal) || DEFAULT_USER.weeklyGoal, 1, 500),
    focus: user.focus?.toString().trim() || DEFAULT_USER.focus,
  };
}

function normalizeCategoryKey(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveRecommendedCategory(questions, user, preferredCategory, fallbackCategory = 'all') {
  const categories = getCategories(questions);
  const normalizedFallback = categories.includes(fallbackCategory) ? fallbackCategory : 'all';

  if (preferredCategory === 'focus') {
    const focusCategory = normalizeCategoryKey(user?.focus);
    return categories.includes(focusCategory) ? focusCategory : normalizedFallback;
  }

  const normalizedCategory = normalizeCategoryKey(preferredCategory);
  return categories.includes(normalizedCategory) ? normalizedCategory : normalizedFallback;
}

function buildModePresetConfig(modeKey, { questions, user, currentConfig = DEFAULT_CONFIG, keepCurrentCategory = false } = {}) {
  const mode = getModeConfig(modeKey);
  const preset = mode.preset || {};
  const categories = getCategories(questions);
  const currentCategory = normalizeCategoryKey(currentConfig.category);
  const category = keepCurrentCategory && categories.includes(currentCategory)
    ? currentCategory
    : resolveRecommendedCategory(questions, user, preset.category, 'all');

  return normalizeConfig({
    ...DEFAULT_CONFIG,
    ...currentConfig,
    mode: modeKey,
    category,
    limit: preset.limit ?? currentConfig.limit ?? DEFAULT_CONFIG.limit,
    timeLimit: preset.timeLimit ?? currentConfig.timeLimit ?? DEFAULT_CONFIG.timeLimit,
    shuffle: preset.shuffle ?? currentConfig.shuffle ?? DEFAULT_CONFIG.shuffle,
    timerEnabled: preset.timerEnabled ?? currentConfig.timerEnabled ?? DEFAULT_CONFIG.timerEnabled,
    retryIncorrect: preset.retryIncorrect ?? currentConfig.retryIncorrect ?? DEFAULT_CONFIG.retryIncorrect,
  });
}

function isLegacyGenericConfig(config) {
  return config.mode === 'study'
    && config.category === 'all'
    && config.limit === 5
    && config.timeLimit === 20
    && config.shuffle === true
    && config.timerEnabled === false
    && config.retryIncorrect === true;
}

function loadQuestions() {
  const stored = safeJsonParse(window.localStorage.getItem(STORAGE_KEYS.questions), fallbackQuestions);
  try {
    return validateQuestions(stored);
  } catch {
    return validateQuestions(fallbackQuestions);
  }
}

function loadConfig(questions, user) {
  const stored = safeJsonParse(window.localStorage.getItem(STORAGE_KEYS.config), null);
  if (stored && typeof stored === 'object') {
    const normalized = normalizeConfig(stored);
    if (!stored.__presetMigrated && isLegacyGenericConfig(normalized)) {
      return buildModePresetConfig(DEFAULT_CONFIG.mode, { questions, user, currentConfig: DEFAULT_CONFIG });
    }
    return normalized;
  }
  return buildModePresetConfig(DEFAULT_CONFIG.mode, { questions, user, currentConfig: DEFAULT_CONFIG });
}

function loadHistory() {
  const history = safeJsonParse(window.localStorage.getItem(STORAGE_KEYS.history), []);
  if (!Array.isArray(history)) {
    return [];
  }
  return history.map((entry, index) => normalizeHistoryEntry(entry, index)).filter(Boolean);
}

function loadUser() {
  return normalizeUser(safeJsonParse(window.localStorage.getItem(STORAGE_KEYS.user), DEFAULT_USER));
}

function persist(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function persistAppState() {
  persist(STORAGE_KEYS.questions, state.questions);
  persist(STORAGE_KEYS.config, state.config);
  persist(STORAGE_KEYS.history, state.history);
  persist(STORAGE_KEYS.user, state.user);
}

function createSummaryCard(label, value, tone = 'default', description = '') {
  const article = document.createElement('article');
  article.className = `summary-card${tone !== 'default' ? ` summary-card--${tone}` : ''}`;
  article.innerHTML = `
    <span class="summary-card__label">${escapeHtml(label)}</span>
    <strong class="summary-card__value">${escapeHtml(value)}</strong>
    ${description ? `<p class="summary-card__description">${escapeHtml(description)}</p>` : ''}
  `;
  return article;
}

function renderStatus(message, variant = 'info') {
  if (!elements.statusBox) {
    return;
  }
  elements.statusBox.className = `status status--${variant}`;
  elements.statusBox.textContent = message;
}

function switchTab(tabName) {
  state.activeTab = tabName;
  elements.tabTriggers.forEach((button) => {
    const isActive = button.dataset.tabTrigger === tabName;
    button.classList.toggle('nav-item--active', isActive);
    button.classList.toggle('tab-pill--active', isActive);
  });
  elements.tabPanels.forEach((panel) => {
    panel.classList.toggle('tab-panel--active', panel.dataset.tabPanel === tabName);
  });
}

function populateSelect(select, options, selectedValue) {
  if (!select) {
    return;
  }
  select.innerHTML = '';
  options.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = value === selectedValue;
    select.appendChild(option);
  });
}

function syncQuestionsEditor() {
  if (elements.questionsEditor) {
    elements.questionsEditor.value = JSON.stringify(state.questions, null, 2);
  }
}

function renderConfig() {
  if (!elements.configForm) {
    return;
  }

  const categories = getCategories(state.questions);
  if (!categories.includes(state.config.category)) {
    state.config.category = 'all';
    persist(STORAGE_KEYS.config, state.config);
  }

  populateSelect(elements.configForm.mode, Object.entries(GAME_MODES).map(([value, mode]) => ({ value, label: mode.label })), state.config.mode);
  populateSelect(elements.configForm.category, categories.map((category) => ({ value: category, label: labelForCategory(category) })), state.config.category);

  const mode = getModeConfig(state.config.mode);
  const timerEnabled = mode.forceTimer ? true : state.config.timerEnabled;
  const presetConfig = buildModePresetConfig(state.config.mode, { questions: state.questions, user: state.user, currentConfig: state.config });

  elements.configForm.limit.value = String(state.config.limit);
  elements.configForm.timeLimit.value = String(state.config.timeLimit);
  elements.configForm.shuffle.checked = state.config.shuffle;
  elements.configForm.timerEnabled.checked = timerEnabled;
  elements.configForm.retryIncorrect.checked = state.config.retryIncorrect;
  elements.configForm.timerEnabled.disabled = !mode.allowTimerToggle;
  elements.configForm.retryIncorrect.disabled = !mode.allowRetryToggle;
  elements.configForm.timeLimit.disabled = !mode.forceTimer && !timerEnabled;

  if (elements.configNote) {
    const presetParts = [
      labelForCategory(presetConfig.category),
      `${presetConfig.limit} pytań`,
      presetConfig.timerEnabled ? `${presetConfig.timeLimit}s na pytanie` : 'bez timera',
      presetConfig.shuffle ? 'losowanie włączone' : 'stała kolejność',
    ];
    if (presetConfig.retryIncorrect) {
      presetParts.push('retry błędów');
    }
    const presetHint = `Polecany start: ${presetParts.join(' • ')}.`;

    if (state.config.mode === 'exam') {
      elements.configNote.textContent = `Egzamin zawsze działa z aktywnym timerem, ukrywa wyjaśnienia w trakcie rundy i pokazuje wynik procentowy. ${presetHint}`;
    } else if (state.config.mode === 'runner') {
      elements.configNote.textContent = `Code Runner 2D działa na torach: pytanie jest u góry, odpowiedzi jadą z prawej strony, a Ty sterujesz informatykiem strzałkami. ${presetHint}`;
    } else if (state.config.mode === 'study') {
      elements.configNote.textContent = `W nauce możesz wyłączyć timer i po rundzie uruchomić retry tylko dla błędnych pytań. ${presetHint}`;
    } else if (!timerEnabled) {
      elements.configNote.textContent = `Timer jest wyłączony, więc sesja policzy średni czas odpowiedzi, ale nie wymusi limitu na pytanie. ${presetHint}`;
    } else {
      elements.configNote.textContent = `${mode.label} działa szybciej niż study i zapisze pełne review odpowiedzi po rundzie. ${presetHint}`;
    }
  }
}

function applyModePreset(modeKey, options = {}) {
  const nextConfig = buildModePresetConfig(modeKey, {
    questions: state.questions,
    user: state.user,
    currentConfig: state.config,
    keepCurrentCategory: options.keepCurrentCategory ?? false,
  });
  state.config = nextConfig;
  persist(STORAGE_KEYS.config, state.config);
  renderAll();

  if (options.announce !== false) {
    renderStatus(options.message || `Ustawiono polecane parametry dla trybu ${getModeConfig(modeKey).label}.`, 'info');
  }
}

function getModeMeta(modeKey) {
  const mode = getModeConfig(modeKey);
  const meta = [];
  if (mode.forceTimer) {
    meta.push('timer obowiązkowy');
  } else {
    meta.push(mode.defaultTimerEnabled ? 'timer domyślnie on' : 'timer opcjonalny');
  }
  if (mode.allowRetryToggle) {
    meta.push('retry błędów');
  }
  if (mode.showPercentageScore) {
    meta.push('wynik %');
  }
  if (mode.dynamicAnswers) {
    meta.push('dynamiczne odpowiedzi');
  }
  if (mode.runnerChallenge) {
    meta.push('2D runner');
  }
  return meta;
}

function buildModeCard(modeKey, compact = false) {
  const mode = getModeConfig(modeKey);
  const article = document.createElement('article');
  article.className = `mode-card ${state.config.mode === modeKey ? 'mode-card--active' : ''}`;
  article.innerHTML = `
    <strong>${escapeHtml(mode.label)}</strong>
    <p>${escapeHtml(mode.description)}</p>
    <span>${escapeHtml(mode.accent)}</span>
    <div class="mode-card__meta">${getModeMeta(modeKey).map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join('')}</div>
    ${compact ? '' : '<button type="button" class="button button--ghost button--small">Wybierz</button>'}
  `;
  article.addEventListener('click', () => {
    applyModePreset(modeKey, {
      message: `Wybrano tryb ${mode.label} i ustawiono polecany preset.`,
    });
  });
  return article;
}

function renderModeCards() {
  if (elements.modeCards) {
    elements.modeCards.innerHTML = '';
    Object.keys(GAME_MODES).forEach((modeKey) => {
      elements.modeCards.appendChild(buildModeCard(modeKey));
    });
  }
  if (elements.modeCardsPlay) {
    elements.modeCardsPlay.innerHTML = '';
    Object.keys(GAME_MODES).forEach((modeKey) => {
      elements.modeCardsPlay.appendChild(buildModeCard(modeKey, true));
    });
  }
}

function renderQuestionSummary() {
  if (!elements.questionSummary) {
    return;
  }
  const categories = getCategories(state.questions).filter((category) => category !== 'all');
  elements.questionSummary.innerHTML = '';
  elements.questionSummary.append(
    createSummaryCard('Liczba pytań', String(state.questions.length)),
    createSummaryCard('Kategorie', String(categories.length)),
    createSummaryCard('Walidacja', 'Unikalne ID, bez duplikatów odpowiedzi', 'accent'),
    createSummaryCard('Źródła', 'JSON, szybki formularz, pełny backup'),
  );
}

function renderQuestionFilter() {
  if (!elements.questionFilter) {
    return;
  }
  const categories = getCategories(state.questions);
  if (!categories.includes(state.questionFilter)) {
    state.questionFilter = 'all';
  }
  populateSelect(elements.questionFilter, categories.map((category) => ({ value: category, label: labelForCategory(category) })), state.questionFilter);
}

function renderQuestionLibrary() {
  if (!elements.questionLibrary) {
    return;
  }
  const questions = state.questionFilter === 'all'
    ? state.questions
    : state.questions.filter((question) => question.category === state.questionFilter);

  elements.questionLibrary.innerHTML = '';
  if (questions.length === 0) {
    const item = document.createElement('li');
    item.className = 'question-card empty-state';
    item.textContent = 'Brak pytań dla wybranej kategorii.';
    elements.questionLibrary.appendChild(item);
    return;
  }

  questions.forEach((question) => {
    const item = document.createElement('li');
    item.className = 'question-card';
    item.innerHTML = buildQuestionCardMarkup(question, labelForCategory);
    elements.questionLibrary.appendChild(item);
  });
}

function renderLeaderboard() {
  if (state.leaderboardFilter !== 'all' && !GAME_MODES[state.leaderboardFilter]) {
    state.leaderboardFilter = 'all';
  }

  populateSelect(
    elements.leaderboardFilter,
    [{ value: 'all', label: 'Wszystkie tryby' }, ...Object.entries(GAME_MODES).map(([value, mode]) => ({ value, label: mode.label }))],
    state.leaderboardFilter,
  );

  const filteredHistory = state.leaderboardFilter === 'all'
    ? state.history
    : state.history.filter((entry) => entry.mode === state.leaderboardFilter);
  const sorted = [...filteredHistory].sort((left, right) => right.points - left.points || right.percentage - left.percentage || right.timestamp.localeCompare(left.timestamp));

  [
    { target: elements.leaderboard, limit: 12 },
    { target: elements.leaderboardPreview, limit: 4 },
  ].forEach(({ target, limit }) => {
    if (!target) {
      return;
    }

    target.innerHTML = '';
    const items = sorted.slice(0, limit);
    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard__item leaderboard__item--empty';
      empty.textContent = 'Brak wyników dla wybranego filtra. Rozegraj pierwszą sesję, aby wypełnić tabelę rekordów.';
      target.appendChild(empty);
      return;
    }

    items.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'leaderboard__item';
      item.innerHTML = `
        <div>
          <strong>#${index + 1} ${escapeHtml(entry.nickname)}</strong>
          <p>${escapeHtml(getModeConfig(entry.mode).label)} • ${escapeHtml(labelForCategory(entry.category))} • ${escapeHtml(formatPercentage(entry.percentage))}</p>
        </div>
        <div class="leaderboard__meta">
          <strong>${entry.points} pkt</strong>
          <span>${entry.score}/${entry.total} • śr. ${escapeHtml(formatDuration(entry.averageAnswerTimeMs))}</span>
        </div>
      `;
      target.appendChild(item);
    });
  });
}

function renderOverviewInsights() {
  if (!elements.overviewInsights) {
    return;
  }
  const metrics = getHistoryMetrics(state.history);
  const { hardest, recommendation, readiness, trend, weakSpots } = getAdaptiveSignals();
  const primaryGrid = document.createElement('div');
  const secondaryGrid = document.createElement('div');
  const recommendationCard = createSummaryCard('Rekomendowana sesja', recommendation.title, 'accent', recommendation.description);
  recommendationCard.classList.add('summary-card--feature');

  primaryGrid.className = 'overview-insights-grid overview-insights-grid--primary';
  secondaryGrid.className = 'overview-insights-grid overview-insights-grid--secondary';

  elements.overviewInsights.innerHTML = '';
  primaryGrid.append(
    recommendationCard,
    createSummaryCard(
      'Exam readiness',
      readiness ? `${labelForCategory(readiness.category)} • ${readiness.label}` : 'Brak kategorii',
      readiness?.tone ?? 'default',
      readiness?.description ?? 'Readiness pojawi się po zebraniu historii dla konkretnej kategorii.',
    ),
    createSummaryCard('Trend 5 vs 5', trend.label, trend.tone, trend.description),
  );

  secondaryGrid.append(
    createSummaryCard(
      'Średnia skuteczność',
      metrics.totalQuestions > 0 ? formatPercentage(metrics.averageAccuracy) : 'Brak danych',
      metrics.averageAccuracy >= 80 ? 'accent' : 'default',
    ),
    createSummaryCard(
      'Najtrudniejsza kategoria',
      hardest ? `${labelForCategory(hardest.category)} • ${formatPercentage(hardest.accuracy)}` : 'Brak danych',
      hardest ? 'warning' : 'default',
    ),
    createSummaryCard(
      'Trening słabych miejsc',
      weakSpots.available ? 'Gotowy' : 'Zbieramy dane',
      weakSpots.available ? 'accent' : 'warning',
      weakSpots.available ? 'Sesja bazuje na ostatnich błędach i najtrudniejszej kategorii.' : weakSpots.message,
    ),
    createSummaryCard('Śr. czas odpowiedzi', metrics.totalQuestions > 0 ? formatDuration(metrics.averageAnswerTimeMs) : 'Brak danych'),
    createSummaryCard('Łączne sesje', String(metrics.totalGames)),
  );

  elements.overviewInsights.append(primaryGrid, secondaryGrid);
}

function renderMistakeHotspots() {
  if (!elements.mistakeHotspots) {
    return;
  }
  const mistakes = getMostMistakenQuestions(state.history, state.questions, 5);
  elements.mistakeHotspots.innerHTML = '';
  if (mistakes.length === 0) {
    const item = document.createElement('li');
    item.className = 'insight-item empty-state';
    item.textContent = 'Brak pomyłek do pokazania. Rozegraj kilka sesji albo załaduj demo, żeby zobaczyć hotspoty.';
    elements.mistakeHotspots.appendChild(item);
    return;
  }

  mistakes.forEach((mistake) => {
    const item = document.createElement('li');
    item.className = 'insight-item';
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(mistake.questionContent)}</strong>
        <p>${escapeHtml(labelForCategory(mistake.category))}</p>
      </div>
      <div class="insight-item__meta">
        <strong>${mistake.misses}x</strong>
        <p>nietrafione</p>
      </div>
    `;
    elements.mistakeHotspots.appendChild(item);
  });
}

function renderUserPanel() {
  if (!elements.userForm || !elements.userSummary || !elements.profileCard) {
    return;
  }
  const metrics = getHistoryMetrics(state.history);
  const { hardest, recommendation, readiness, trend } = getAdaptiveSignals();
  const goalProgress = Math.min(100, Math.round((metrics.totalCorrect / Math.max(1, state.user.weeklyGoal)) * 100));

  elements.userForm.nickname.value = state.user.nickname;
  elements.userForm.email.value = state.user.email;
  elements.userForm.weeklyGoal.value = String(state.user.weeklyGoal);
  elements.userForm.focus.value = state.user.focus;

  elements.userSummary.innerHTML = '';
  elements.userSummary.append(
    createSummaryCard('Nick', state.user.nickname),
    createSummaryCard('Cel tygodnia', `${state.user.weeklyGoal} pkt`),
    createSummaryCard('Postęp celu', `${goalProgress}%`, goalProgress >= 100 ? 'accent' : 'default'),
    createSummaryCard('Średnia skuteczność', metrics.totalQuestions > 0 ? formatPercentage(metrics.averageAccuracy) : 'Brak danych'),
    createSummaryCard('Exam readiness', readiness ? readiness.label : 'Brak danych', readiness?.tone ?? 'default'),
    createSummaryCard('Trend', trend.label, trend.tone),
    createSummaryCard('Śr. czas', metrics.totalQuestions > 0 ? formatDuration(metrics.averageAnswerTimeMs) : 'Brak danych'),
    createSummaryCard('Rekomendacja', recommendation.title, 'accent'),
  );

  elements.profileCard.innerHTML = `
    <article class="profile-card__hero">
      <div class="profile-card__avatar">${escapeHtml(getAvatarLabel(state.user.nickname))}</div>
      <div>
        <h4>${escapeHtml(state.user.nickname)}</h4>
        <p>${escapeHtml(state.user.email)}</p>
        <p>Fokus: <strong>${escapeHtml(state.user.focus)}</strong></p>
      </div>
    </article>
    <section class="summary"></section>
  `;
  elements.profileCard.querySelector('.summary').append(
    createSummaryCard('Sesje', String(metrics.totalGames)),
    createSummaryCard('Poprawne odpowiedzi', String(metrics.totalCorrect)),
    createSummaryCard('Punkty', String(metrics.totalPoints)),
    createSummaryCard('Najtrudniejsza kategoria', hardest ? labelForCategory(hardest.category) : 'Brak danych', hardest ? 'warning' : 'default'),
    createSummaryCard('Następny krok', recommendation.title, 'accent'),
    createSummaryCard('Kategorii w bazie', String(getCategories(state.questions).length - 1)),
  );

  elements.sidebarAvatar.textContent = getAvatarLabel(state.user.nickname);
  elements.sidebarNickname.textContent = state.user.nickname;
  elements.sidebarEmail.textContent = state.user.email;
  elements.sidebarGames.textContent = String(metrics.totalGames);
  elements.sidebarPoints.textContent = String(metrics.totalPoints);
  elements.sidebarAccuracy.textContent = metrics.totalQuestions > 0 ? formatPercentage(metrics.averageAccuracy) : '0%';
}

function updateStats() {
  const metrics = getHistoryMetrics(state.history);
  elements.statSource.textContent = 'Local-only + backup JSON';
  elements.statCount.textContent = `${state.questions.length} ${state.questions.length === 1 ? 'pytanie' : 'pytań'}`;
  elements.statMode.textContent = getModeConfig(state.config.mode).label;
  elements.statBest.textContent = metrics.totalQuestions > 0 ? formatPercentage(metrics.averageAccuracy) : 'Brak danych';
}

function getAdaptiveSignals() {
  const hardest = getHardestCategory(state.history);
  const recommendation = getRecommendedSession({ history: state.history, questions: state.questions, focus: state.user.focus });
  const readinessCategory = recommendation.category && recommendation.category !== 'all'
    ? recommendation.category
    : hardest?.category ?? null;
  const readiness = readinessCategory ? getExamReadiness(state.history, readinessCategory) : null;
  const trend = getAccuracyTrend(state.history);
  const weakSpots = buildWeakSpotQuestionSet({
    history: state.history,
    questions: state.questions,
    limit: state.config.limit,
  });

  return {
    hardest,
    recommendation,
    readiness,
    trend,
    weakSpots,
  };
}

function renderWeakSpotCallToAction() {
  if (!elements.weakSpotsBtn || !elements.weakSpotsStatus) {
    return;
  }

  const { weakSpots } = getAdaptiveSignals();
  elements.weakSpotsBtn.disabled = !weakSpots.available;
  elements.weakSpotsBtn.title = weakSpots.message;
  elements.weakSpotsStatus.textContent = weakSpots.message;
}

function readQuickQuestionDraft() {
  const category = elements.quickQuestionForm.category.value.trim().toLowerCase();
  return {
    id: elements.quickQuestionForm.id.value.trim() || suggestQuestionId(state.questions, category || 'custom'),
    category,
    content: elements.quickQuestionForm.content.value.trim(),
    answers: elements.quickQuestionForm.answers.value.split(/\r?\n/).map((answer) => answer.trim()).filter(Boolean),
    correctAnswer: elements.quickQuestionForm.correctAnswer.value.trim(),
    explanation: elements.quickQuestionForm.explanation.value.trim(),
  };
}

function renderQuickQuestionPreview() {
  if (!elements.quickQuestionPreview || !elements.quickQuestionForm) {
    return;
  }
  const draft = readQuickQuestionDraft();
  const hasAnyValue = draft.content || draft.category || draft.answers.length > 0 || draft.correctAnswer;
  if (!hasAnyValue) {
    elements.quickQuestionPreview.innerHTML = '<p class="empty-state">Wypełnij formularz po prawej, a tu pojawi się podgląd pytania przed zapisem.</p>';
    return;
  }
  try {
    const nextQuestions = validateQuestions([...state.questions, draft]);
    elements.quickQuestionPreview.innerHTML = buildQuestionCardMarkup(nextQuestions.at(-1), labelForCategory);
  } catch (error) {
    elements.quickQuestionPreview.innerHTML = `<p class="status status--warning">${escapeHtml(error instanceof Error ? error.message : 'Nie udało się zbudować podglądu pytania.')}</p>`;
  }
}

function renderAll({ syncEditor = false } = {}) {
  renderConfig();
  renderModeCards();
  renderQuestionFilter();
  renderQuestionSummary();
  renderQuestionLibrary();
  renderLeaderboard();
  renderOverviewInsights();
  renderMistakeHotspots();
  renderUserPanel();
  renderWeakSpotCallToAction();
  renderQuickQuestionPreview();
  updateStats();
  if (syncEditor) {
    syncQuestionsEditor();
  }
}

function applyWeakSpotDefaults() {
  state.config = normalizeConfig({
    ...state.config,
    mode: 'study',
    category: 'all',
    timerEnabled: false,
    retryIncorrect: true,
    shuffle: false,
  });
  persist(STORAGE_KEYS.config, state.config);
}

function startWeakSpotTraining() {
  const { weakSpots } = getAdaptiveSignals();
  if (!weakSpots.available) {
    renderStatus(weakSpots.message, 'warning');
    return;
  }

  applyWeakSpotDefaults();
  renderAll();
  startQuiz({ questions: weakSpots.questions, source: 'weak-spots' });
}

function clearTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function clearAnswerShuffle() {
  if (state.answerShuffleId) {
    window.clearInterval(state.answerShuffleId);
    state.answerShuffleId = null;
  }
}

function clearRunnerLoop() {
  if (state.runnerLoopId) {
    window.clearInterval(state.runnerLoopId);
    state.runnerLoopId = null;
  }
}

function detachRunnerControls() {
  if (state.runnerKeyHandler) {
    window.removeEventListener('keydown', state.runnerKeyHandler);
    state.runnerKeyHandler = null;
  }
}

function getRunnerLaneTopPercent(laneIndex, laneCount) {
  if (laneCount <= 1) {
    return 50;
  }
  return 16 + ((68 / (laneCount - 1)) * laneIndex);
}

function buildRunnerQuestionState(question) {
  const answers = shuffleList(question.answers);
  return {
    answers,
    playerLane: clamp(Math.round((answers.length - 1) / 2), 0, answers.length - 1),
    distancePercent: RUNNER_START_DISTANCE,
    resolved: false,
  };
}

function syncRunnerPresentation() {
  if (!state.session?.runner || !elements.quizPanel) {
    return;
  }

  const laneCount = state.session.runner.answers.length;
  const playerNode = elements.quizPanel.querySelector('[data-runner-player]');
  const laneLabel = elements.quizPanel.querySelector('[data-runner-lane-label]');
  const distanceLabel = elements.quizPanel.querySelector('[data-runner-distance-label]');
  const answerNodes = [...elements.quizPanel.querySelectorAll('[data-runner-answer-lane]')];

  if (playerNode) {
    playerNode.style.top = `${getRunnerLaneTopPercent(state.session.runner.playerLane, laneCount)}%`;
  }

  if (laneLabel) {
    laneLabel.textContent = `Tor ${state.session.runner.playerLane + 1}/${laneCount}`;
  }

  if (distanceLabel) {
    distanceLabel.textContent = `${Math.max(0, Math.round(((state.session.runner.distancePercent - RUNNER_FINISH_DISTANCE) / (RUNNER_START_DISTANCE - RUNNER_FINISH_DISTANCE)) * 100))}% dystansu`;
  }

  answerNodes.forEach((node) => {
    const laneIndex = Number(node.dataset.runnerAnswerLane);
    node.style.top = `${getRunnerLaneTopPercent(laneIndex, laneCount)}%`;
    node.style.left = `${state.session.runner.distancePercent}%`;
    node.classList.toggle('runner-answer--targeted', laneIndex === state.session.runner.playerLane);
  });
}

function moveRunnerLane(direction) {
  if (!state.session?.runner || state.session.answerLocked) {
    return;
  }

  const nextLane = clamp(state.session.runner.playerLane + direction, 0, state.session.runner.answers.length - 1);
  if (nextLane === state.session.runner.playerLane) {
    return;
  }

  state.session.runner.playerLane = nextLane;
  syncRunnerPresentation();
}

function attachRunnerControls() {
  detachRunnerControls();
  if (!state.session?.runner) {
    return;
  }

  state.runnerKeyHandler = (event) => {
    if (!state.session?.runner || state.session.answerLocked) {
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      moveRunnerLane(-1);
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveRunnerLane(1);
    }
  };

  window.addEventListener('keydown', state.runnerKeyHandler);
}

function startRunnerLoop() {
  clearRunnerLoop();
  if (!state.session?.runner) {
    return;
  }

  state.runnerLoopId = window.setInterval(() => {
    if (!state.session?.runner || state.session.answerLocked) {
      clearRunnerLoop();
      return;
    }

    const elapsed = Math.max(0, Date.now() - state.session.questionStartedAt);
    const progress = Math.min(1, elapsed / Math.max(1, state.session.timePerQuestionMs));
    state.session.runner.distancePercent = RUNNER_START_DISTANCE - ((RUNNER_START_DISTANCE - RUNNER_FINISH_DISTANCE) * progress);
    syncRunnerPresentation();

    if (progress >= 1 && !state.session.runner.resolved) {
      state.session.runner.resolved = true;
      const selectedAnswer = state.session.runner.answers[state.session.runner.playerLane] ?? null;
      submitAnswer(selectedAnswer, selectedAnswer == null);
    }
  }, 40);
}

function shuffleAnswerButtons() {
  const answerList = elements.quizPanel?.querySelector('.answer-option-list');
  if (!answerList) {
    return;
  }
  const buttons = [...answerList.querySelectorAll('[data-answer-index]')];
  if (buttons.length < 2) {
    return;
  }
  for (let index = buttons.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [buttons[index], buttons[swapIndex]] = [buttons[swapIndex], buttons[index]];
  }
  buttons.forEach((button, index) => {
    button.style.setProperty('--arcade-rotate', `${Math.round(Math.random() * 10 - 5)}deg`);
    button.style.setProperty('--arcade-delay', `${(index * 70) + Math.round(Math.random() * 120)}ms`);
    answerList.appendChild(button);
  });
}

function startAnswerShuffle() {
  clearAnswerShuffle();
  if (!getModeConfig(state.config.mode).dynamicAnswers) {
    return;
  }
  shuffleAnswerButtons();
  state.answerShuffleId = window.setInterval(shuffleAnswerButtons, 900);
}

function resetQuizPanel() {
  clearTimer();
  clearAnswerShuffle();
  clearRunnerLoop();
  detachRunnerControls();
  state.session = null;
  if (elements.quizPanel) {
    elements.quizPanel.classList.add('hidden');
    elements.quizPanel.innerHTML = '';
  }
}

function startTimer() {
  clearTimer();
  if (!state.session?.timerEnabled) {
    return;
  }
  state.timerId = window.setInterval(() => {
    if (!state.session) {
      return;
    }
    const remainingMs = Math.max(0, state.session.deadline - Date.now());
    const timerNode = elements.quizPanel?.querySelector('[data-role="timer"]');
    if (timerNode) {
      timerNode.textContent = `${(remainingMs / 1000).toFixed(1)} s`;
    }
    if (remainingMs <= 0) {
      if (state.session?.runner) {
        return;
      }
      submitAnswer(null, true);
    }
  }, 100);
}

function getFeedbackMessage(question, { isCorrect, timedOut }) {
  const mode = getModeConfig(state.config.mode);
  if (!mode.showAnswerDetails) {
    return timedOut ? 'Czas minął. Odpowiedź została zapisana jako brak.' : 'Odpowiedź zapisana. Następne pytanie.';
  }
  if (isCorrect) {
    return `Dobrze! ${question.explanation || 'Lecimy dalej.'}`;
  }
  if (timedOut) {
    return `Czas minął. Poprawna odpowiedź: ${question.correctAnswer}. ${question.explanation || ''}`.trim();
  }
  return `Nie tym razem. Poprawna odpowiedź: ${question.correctAnswer}. ${question.explanation || ''}`.trim();
}

function beginCurrentQuestion(feedback = '') {
  clearRunnerLoop();
  detachRunnerControls();
  state.session.answerLocked = false;
  state.session.questionStartedAt = Date.now();
  state.session.deadline = state.session.timerEnabled ? Date.now() + state.session.timePerQuestionMs : null;
  state.session.runner = getModeConfig(state.config.mode).runnerChallenge
    ? buildRunnerQuestionState(state.session.questions[state.session.index])
    : null;
  renderCurrentQuestion(feedback);
  startTimer();
  if (state.session.runner) {
    attachRunnerControls();
    startRunnerLoop();
  }
}

function renderCurrentQuestion(feedback = '') {
  clearAnswerShuffle();
  if (!state.session || !elements.quizPanel) {
    return;
  }
  const question = state.session.questions[state.session.index];
  if (!question) {
    finishQuiz();
    return;
  }

  const mode = getModeConfig(state.config.mode);
  const progress = `${state.session.index + 1}/${state.session.questions.length}`;
  const timerMarkup = state.session.timerEnabled
    ? `<div class="quiz-timer"><span>Pozostały czas</span><strong data-role="timer">${(state.session.timePerQuestionMs / 1000).toFixed(1)} s</strong></div>`
    : '<div class="quiz-timer quiz-timer--muted"><span>Timer</span><strong>Wyłączony</strong></div>';
  const sourceBadge = state.session.source === 'retry'
    ? '<span class="badge badge--warning">Powtórka błędów</span>'
    : state.session.source === 'weak-spots'
      ? '<span class="badge badge--warning">Słabe miejsca</span>'
      : '';
  const percentageBadge = mode.showPercentageScore ? '<span class="badge">Wynik %</span>' : '';
  const arcadeHint = mode.dynamicAnswers
    ? '<p class="arcade-hint">Arcade Sprint: odpowiedzi przetasowują się co chwilę. Złap poprawną, zanim zmieni miejsce.</p>'
    : '';
  const runnerHint = mode.runnerChallenge
    ? '<p class="arcade-hint arcade-hint--runner">Code Runner 2D: strzałki góra/dół albo lewo/prawo zmieniają tor. Ustaw informatyka na dobrej odpowiedzi, zanim do Ciebie dojedzie.</p>'
    : '';
  const shellClass = mode.dynamicAnswers ? 'quiz-shell--arcade' : mode.runnerChallenge ? 'quiz-shell--runner' : '';
  const contentMarkup = mode.runnerChallenge && state.session.runner
    ? `
      ${runnerHint}
      <section class="runner-scene">
        <div class="runner-legend">
          <span class="badge badge--warning">Sterowanie: strzałki</span>
          <span class="badge" data-runner-lane-label>Tor 1/${state.session.runner.answers.length}</span>
          <span class="badge" data-runner-distance-label>100% dystansu</span>
        </div>
        <div class="runner-arena">
          <div class="runner-hit-zone"></div>
          <div class="runner-player" data-runner-player>
            <span class="runner-player__tag">IT</span>
            <div class="runner-player__body"></div>
          </div>
          ${state.session.runner.answers.map((answer, index) => `
            <article class="runner-answer" data-runner-answer-lane="${index}">
              <span class="runner-answer__lane">Tor ${index + 1}</span>
              <strong>${escapeHtml(answer)}</strong>
            </article>
          `).join('')}
        </div>
        <div class="inline-actions runner-controls">
          <button type="button" class="button button--ghost button--small" data-runner-move="-1">Wyżej</button>
          <button type="button" class="button button--ghost button--small" data-runner-move="1">Niżej</button>
        </div>
      </section>
    `
    : `
      ${arcadeHint}
      <div class="answer-option-list ${mode.dynamicAnswers ? 'answer-option-list--arcade' : ''}">
        ${question.answers.map((answer, index) => `<button type="button" class="answer-option" data-answer-index="${index}">${escapeHtml(answer)}</button>`).join('')}
      </div>
    `;

  elements.quizPanel.innerHTML = `
    <div class="quiz-shell ${shellClass}">
      <div class="quiz-shell__header">
        <div>
          <p class="section-kicker">${escapeHtml(mode.label)}</p>
          <h3>${escapeHtml(question.content)}</h3>
          <p class="intro">Pytanie ${progress} • Kategoria: ${escapeHtml(labelForCategory(question.category))}</p>
          <div class="mode-card__meta">${sourceBadge}${percentageBadge}</div>
        </div>
        ${timerMarkup}
      </div>
      ${contentMarkup}
      ${feedback ? `<p class="status status--info">${escapeHtml(feedback)}</p>` : ''}
    </div>
  `;
  elements.quizPanel.classList.remove('hidden');
  switchTab('play');

  if (mode.runnerChallenge) {
    elements.quizPanel.querySelectorAll('[data-runner-move]').forEach((button) => {
      button.addEventListener('click', () => {
        moveRunnerLane(Number(button.dataset.runnerMove));
      });
    });
    syncRunnerPresentation();
    return;
  }

  elements.quizPanel.querySelectorAll('[data-answer-index]').forEach((button) => {
    button.addEventListener('click', () => {
      submitAnswer(question.answers[Number(button.dataset.answerIndex)], false);
    });
  });
  startAnswerShuffle();
}

function buildReviewItemsMarkup(summary, filter) {
  const mode = getModeConfig(summary.mode);
  const items = filterSessionReview(summary.review, filter);

  if (items.length === 0) {
    return '<li class="review-card empty-state">Brak odpowiedzi dla wybranego filtra.</li>';
  }

  return items.map((item) => `
    <li class="review-card review-card--${item.isCorrect ? 'correct' : item.timedOut ? 'timedout' : 'incorrect'}">
      <div class="review-card__header">
        <div>
          <strong>${item.index}. ${escapeHtml(item.questionContent)}</strong>
          <p>${escapeHtml(labelForCategory(item.category))}</p>
        </div>
        <span class="badge ${item.isCorrect ? 'badge--success' : item.timedOut ? 'badge--warning' : 'badge--danger'}">${item.isCorrect ? 'Poprawne' : item.timedOut ? 'Timeout' : 'Błędne'}</span>
      </div>
      <div class="review-card__stats">
        <span class="badge">Czas: ${escapeHtml(formatDuration(item.elapsedMs))}</span>
        <span class="badge">Punkty: ${item.points}</span>
      </div>
      <p><strong>Twoja odpowiedź:</strong> ${escapeHtml(formatAnswer(item.selectedAnswer, item.timedOut))}</p>
      <p><strong>Poprawna odpowiedź:</strong> ${escapeHtml(item.correctAnswer)}</p>
      ${mode.showExplanationInReview && item.explanation ? `<p class="explanation">${escapeHtml(item.explanation)}</p>` : ''}
    </li>
  `).join('');
}

function mountReviewFilters(summary) {
  const filterBar = elements.quizPanel?.querySelector('#review-filter-bar');
  const reviewList = elements.quizPanel?.querySelector('#session-review-list');
  if (!filterBar || !reviewList) {
    return;
  }

  const counts = getSessionReviewCounts(summary.review);
  const filters = [
    { id: 'all', label: 'Wszystkie' },
    { id: 'incorrect', label: 'Błędne' },
    { id: 'timedout', label: 'Timeout' },
    { id: 'correct', label: 'Poprawne' },
  ];
  let activeFilter = 'all';

  const renderFilterState = () => {
    filterBar.innerHTML = filters.map((filter) => `
      <button type="button" class="review-filter ${activeFilter === filter.id ? 'review-filter--active' : ''}" data-review-filter="${filter.id}">
        ${escapeHtml(filter.label)} (${counts[filter.id]})
      </button>
    `).join('');
    reviewList.innerHTML = buildReviewItemsMarkup(summary, activeFilter);

    filterBar.querySelectorAll('[data-review-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.reviewFilter;
        renderFilterState();
      });
    });
  };

  renderFilterState();
}

function renderFinishedSession(summary) {
  const mode = getModeConfig(summary.mode);
  const readiness = summary.category !== 'all' ? getExamReadiness(state.history, summary.category) : null;
  const achievements = getSessionAchievements(summary, { readiness });
  const { weakSpots } = getAdaptiveSignals();
  const canRetryIncorrect = summary.incorrectQuestions.length > 0 && summary.mode === 'study' && state.config.retryIncorrect;
  const canStartWeakSpots = summary.sessionKind !== 'weak-spots' && weakSpots.available;
  const followUpLabel = summary.sessionKind === 'weak-spots' ? 'Jeszcze jedna poprawka' : 'Powtórz błędne';
  elements.quizPanel.innerHTML = `
    <div class="quiz-shell">
      <div class="quiz-shell__header">
        <div>
          <p class="section-kicker">Podsumowanie sesji</p>
          <h3>${summary.score}/${summary.total} poprawnych${mode.showPercentageScore ? ` • ${escapeHtml(formatPercentage(summary.percentage))}` : ''}</h3>
          <p class="intro">Zdobyte punkty: ${summary.points}. Śr. czas odpowiedzi: ${escapeHtml(formatDuration(summary.averageAnswerTimeMs))}. ${summary.incorrectCount > 0 ? `Do poprawy: ${summary.incorrectCount}.` : 'Bez pomyłek w tej rundzie.'}</p>
        </div>
        <div class="inline-actions">
          <button type="button" class="button" id="play-again-btn">Zagraj jeszcze raz</button>
          ${canRetryIncorrect ? `<button type="button" class="button button--ghost" id="retry-incorrect-btn">${followUpLabel}</button>` : ''}
          ${canStartWeakSpots ? '<button type="button" class="button button--ghost" id="start-weak-spots-summary-btn">Trenuj słabe miejsca</button>' : ''}
        </div>
      </div>
      <section class="summary quiz-shell__stats"></section>
      <div class="achievement-strip" id="session-achievements"></div>
      ${canRetryIncorrect ? `<p class="status status--warning">${summary.sessionKind === 'weak-spots' ? 'To nadal trening słabych miejsc. Jednym kliknięciem uruchomisz jeszcze jedną krótką poprawkę tylko dla nietrafionych pytań.' : 'Masz aktywne retry błędnych pytań w study. Jednym kliknięciem uruchomisz poprawkę tylko dla nietrafionych pytań.'}</p>` : ''}
      ${canStartWeakSpots ? `<p class="status status--info">${escapeHtml(weakSpots.message)}</p>` : ''}
      <div class="quiz-shell__review-header">
        <p class="section-kicker">Przegląd odpowiedzi</p>
        <h4>Co dokładnie wydarzyło się w rundzie</h4>
        <p>${escapeHtml(getFinishReasonLabel(summary.reason))}</p>
      </div>
      <div id="review-filter-bar" class="review-filter-bar"></div>
      <ul id="session-review-list" class="session-review"></ul>
    </div>
  `;

  elements.quizPanel.classList.remove('hidden');
  elements.quizPanel.querySelector('.summary').append(
    createSummaryCard('Tryb', mode.label, 'accent'),
    createSummaryCard('Kategoria', labelForCategory(summary.category)),
    createSummaryCard('Powód zakończenia', getFinishReasonLabel(summary.reason)),
    createSummaryCard('Błędne pytania', String(summary.incorrectCount), summary.incorrectCount > 0 ? 'warning' : 'default'),
    createSummaryCard('Timer', summary.timerEnabled ? 'Aktywny' : 'Wyłączony'),
    createSummaryCard('Wynik procentowy', mode.showPercentageScore ? formatPercentage(summary.percentage) : 'Tryb bez %'),
    createSummaryCard('Exam readiness', readiness ? readiness.label : 'Brak kategorii', readiness?.tone ?? 'default'),
  );

  const achievementsTarget = elements.quizPanel.querySelector('#session-achievements');
  if (achievementsTarget) {
    achievementsTarget.innerHTML = achievements.length > 0
      ? achievements.map((achievement) => `<span class="badge ${achievement.tone === 'accent' ? 'badge--success' : ''}">${escapeHtml(achievement.label)}</span>`).join('')
      : '<span class="badge">Bez nowych badge w tej rundzie</span>';
  }

  mountReviewFilters(summary);

  elements.quizPanel.querySelector('#play-again-btn')?.addEventListener('click', () => startQuiz());
  elements.quizPanel.querySelector('#retry-incorrect-btn')?.addEventListener('click', startFollowUpCorrection);
  elements.quizPanel.querySelector('#start-weak-spots-summary-btn')?.addEventListener('click', startWeakSpotTraining);
}

function finishQuiz(reason = 'completed') {
  if (!state.session) {
    return;
  }
  clearTimer();
  clearAnswerShuffle();
  const summary = createSessionSummary({ session: state.session, config: state.config, nickname: state.user.nickname, reason });
  state.lastSessionSummary = summary;
  state.history = [summary.historyEntry, ...state.history].slice(0, HISTORY_LIMIT);
  persist(STORAGE_KEYS.history, state.history);
  renderFinishedSession(summary);
  state.session = null;
  renderAll();
  renderStatus(summary.incorrectCount > 0 && state.config.mode === 'study' && state.config.retryIncorrect
    ? `Wynik zapisano lokalnie. Możesz teraz powtórzyć ${summary.incorrectCount} błędnych pytań.`
    : 'Wynik zapisano lokalnie w tabeli rekordów.', 'info');
}

function submitAnswer(answer, timedOut = false) {
  if (!state.session || state.session.answerLocked) {
    return;
  }
  state.session.answerLocked = true;
  clearTimer();
  clearAnswerShuffle();
  clearRunnerLoop();
  detachRunnerControls();

  const question = state.session.questions[state.session.index];
  const rawElapsedMs = Math.max(0, Date.now() - state.session.questionStartedAt);
  const elapsedMs = state.session.timerEnabled
    ? Math.min(rawElapsedMs, state.session.timePerQuestionMs)
    : rawElapsedMs;
  const isCorrect = !timedOut && answer === question.correctAnswer;
  const nextStreak = isCorrect ? state.session.streak + 1 : 0;
  const points = computePoints({ session: state.session, config: state.config, isCorrect, elapsedMs, streak: nextStreak });

  state.session.answers.push({
    questionId: question.id,
    questionContent: question.content,
    category: question.category,
    selectedAnswer: answer,
    correctAnswer: question.correctAnswer,
    isCorrect,
    timedOut,
    points,
    elapsedMs,
    explanation: question.explanation || '',
  });
  state.session.streak = nextStreak;
  state.session.index += 1;

  if (state.config.mode === 'survival' && !isCorrect) {
    finishQuiz('survival-hit');
    return;
  }
  if (state.session.index >= state.session.questions.length) {
    finishQuiz(
      state.session.source === 'retry'
        ? 'retry-completed'
        : state.session.source === 'weak-spots'
          ? 'weak-spots-completed'
          : 'completed',
    );
    return;
  }
  beginCurrentQuestion(getFeedbackMessage(question, { isCorrect, timedOut }));
}

function startQuiz(options = {}) {
  clearTimer();
  clearAnswerShuffle();
  clearRunnerLoop();
  detachRunnerControls();
  const questions = Array.isArray(options.questions) ? [...options.questions] : buildQuizSet(state.questions, state.config);
  if (questions.length === 0) {
    renderStatus('Brak pytań dla aktualnego filtra. Dodaj pytania albo zmień kategorię.', 'warning');
    return;
  }
  const mode = getModeConfig(state.config.mode);
  state.session = {
    questions,
    source: options.source || 'full',
    index: 0,
    answers: [],
    streak: 0,
    answerLocked: false,
    timerEnabled: mode.forceTimer ? true : state.config.timerEnabled,
    timePerQuestionMs: getTimePerQuestionMs(state.config),
    questionStartedAt: Date.now(),
    deadline: null,
    runner: null,
  };
  beginCurrentQuestion();
  renderStatus(
    state.session.source === 'retry'
      ? `Uruchomiono retry ${questions.length} błędnych pytań.`
      : state.session.source === 'weak-spots'
        ? `Uruchomiono trening słabych miejsc z ${questions.length} pytaniami.`
        : state.config.mode === 'runner'
          ? `Uruchomiono Code Runner 2D z ${questions.length} pytaniami. Steruj strzałkami.`
        : `Uruchomiono tryb ${mode.label} z ${questions.length} pytaniami.`,
    'info',
  );
}

function startRetryIncorrectQuiz() {
  const retryQuestions = state.lastSessionSummary?.incorrectQuestions || [];
  if (retryQuestions.length === 0) {
    renderStatus('Brak błędnych pytań do powtórki.', 'warning');
    return;
  }
  state.config = normalizeConfig({
    ...state.config,
    mode: 'study',
  });
  persist(STORAGE_KEYS.config, state.config);
  renderAll();
  startQuiz({ questions: retryQuestions, source: 'retry' });
}

function startFollowUpCorrection() {
  const retryQuestions = state.lastSessionSummary?.incorrectQuestions || [];
  if (retryQuestions.length === 0) {
    renderStatus('Brak błędnych pytań do poprawki.', 'warning');
    return;
  }

  if (state.lastSessionSummary?.sessionKind === 'weak-spots') {
    applyWeakSpotDefaults();
    renderAll();
    startQuiz({ questions: retryQuestions, source: 'weak-spots' });
    return;
  }

  startRetryIncorrectQuiz();
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function saveQuestionsFromEditor(rawValue) {
  state.questions = validateQuestions(JSON.parse(rawValue));
  state.questionFilter = getCategories(state.questions).includes(state.questionFilter) ? state.questionFilter : 'all';
  persist(STORAGE_KEYS.questions, state.questions);
  renderAll({ syncEditor: true });
  renderStatus(`Zapisano ${state.questions.length} pytań do lokalnej bazy.`, 'info');
}

function addQuickQuestion(event) {
  event.preventDefault();
  state.questions = validateQuestions([...state.questions, readQuickQuestionDraft()]);
  persist(STORAGE_KEYS.questions, state.questions);
  elements.quickQuestionForm.reset();
  renderAll({ syncEditor: true });
  renderStatus('Dodano nowe pytanie do lokalnej bazy.', 'info');
}

function restoreDefaults() {
  state.questions = validateQuestions(fallbackQuestions);
  state.questionFilter = 'all';
  persist(STORAGE_KEYS.questions, state.questions);
  renderAll({ syncEditor: true });
  renderStatus('Przywrócono domyślną bazę pytań.', 'info');
}

function exportQuestions() {
  downloadJson('quiz-questions.json', state.questions);
  renderStatus('Wyeksportowano aktualną bazę pytań do pliku JSON.', 'info');
}

function exportLeaderboard() {
  const filteredHistory = state.leaderboardFilter === 'all' ? state.history : state.history.filter((entry) => entry.mode === state.leaderboardFilter);
  downloadJson('quiz-leaderboard.json', filteredHistory);
  renderStatus('Wyeksportowano tabelę rekordów do pliku JSON.', 'info');
}

function exportBackup() {
  downloadJson('quiz-workspace-backup.json', {
    version: 2,
    exportedAt: new Date().toISOString(),
    app: { questions: state.questions, config: state.config, history: state.history, user: state.user },
  });
  renderStatus('Wyeksportowano pełny backup aplikacji.', 'info');
}

function importBackupFromText(rawValue) {
  const parsed = JSON.parse(rawValue);
  const payload = parsed?.app && typeof parsed.app === 'object' ? parsed.app : parsed;
  state.questions = validateQuestions(payload.questions ?? fallbackQuestions);
  state.config = normalizeConfig(payload.config ?? DEFAULT_CONFIG);
  state.history = Array.isArray(payload.history) ? payload.history.map((entry, index) => normalizeHistoryEntry(entry, index)).filter(Boolean) : [];
  state.user = normalizeUser(payload.user ?? DEFAULT_USER);
  state.questionFilter = getCategories(state.questions).includes(state.questionFilter) ? state.questionFilter : 'all';
  resetQuizPanel();
  persistAppState();
  renderAll({ syncEditor: true });
  renderStatus('Zaimportowano pełny backup aplikacji.', 'info');
}

function clearLeaderboard() {
  state.history = [];
  persist(STORAGE_KEYS.history, state.history);
  renderAll();
  renderStatus('Wyczyszczono lokalną tabelę rekordów.', 'info');
}

function resetProfile() {
  const previousFocus = normalizeCategoryKey(state.user.focus);
  state.user = { ...DEFAULT_USER };
  persist(STORAGE_KEYS.user, state.user);
  if (state.config.category === 'all' || normalizeCategoryKey(state.config.category) === previousFocus) {
    state.config = buildModePresetConfig(state.config.mode, { questions: state.questions, user: state.user, currentConfig: state.config });
    persist(STORAGE_KEYS.config, state.config);
  }
  renderAll();
  renderStatus('Przywrócono domyślny profil użytkownika.', 'info');
}

function seedDemoData() {
  const demoQuestions = validateQuestions(fallbackQuestions);
  const [frontendOne, frontendTwo, backendOne, backendTwo, webOne, webTwo, devopsOne, securityOne] = demoQuestions;
  state.user = { nickname: 'Łukasz Demo', email: 'lukasz@quiz.app', weeklyGoal: 40, focus: 'backend' };
  const sessions = [
    {
      nickname: 'Łukasz Demo',
      mode: 'study',
      requestedCategory: 'backend',
      resolvedCategory: 'backend',
      points: 36,
      timestamp: '2026-03-21T10:00:00.000Z',
      review: [
        createReviewItem(backendOne, { elapsedMs: 7_200, points: 18 }),
        createReviewItem(backendTwo, { elapsedMs: 8_100, points: 18 }),
      ],
    },
    {
      nickname: 'Łukasz Demo',
      mode: 'study',
      requestedCategory: 'backend',
      resolvedCategory: 'backend',
      points: 18,
      timestamp: '2026-03-20T10:00:00.000Z',
      review: [
        createReviewItem(backendOne, { elapsedMs: 7_800, points: 18 }),
        createReviewItem(backendTwo, { selectedAnswer: 'Do logowania błędów', isCorrect: false, elapsedMs: 10_600, points: 0 }),
      ],
    },
    {
      nickname: 'Ada',
      mode: 'exam',
      requestedCategory: 'backend',
      resolvedCategory: 'backend',
      points: 18,
      timestamp: '2026-03-19T10:00:00.000Z',
      review: [
        createReviewItem(backendOne, { elapsedMs: 8_500, points: 18 }),
        createReviewItem(backendTwo, { selectedAnswer: 'Do szyfrowania', isCorrect: false, elapsedMs: 11_100, points: 0 }),
      ],
    },
    {
      nickname: 'Maja',
      mode: 'mentor',
      requestedCategory: 'web',
      resolvedCategory: 'web',
      points: 44,
      timestamp: '2026-03-18T10:00:00.000Z',
      review: [
        createReviewItem(webOne, { elapsedMs: 6_100, points: 20 }),
        createReviewItem(webTwo, { elapsedMs: 7_800, points: 24 }),
      ],
    },
    {
      nickname: 'Jan',
      mode: 'study',
      requestedCategory: 'frontend',
      resolvedCategory: 'frontend',
      points: 16,
      timestamp: '2026-03-17T10:00:00.000Z',
      review: [
        createReviewItem(frontendOne, { selectedAnswer: 'useEffect', isCorrect: false, elapsedMs: 9_000, points: 0 }),
        createReviewItem(frontendTwo, { elapsedMs: 7_400, points: 16 }),
      ],
    },
    {
      nickname: 'Łukasz Demo',
      mode: 'study',
      requestedCategory: 'backend',
      resolvedCategory: 'backend',
      points: 18,
      timestamp: '2026-03-16T10:00:00.000Z',
      review: [
        createReviewItem(backendOne, { elapsedMs: 8_300, points: 18 }),
        createReviewItem(backendTwo, { selectedAnswer: 'Do logowania błędów', isCorrect: false, elapsedMs: 12_200, points: 0 }),
      ],
    },
    {
      nickname: 'Maja',
      mode: 'study',
      requestedCategory: 'backend',
      resolvedCategory: 'backend',
      points: 18,
      timestamp: '2026-03-15T10:00:00.000Z',
      review: [
        createReviewItem(backendOne, { elapsedMs: 9_000, points: 18 }),
        createReviewItem(backendTwo, { selectedAnswer: 'Do logowania błędów', isCorrect: false, elapsedMs: 11_800, points: 0 }),
      ],
    },
    {
      nickname: 'Łukasz Demo',
      mode: 'study',
      requestedCategory: 'all',
      resolvedCategory: 'all',
      points: 22,
      timestamp: '2026-03-14T10:00:00.000Z',
      review: [
        createReviewItem(devopsOne, { selectedAnswer: 'Figma', isCorrect: false, elapsedMs: 11_600, points: 0 }),
        createReviewItem(securityOne, { selectedAnswer: null, timedOut: true, isCorrect: false, elapsedMs: 16_000, points: 0 }),
        createReviewItem(frontendOne, { elapsedMs: 7_300, points: 22 }),
      ],
    },
    {
      nickname: 'Ada',
      mode: 'study',
      requestedCategory: 'backend',
      resolvedCategory: 'backend',
      points: 36,
      timestamp: '2026-03-13T10:00:00.000Z',
      review: [
        createReviewItem(backendOne, { elapsedMs: 7_600, points: 18 }),
        createReviewItem(backendTwo, { elapsedMs: 8_100, points: 18 }),
      ],
    },
    {
      nickname: 'Łukasz Demo',
      mode: 'study',
      requestedCategory: 'backend',
      resolvedCategory: 'backend',
      points: 36,
      timestamp: '2026-03-12T10:00:00.000Z',
      review: [
        createReviewItem(backendOne, { elapsedMs: 7_100, points: 18 }),
        createReviewItem(backendTwo, { elapsedMs: 7_900, points: 18 }),
      ],
    },
  ];
  state.history = sessions.map((session) => createHistoryEntry({
    nickname: session.nickname,
    mode: session.mode,
    requestedCategory: session.requestedCategory,
    resolvedCategory: session.resolvedCategory,
    reason: 'completed',
    sessionKind: 'full',
    points: session.points,
    timestamp: session.timestamp,
    review: session.review,
  }));
  persist(STORAGE_KEYS.user, state.user);
  persist(STORAGE_KEYS.history, state.history);
  renderAll();
  renderStatus('Załadowano demo z trendem, readiness do exam i hotspotami błędnych pytań.', 'info');
}

function bootstrap() {
  persist(STORAGE_KEYS.config, state.config);
  renderAll({ syncEditor: true });
  switchTab('overview');
  renderStatus('Aplikacja działa local-only. Startuje teraz z polecanymi presetami dla trybów, review odpowiedzi i pełnym backupem JSON.', 'info');
}

function goToTab(tabName, message) {
  switchTab(tabName);
  renderStatus(message, 'info');
}

elements.tabTriggers.forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tabTrigger)));
elements.loginShortcutBtn?.addEventListener('click', () => goToTab('profile', 'Przeniesiono do zakładki profilu.'));
elements.configForm?.mode?.addEventListener('change', () => {
  applyModePreset(elements.configForm.mode.value, {
    message: `Przełączono na ${getModeConfig(elements.configForm.mode.value).label} i ustawiono polecane wartości.`,
  });
});
elements.configForm?.addEventListener('input', (event) => {
  if (event.target?.name === 'mode') {
    return;
  }
  state.config = normalizeConfig({ mode: elements.configForm.mode.value, category: elements.configForm.category.value, limit: elements.configForm.limit.value, timeLimit: elements.configForm.timeLimit.value, shuffle: elements.configForm.shuffle.checked, timerEnabled: elements.configForm.timerEnabled.checked, retryIncorrect: elements.configForm.retryIncorrect.checked });
  persist(STORAGE_KEYS.config, state.config);
  renderAll();
});
elements.questionFilter?.addEventListener('change', () => {
  state.questionFilter = elements.questionFilter.value;
  renderQuestionLibrary();
  renderStatus(`Pokazano pytania dla kategorii: ${labelForCategory(state.questionFilter)}.`, 'info');
});
elements.leaderboardFilter?.addEventListener('change', () => {
  state.leaderboardFilter = elements.leaderboardFilter.value;
  renderLeaderboard();
  renderStatus(`Ustawiono filtr wyników: ${state.leaderboardFilter === 'all' ? 'wszystkie tryby' : getModeConfig(state.leaderboardFilter).label}.`, 'info');
});
elements.userForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const previousFocus = normalizeCategoryKey(state.user.focus);
  state.user = normalizeUser({ nickname: elements.userForm.nickname.value, email: elements.userForm.email.value, weeklyGoal: elements.userForm.weeklyGoal.value, focus: elements.userForm.focus.value });
  persist(STORAGE_KEYS.user, state.user);
  if (state.config.category === 'all' || normalizeCategoryKey(state.config.category) === previousFocus) {
    state.config = buildModePresetConfig(state.config.mode, { questions: state.questions, user: state.user, currentConfig: state.config });
    persist(STORAGE_KEYS.config, state.config);
  }
  renderAll();
  renderStatus('Zapisano profil użytkownika lokalnie.', 'info');
});
elements.quickQuestionForm?.addEventListener('input', renderQuickQuestionPreview);
elements.quickQuestionForm?.addEventListener('submit', addQuickQuestion);
elements.startQuizBtn?.addEventListener('click', () => startQuiz());
elements.weakSpotsBtn?.addEventListener('click', startWeakSpotTraining);
elements.recommendedConfigBtn?.addEventListener('click', () => {
  applyModePreset(state.config.mode, {
    message: `Przywrócono polecane ustawienia dla trybu ${getModeConfig(state.config.mode).label}.`,
  });
});
elements.saveQuestionsBtn?.addEventListener('click', () => {
  try {
    saveQuestionsFromEditor(elements.questionsEditor.value);
  } catch (error) {
    renderStatus(error instanceof Error ? error.message : 'Nie udało się zapisać pytań.', 'warning');
  }
});
elements.restoreDefaultsBtn?.addEventListener('click', restoreDefaults);
elements.exportBtn?.addEventListener('click', exportQuestions);
elements.exportBackupBtn?.addEventListener('click', exportBackup);
elements.exportLeaderboardBtn?.addEventListener('click', exportLeaderboard);
elements.clearLeaderboardBtn?.addEventListener('click', clearLeaderboard);
elements.resetProfileBtn?.addEventListener('click', resetProfile);
elements.seedDemoBtn?.addEventListener('click', seedDemoData);
elements.importFileInput?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    elements.questionsEditor.value = text;
    saveQuestionsFromEditor(text);
  } catch (error) {
    renderStatus(error instanceof Error ? error.message : 'Nie udało się zaimportować pytań.', 'warning');
  }
  event.target.value = '';
});
elements.backupFileInput?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    importBackupFromText(await file.text());
  } catch (error) {
    renderStatus(error instanceof Error ? error.message : 'Nie udało się zaimportować backupu.', 'warning');
  }
  event.target.value = '';
});
elements.quizActions?.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-quiz-action]');
  if (!actionButton) return;
  if (actionButton.dataset.quizAction === 'start' || actionButton.dataset.quizAction === 'restart') {
    startQuiz();
  }
  if (actionButton.dataset.quizAction === 'stop') {
    resetQuizPanel();
    renderStatus('Zakończono aktywną sesję bez zapisu wyniku.', 'warning');
  }
});

bootstrap();
