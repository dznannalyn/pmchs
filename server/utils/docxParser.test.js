import test from 'node:test';
import assert from 'node:assert/strict';

import DocxParser from './docxParser.js';

test('keeps a Roman-numeral question stem as one question when it is actually the question', () => {
  const parser = new DocxParser();

  const result = parser.parseQuestions([
    'I. Which statement is true?',
    'A. The first sentence is correct.',
    'B. The second sentence is correct.',
    'C. The third sentence is correct.',
    'D. The fourth sentence is correct.'
  ].join('\n'));

  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].sourceNumber, 1);
  assert.match(result.questions[0].question, /Which statement is true\?/i);
  assert.equal(result.questions[0].options.length, 4);
});

