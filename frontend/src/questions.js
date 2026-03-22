import { escapeHtml, slugify } from './utils.js';

export function getCategories(questions) {
  return ['all', ...new Set(questions.map((question) => question.category))];
}

export function validateQuestions(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('Lista pytań musi być niepusta.');
  }

  const normalized = input.map((question, index) => {
    const content = question.content?.toString().trim();
    const answers = Array.isArray(question.answers)
      ? question.answers.map((answer) => answer?.toString().trim()).filter(Boolean)
      : [];
    const correctAnswer = question.correctAnswer?.toString().trim();
    const category = question.category?.toString().trim().toLowerCase();
    const id = question.id?.toString().trim() || `custom-${index + 1}`;
    const uniqueAnswers = new Set(answers.map((answer) => answer.toLowerCase()));

    if (!content) {
      throw new Error(`Pytanie #${index + 1} nie ma treści.`);
    }

    if (!category) {
      throw new Error(`Pytanie "${content}" musi mieć kategorię.`);
    }

    if (answers.length < 2) {
      throw new Error(`Pytanie "${content}" musi mieć co najmniej 2 odpowiedzi.`);
    }

    if (uniqueAnswers.size !== answers.length) {
      throw new Error(`Pytanie "${content}" zawiera zduplikowane odpowiedzi.`);
    }

    if (!correctAnswer || !answers.includes(correctAnswer)) {
      throw new Error(`Pytanie "${content}" ma niepoprawnie ustawioną poprawną odpowiedź.`);
    }

    return {
      id,
      content,
      answers,
      correctAnswer,
      category,
      explanation: question.explanation?.toString().trim() || '',
    };
  });

  const seenIds = new Set();
  normalized.forEach((question) => {
    const normalizedId = question.id.toLowerCase();
    if (seenIds.has(normalizedId)) {
      throw new Error(`ID pytania "${question.id}" musi być unikalne.`);
    }
    seenIds.add(normalizedId);
  });

  return normalized;
}

export function suggestQuestionId(questions, category) {
  const prefix = slugify(category || 'custom') || 'custom';
  const existingIds = new Set(questions.map((question) => question.id.toLowerCase()));
  let counter = 1;
  let candidate = `${prefix}-${counter}`;

  while (existingIds.has(candidate)) {
    counter += 1;
    candidate = `${prefix}-${counter}`;
  }

  return candidate;
}

export function buildQuestionCardMarkup(question, labelForCategory) {
  const answers = question.answers.map((answer) => `<li class="answer-pill">${escapeHtml(answer)}</li>`).join('');

  return `
    <div class="question-card__header">
      <h3 class="question-card__title">${escapeHtml(question.content)}</h3>
      <span class="badge">${escapeHtml(labelForCategory(question.category))}</span>
    </div>
    <ol class="answers">${answers}</ol>
    <div class="question-card__footer">
      <p class="correct-answer"><strong>Poprawna odpowiedź:</strong> ${escapeHtml(question.correctAnswer)}</p>
      ${question.explanation ? `<p class="explanation">${escapeHtml(question.explanation)}</p>` : ''}
    </div>
  `;
}
