export function filterQuestionsByCategory(questions, category) {
  if (!category || category === 'all') return [...questions];
  return questions.filter((question) => question.category === category);
}

export function createDeterministicRng(sequence = []) {
  let index = 0;
  return () => {
    if (index >= sequence.length) return 0;
    return sequence[index++];
  };
}

export function selectRandomQuestions(questions, limit, random = Math.random) {
  const pool = [...questions];
  const picked = [];

  while (pool.length > 0 && picked.length < limit) {
    const position = Math.floor(random() * pool.length);
    picked.push(pool.splice(position, 1)[0]);
  }

  return picked;
}

export function isAnswerCorrect(question, answer) {
  return question.correctAnswer === answer;
}

export function calculateScore(results) {
  return results.reduce((total, result) => total + (result.correct ? 1 : 0), 0);
}

export function isTimedOut(startTime, currentTime, timeLimitMs) {
  return currentTime - startTime >= timeLimitMs;
}

export function createQuizSession({ questions, category, limit = 3, random = Math.random, timeLimitMs = 30_000 }) {
  const filtered = filterQuestionsByCategory(questions, category);
  const selected = selectRandomQuestions(filtered, limit, random);

  return {
    category,
    questions: selected,
    currentIndex: 0,
    answersLocked: false,
    startedAt: 0,
    timeLimitMs,
    results: [],
  };
}

export function submitAnswer(session, answer, now) {
  const question = session.questions[session.currentIndex];
  const timedOut = isTimedOut(session.startedAt, now, session.timeLimitMs);

  if (!question || session.answersLocked) {
    return { ...session, lastSubmission: 'ignored' };
  }

  const correct = !timedOut && isAnswerCorrect(question, answer);
  const nextResults = [...session.results, { questionId: question.id, answer, correct, timedOut }];

  const finished = session.currentIndex + 1 >= session.questions.length;

  return {
    ...session,
    answersLocked: !finished ? false : true,
    currentIndex: session.currentIndex + 1,
    results: nextResults,
    score: calculateScore(nextResults),
    finished,
  };
}
