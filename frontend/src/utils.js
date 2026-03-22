export function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

export function slugify(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function shuffleList(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function formatPercentage(value) {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0 s';
  }
  if (ms < 1_000) {
    return `${Math.round(ms)} ms`;
  }
  const seconds = ms / 1_000;
  return `${seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1)} s`;
}

export function formatAnswer(answer, timedOut = false) {
  if (timedOut || answer == null || answer === '') {
    return 'Brak odpowiedzi';
  }
  return answer;
}

export function getAvatarLabel(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'GL';
}

export function labelForCategory(category) {
  if (category === 'all') {
    return 'Wszystkie';
  }
  return category.charAt(0).toUpperCase() + category.slice(1);
}
