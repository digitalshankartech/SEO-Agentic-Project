const CONTEXT_KEY = 'marketing-suite:product-context';
const MODEL_KEY   = 'marketing-suite:selected-model';
const ANALYSIS_PREFIX = 'marketing-suite:analysis:';

export function saveSelectedModel(model) { localStorage.setItem(MODEL_KEY, model); }
export function loadSelectedModel() { return localStorage.getItem(MODEL_KEY) || 'gemini'; }

export function saveProductContext(ctx) {
  localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
}

export function loadProductContext() {
  try {
    return JSON.parse(localStorage.getItem(CONTEXT_KEY)) || null;
  } catch {
    return null;
  }
}

export function clearProductContext() {
  localStorage.removeItem(CONTEXT_KEY);
}

export function formatContextForPrompt(ctx) {
  if (!ctx) return '';
  const lines = [
    ctx.productName && `**Product:** ${ctx.productName}`,
    ctx.description && `**Description:** ${ctx.description}`,
    ctx.targetAudience && `**Target Audience:** ${ctx.targetAudience}`,
    ctx.personas && `**Key Personas:** ${ctx.personas}`,
    ctx.painPoints && `**Pain Points Solved:** ${ctx.painPoints}`,
    ctx.differentiation && `**Key Differentiators:** ${ctx.differentiation}`,
    ctx.customerLanguage && `**Customer Language (verbatim):** ${ctx.customerLanguage}`,
    ctx.brandVoice && `**Brand Voice:** ${ctx.brandVoice}`,
    ctx.proofPoints && `**Proof Points:** ${ctx.proofPoints}`,
    ctx.goals && `**Current Marketing Goals:** ${ctx.goals}`,
  ].filter(Boolean);
  return lines.join('\n');
}

export function saveAnalysisState(key, state) {
  try {
    sessionStorage.setItem(`${ANALYSIS_PREFIX}${key}`, JSON.stringify(state));
  } catch {
    // Session persistence is best-effort only.
  }
}

export function loadAnalysisState(key) {
  try {
    return JSON.parse(sessionStorage.getItem(`${ANALYSIS_PREFIX}${key}`)) || null;
  } catch {
    return null;
  }
}

export function clearAnalysisState(key) {
  try {
    sessionStorage.removeItem(`${ANALYSIS_PREFIX}${key}`);
  } catch {
    // Session persistence is best-effort only.
  }
}
