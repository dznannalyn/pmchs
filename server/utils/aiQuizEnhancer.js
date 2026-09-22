const SUPPORTED_TYPES = new Set([
  'multiple_choice', 'multiple_select', 'true_false', 'fill_blank',
  'short_answer', 'essay', 'matching', 'sub_statements'
]);

function parseModelJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned);
}

export function hasRomanNumeralQuestionPrefix(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;

  const match = trimmed.match(/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI|XXII|XXIII|XXIV|XXV|XXVI|XXVII|XXVIII|XXIX|XXX|XXXI|XXXII|XXXIII|XXXIV|XXXV)[.)]\s+(.+)$/i);
  if (!match) return false;

  const remainder = match[2].trim();
  return /^(which|what|where|when|why|how|define|list|is|are|can|does|do|should|would|ano|sino|alin|bakit|paano|kung|sinuri|isipin)\b/i.test(remainder) || /[?]$/.test(remainder);
}

export function normalizeAiQuestions(items = []) {
  const seenText = new Set();
  const seenSourceNumber = new Set();
  const normalized = [];

  // Sort by sourceNumber ascending so lower-numbered wins on collision
  const sorted = [...items].sort((a, b) => {
    const na = parseFloat(a.sourceNumber) || 0;
    const nb = parseFloat(b.sourceNumber) || 0;
    return na - nb;
  });

  // Find max integer source number to use as hard cap
  const maxSource = sorted.reduce((max, item) => {
    const n = parseInt(item.sourceNumber, 10);
    return !isNaN(n) && n > max ? n : max;
  }, 0);

  for (const item of sorted) {
    if (!item || typeof item !== 'object') continue;

    const rawQuestion = String(item.question || '').replace(/\s+/g, ' ').trim();
    if (!rawQuestion) continue;
    if (/^(?:[A-D]|\d+)[.)]\s+.+$/i.test(rawQuestion)) continue;
    if (/^(?:[IVXLCDM]+)[.)]\s+.+$/i.test(rawQuestion) && !hasRomanNumeralQuestionPrefix(rawQuestion)) continue;
    if (/^(?:Q|Question)\s*\d+\b/i.test(rawQuestion) && rawQuestion.length < 30) continue;

    // Deduplicate by text fingerprint
    const textFingerprint = rawQuestion.toLowerCase().slice(0, 80).replace(/\s+/g, ' ');
    if (seenText.has(textFingerprint)) continue;
    seenText.add(textFingerprint);

    // Deduplicate by integer source number
    const intSource = parseInt(item.sourceNumber, 10);
    if (!isNaN(intSource)) {
      if (seenSourceNumber.has(intSource)) continue;
      seenSourceNumber.add(intSource);
    }

    const nextOptions = Array.isArray(item.options)
      ? item.options
          .filter(option => option && option.text)
          .map(option => ({
            id: String(option.id || '').trim() || 'N/A',
            text: String(option.text).replace(/\s+/g, ' ').trim()
          }))
          .filter(option => option.text && !/^(?:[A-D]|[IVXLCDM]+|\d+)[.)]\s*$/i.test(option.text))
      : [];

    const nextSubStatements = Array.isArray(item.subStatements)
      ? item.subStatements
          .filter(stmt => stmt && stmt.text)
          .map((stmt, index) => ({
            index: Number(stmt.index ?? index + 1),
            text: String(stmt.text).replace(/\s+/g, ' ').trim()
          }))
      : [];

    normalized.push({
      ...item,
      sourceNumber: item.sourceNumber,
      question: rawQuestion,
      options: nextOptions,
      subStatements: nextSubStatements,
      correctAnswers: Array.isArray(item.correctAnswers) ? item.correctAnswers : []
    });

    // Hard cap: stop once we've collected up to the max source number
    if (maxSource > 0 && normalized.length >= maxSource) break;
  }

  return normalized;
}


function documentPrompt(content, filename) {
  return [
    'Extract every quiz question from this document and return JSON only.',
    'CRITICAL: Count the numbered questions in the document first. Your output must contain EXACTLY that many questions — no more, no less. Never invent extra questions.',
    'One numbered item = one question. Do NOT split one question into multiple entries. Do NOT create separate questions for Roman numerals (I, II, III), sub-statements, or sentences within a single numbered item.',
    'Do not omit questions because numbering, punctuation, line breaks, or option labels are malformed.',
    'Preserve the original wording. Combine wrapped lines into one question or option.',
    'Recognize A., A), (A), a., a), 1., and 1) choices.',
    'For Roman numeral sub-statements, keep them inside the same question text as a single string, for example: "Which statement is true?\\nI. ...\\nII. ...\\nIII. ...". Never create a separate question for I., II., or III.',
    'If a question has no answer choices, leave options as an empty array and needsReview true. Do not invent answer choices.',
    'Do not create entries for standalone sentences, headings, or answer-choice fragments. Only return actual quiz questions.',
    'Clean option text so option text does not repeat the choice letter prefix (e.g. if option is "A. I at III", option text should be "I at III").',
    'Infer the correct answer only when the content supports it; otherwise use an empty correctAnswers array and needsReview true.',
    'Return {"questions":[{"sourceNumber":string,"type":string,"question":string,"options":[{"id":string,"text":string}],"subStatements":[{"index":number,"text":string}],"correctAnswers":string[],"needsReview":boolean,"confidence":number}]}.',
    `Filename: ${filename}`,
    'Document content:',
    content
  ].join('\n');
}

export async function extractQuizWithGemini(document, filename = 'document.docx') {
  if (!process.env.GEMINI_API_KEY) {
    return { attempted: false, reason: 'GEMINI_API_KEY is not configured' };
  }

  const content = document.slice(0, 200000);
  const modelsToTry = [
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ]
    .filter(Boolean)
    .filter((model, index, arr) => arr.indexOf(model) === index);

  // Remove duplicates while keeping order
  const uniqueModels = [...new Set(modelsToTry)];
  let lastError = null;

  for (const model of uniqueModels) {
    // Retry up to 2 times for each model if 503 or 429 occurs
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: documentPrompt(content, filename) }] }],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json',
              maxOutputTokens: 32768
            }
          })
        });

        if (response.status === 503 || response.status === 429) {
          const errText = await response.text();
          lastError = new Error(`Gemini status ${response.status}: ${errText.slice(0, 200)}`);
          // Wait 1.5s before retrying or switching models
          await new Promise(res => setTimeout(res, 1500));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Gemini status ${response.status}: ${errorBody.slice(0, 300)}`);
        }

        const payload = await response.json();
        const modelText = payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '{}';
        const result = parseModelJson(modelText);
        const rawQuestions = Array.isArray(result) ? result : result.questions;
        const questions = normalizeAiQuestions(rawQuestions || []);

        return {
          attempted: true,
          questions,
          modelUsed: model
        };
      } catch (err) {
        lastError = err;
        // If it's not a fetch or response error, break attempt loop to try next model
        if (!err.message.includes('503') && !err.message.includes('429')) {
          break;
        }
      }
    }
  }

  throw lastError || new Error('All Gemini models failed due to high demand.');
}
