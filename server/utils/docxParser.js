import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

/**
 * DOCX to Quiz Parser
 * Extracts and structures quiz questions from Word documents
 */

class DocxParser {
  constructor() {
    this.questionPatterns = {
      numbered: /^[\s]*(\d+)[\.\)]\s*(.*)$/,
      qFormat: /^[\s]*Q(\d+)[\.\)]\s*(.*)$/,
      questionLabel: /^[\s]*[Qq]uestion\s+(\d+)[\:\.]?\s*(.*)$/
    };

    this.optionPatterns = {
      letterParenthesis: /^[\s]*([A-Da-d])\)+\s+(.+)$/,
      letterDot: /^[\s]*([A-Da-d])\.+\s+(.+)$/,
      letterSpaced: /^[\s]*([A-Da-d])\s{2,}(.+)$/,
      numberParenthesis: /^[\s]*(\d+)\)\s+(.+)$/,
      numberDot: /^[\s]*(\d+)\.\s+(.+)$/
    };

    this.answerPatterns = [
      /^[\s]*(?:Answer|Ans|Correct\s*Answer|Key|Correct)[\:\s]+([A-Da-d\d]+)$/i
    ];

    this.questionTypeIndicators = {
      true_false: ['True or False', 'True/False', 'T/F', 'T or F'],
      multiple_select: ['Select all', 'All of the above', 'Multiple answers'],
      matching: ['Match', 'Match the following']
    };
  }

  /**
   * Parse DOCX file buffer
   */
  async parseDocxBuffer(buffer) {
    try {
      const result = await mammoth.convertToHtml({
        buffer,
        convertImage: mammoth.images.imgElement(async image => ({
          src: `data:${image.contentType};base64,${await image.read('base64')}`
        }))
      });
      const rawText = await mammoth.extractRawText({ buffer });
      const documentText = rawText.value;

      return {
        success: true,
        text: documentText,
        html: result.value,
        structure: this.extractStructuredDocument(result.value),
        messages: result.messages
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse DOCX file from path
   */
  async parseDocxFile(filePath) {
    try {
      const result = await mammoth.convertToHtml({
        path: filePath,
        convertImage: mammoth.images.imgElement(async image => ({
          src: `data:${image.contentType};base64,${await image.read('base64')}`
        }))
      });
      const rawText = await mammoth.extractRawText({ path: filePath });
      const documentText = rawText.value;

      return {
        success: true,
        text: documentText,
        html: result.value,
        structure: this.extractStructuredDocument(result.value),
        messages: result.messages
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  extractStructuredDocument(html) {
    const $ = cheerio.load(html, { decodeEntities: false });
    const elements = [];

    $('body').children().each((index, element) => {
      const node = $(element);
      const tag = element.tagName?.toLowerCase();

      if (/^h[1-6]$/.test(tag)) {
        elements.push({
          type: 'heading',
          order: index,
          level: Number(tag.substring(1)),
          html: node.toString(),
          text: node.text().trim()
        });
        return;
      }

      if (tag === 'table') {
        const rows = [];
        node.find('tr').each((rowIndex, row) => {
          const cells = [];
          $(row).find('th, td').each((cellIndex, cell) => {
            cells.push({
              html: $(cell).html() || '',
              text: $(cell).text().replace(/\s+/g, ' ').trim()
            });
          });
          rows.push({ index: rowIndex, cells });
        });
        elements.push({ type: 'table', order: index, html: node.toString(), rows });
        return;
      }

      const images = node.find('img').map((imageIndex, image) => ({
        src: $(image).attr('src'),
        alt: $(image).attr('alt') || ''
      })).get();

      elements.push({
        type: 'paragraph',
        order: index,
        html: node.toString(),
        text: node.text().replace(/\s+/g, ' ').trim(),
        runs: node.find('strong, b, em, i, u, mark, sup, sub').map((runIndex, run) => ({
          type: run.tagName.toLowerCase(),
          text: $(run).text()
        })).get(),
        images
      });
    });

    return elements;
  }

  structuredLines(structure = []) {
    return structure.flatMap(element => {
      if (element.type === 'table') {
        return element.rows.flatMap(row => row.cells.map(cell => cell.text).filter(Boolean));
      }
      return element.text ? [element.text] : [];
    });
  }

  /**
   * Split document into paragraphs while preserving structure
   */
  splitIntoParagraphs(text) {
    return text.split(/\n+/).filter(line => line.trim().length > 0);
  }

  isRomanNumeralLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;

    const romanPattern = /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI|XXII|XXIII|XXIV|XXV|XXVI|XXVII|XXVIII|XXIX|XXX|XXXI|XXXII|XXXIII|XXXIV|XXXV)[.)]\s+.+$/i;
    return romanPattern.test(trimmed);
  }

  isRomanNumeralQuestionLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;

    const match = trimmed.match(/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI|XXII|XXIII|XXIV|XXV|XXVI|XXVII|XXVIII|XXIX|XXX|XXXI|XXXII|XXXIII|XXXIV|XXXV)[.)]\s*(.+)$/i);
    if (!match) return false;

    const remainder = match[1].trim();
    return /^(which|what|where|when|why|how|define|list|is|are|can|does|do|should|would|ano|sino|alin|bakit|paano|kung|sinuri|isipin)\b/i.test(remainder) || /[?]$/.test(remainder);
  }

  looksLikeNewQuestion(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;

    if (/^[\s]*(?:Q(?:uestion)?\s*\d+|\d+)[\.:\)]\s*/i.test(trimmed)) return true;
    if (/^[\s]*Q\d+[\.:\)]\s*/i.test(trimmed)) return true;
    if (/^[\s]*[Qq]uestion\s+\d+[\.:\)]?\s*/.test(trimmed)) return true;
    if (/^(which|what|where|when|why|how|define|list|is|are|can|does|do|should|would|ano|sino|alin|bakit|paano|kung|sinuri|isipin)\b/i.test(trimmed)) return true;
    if (/[?]$/.test(trimmed) && !/^(?:[A-Da-d][.)]|\d+[.)])\s+/.test(trimmed)) return true;

    return false;
  }

  /**
   * Detect if a line is a question
   */
  detectQuestion(line, context = {}) {
    const trimmed = line.trim();

    if (this.isRomanNumeralQuestionLine(trimmed)) {
      const match = trimmed.match(/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI|XXII|XXIII|XXIV|XXV|XXVI|XXVII|XXVIII|XXIX|XXX|XXXI|XXXII|XXXIII|XXXIV|XXXV)[.)]\s*(.+)$/i);
      const questionText = match ? match[1].trim() : trimmed;
      return {
        isQuestion: true,
        pattern: 'roman_question',
        number: null,
        text: questionText,
        confidence: 0.92
      };
    }

    if (this.isRomanNumeralLine(trimmed)) {
      return { isQuestion: false, confidence: 0 };
    }
    
    // Try each pattern
    for (const [pattern, regex] of Object.entries(this.questionPatterns)) {
      const match = trimmed.match(regex);
      if (match) {
        const questionText = match[2] || '';
        const looksQuestionLike = /[?:]$/.test(questionText) ||
          /^(which|what|where|when|why|how|define|list|is|are|can|does|do|should|would|ano|sino|alin|bakit|paano|kung|sinuri|isipin)\b/i.test(questionText);

        if (pattern === 'numbered' && questionText && !looksQuestionLike && !context.followsOptions) {
          return { isQuestion: false, confidence: 0 };
        }

        return {
          isQuestion: true,
          pattern,
          number: match[1],
          text: questionText,
          confidence: pattern === 'numbered' ? 0.95 : 0.90
        };
      }
    }

    // Check for question keywords
    if ((/[?]$/.test(trimmed) && !/^(?:[A-Da-d][.)]|\d+[.)])\s+/.test(trimmed)) ||
      /^(which|what|where|when|why|how|define|list|is|are|can|does|do|should|would|ano|sino|alin|bakit|paano|kung|sinuri|isipin)\b/i.test(trimmed)) {
      
      // Higher confidence if it's not a short line
      const confidence = trimmed.length > 30 ? 0.70 : 0.50;
      return {
        isQuestion: true,
        pattern: 'keyword',
        text: trimmed,
        confidence
      };
    }

    return { isQuestion: false, confidence: 0 };
  }

  /**
   * Detect if a line is an answer option
   */
  detectOption(line) {
    const trimmed = line.trim();

    if (this.isRomanNumeralLine(trimmed)) {
      return { isOption: false, confidence: 0 };
    }
    
    // Check against all option patterns
    for (const [pattern, regex] of Object.entries(this.optionPatterns)) {
      const match = trimmed.match(regex);
      if (match) {
        return {
          isOption: true,
          pattern,
          optionId: match[1].toUpperCase(),
          text: match[2],
          confidence: pattern.includes('Letter') ? 0.98 : 0.85
        };
      }
    }

    return { isOption: false, confidence: 0 };
  }

  /**
   * Detect correct answer from line
   */
  detectCorrectAnswer(line) {
    const trimmed = line.trim();
    
    for (const pattern of this.answerPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return {
          found: true,
        answer: match[1].toUpperCase(),
        confidence: 0.95
      };
      }
    }

    return { found: false };
  }

  /**
   * Detect question type
   */
  detectQuestionType(questionText, options) {
    const text = questionText.toLowerCase();
    
    // True/False
    if (text.includes('true or false') || text.includes('true/false')) {
      return 'true_false';
    }
    
    // Multiple Select
    if (text.includes('all of the following') ||
        text.includes('select all') ||
        options?.length > 2 && questionText.includes('which')) {
      return 'multiple_select';
    }

    // Matching
    if (text.includes('match')) {
      return 'matching';
    }

    // Fill in the Blank
    if (text.includes('blank') || text.includes('_____')) {
      return 'fill_blank';
    }

    // Short Answer / Essay
    if (text.includes('explain') || text.includes('describe')) {
      return 'short_answer';
    }

    // Default
    return 'multiple_choice';
  }

  /**
   * Main parsing logic - comprehensive document analysis
   */
  parseQuestions(documentText) {
    const paragraphs = this.splitIntoParagraphs(documentText);
    const questions = [];
    const issues = [];
    let currentQuestion = null;
    let questionsLookingForAnswers = [];
    let pendingStemLines = [];

    const saveCurrentQuestion = () => {
      if (currentQuestion) {
        questions.push(currentQuestion);
        questionsLookingForAnswers.push(currentQuestion);
        currentQuestion = null;
      }
    };

    for (let i = 0; i < paragraphs.length; i++) {
      const line = paragraphs[i].trim();

      if (!line) continue;

      // Check if this is a question
      const questionDetection = this.detectQuestion(line, {
        followsOptions: Boolean(currentQuestion && currentQuestion.options.length >= 2)
      });

      const optionDetection = this.detectOption(line);
      const romanStatement = this.isRomanNumeralLine(line);

      if (questionDetection.isQuestion && questionDetection.confidence > 0.60) {
        if (currentQuestion) {
          questions.push(currentQuestion);
          questionsLookingForAnswers.push(currentQuestion);
        }

        currentQuestion = {
          id: `q${questions.length + 1}`,
          sourceNumber: questionDetection.number || questions.length + 1,
          question: questionDetection.text,
          options: [],
          subStatements: [],
          correctAnswer: null,
          confidence: questionDetection.confidence,
          parsingPattern: questionDetection.pattern
        };
        continue;
      }

      if (romanStatement && currentQuestion) {
        currentQuestion.subStatements.push({
          index: currentQuestion.subStatements.length + 1,
          text: line
        });
        currentQuestion.question = currentQuestion.question
          ? `${currentQuestion.question}\n${line}`.trim()
          : line;
        continue;
      }

      if (romanStatement && !currentQuestion) {
        // Roman numeral statements are sub-items of a question, not standalone questions.
        if (pendingStemLines.length > 0) {
          pendingStemLines.push(line);
        }
        continue;
      }

      // Some documents omit question numbers. Buffer their text and promote
      // it only when a genuine answer-choice marker follows.
      if (!currentQuestion && pendingStemLines.length > 0 && optionDetection.isOption) {
        currentQuestion = {
          id: `q${questions.length + 1}`,
          sourceNumber: questions.length + 1,
          question: pendingStemLines.join(' '),
          options: [],
          subStatements: [],
          correctAnswer: null,
          confidence: 0.72,
          parsingPattern: 'inferred_from_options'
        };
        pendingStemLines = [];
      }

      // Numeric answer choices are only considered when the current stem has
      // no options yet and the line is not actually a new numbered question.
      const numericOption = currentQuestion && currentQuestion.options.length === 0 && currentQuestion.question
        ? line.match(/^[\s]*(\d+)[.)]\s+(.+)$/)
        : null;
      if (numericOption && !this.looksLikeNewQuestion(numericOption[2])) {
        currentQuestion.options.push({
          id: numericOption[1],
          text: numericOption[2],
          confidence: 0.85
        });
        continue;
      }
      if (numericOption && this.looksLikeNewQuestion(numericOption[2])) {
        saveCurrentQuestion();
        currentQuestion = {
          id: `q${questions.length + 1}`,
          sourceNumber: numericOption[1],
          question: numericOption[2],
          options: [],
          subStatements: [],
          correctAnswer: null,
          confidence: 0.95,
          parsingPattern: 'numbered_question'
        };
        continue;
      }

      if (currentQuestion && !currentQuestion.question && currentQuestion.options.length === 0) {
        currentQuestion.question = line;
        continue;
      }

      // Check if this is an option
      if (optionDetection.isOption && optionDetection.confidence > 0.70 && currentQuestion) {
        currentQuestion.options.push({
          id: optionDetection.optionId,
          text: line,
          confidence: optionDetection.confidence
        });
        continue;
      }

      const unlabeledOption = currentQuestion && currentQuestion.options.length === 3
        ? line.match(/^\.\s+(.+)$/)
        : null;
      if (unlabeledOption) {
        currentQuestion.options.push({
          id: 'D',
          text: unlabeledOption[1],
          confidence: 0.65
        });
        continue;
      }

      // Check if this is an answer key line
      const answerDetection = this.detectCorrectAnswer(line);
      if (answerDetection.found) {
        if (currentQuestion) {
          currentQuestion.correctAnswer = answerDetection.answer;
          currentQuestion.answerConfidence = answerDetection.confidence;
        }
        // Also try to match with previous questions
        if (questionsLookingForAnswers.length > 0) {
          const lastQuestion = questionsLookingForAnswers[questionsLookingForAnswers.length - 1];
          if (!lastQuestion.correctAnswer) {
            lastQuestion.correctAnswer = answerDetection.answer;
          }
        }
        continue;
      }

      // Roman numerals are statements, never answer choices. Letter options
      // are intentionally limited to A-D above.
      const romanMatch = line.match(/^[\s]*([ivxlcdm]+)[.)]\s+(.+)$/i);
      if (romanMatch && currentQuestion) {
        // This is a sub-statement; add to subStatements and append to question stem
        currentQuestion.subStatements.push({
          index: currentQuestion.subStatements.length + 1,
          text: line
        });
        currentQuestion.question = currentQuestion.question 
          ? `${currentQuestion.question}\n${line}`.trim()
          : line;
        continue;
      }

      // Word often wraps a question stem across multiple paragraphs. Keep
      // those lines attached until answer choices begin.
      if (currentQuestion && currentQuestion.options.length === 0 && !/^[.]+$/.test(line)) {
        if (!this.looksLikeNewQuestion(line) || this.isRomanNumeralLine(line)) {
          currentQuestion.question = `${currentQuestion.question} ${line}`.trim();
        } else {
          saveCurrentQuestion();
          currentQuestion = {
            id: `q${questions.length + 1}`,
            sourceNumber: questions.length + 1,
            question: line,
            options: [],
            subStatements: [],
            correctAnswer: null,
            confidence: 0.8,
            parsingPattern: 'inferred_question_line'
          };
        }
      } else if (currentQuestion && currentQuestion.options.length > 0) {
        if (this.looksLikeNewQuestion(line)) {
          saveCurrentQuestion();
          pendingStemLines = [line];
        }
        // Ignore stray text after choices unless it clearly starts a new question.
        continue;
      } else if (!currentQuestion && (
        /[?]$/.test(line) ||
        /^(which|what|where|when|why|how|define|list|is|are|can|does|do|should|would|ano|sino|alin|bakit|paano|kung|sinuri|isipin)\b/i.test(line)
      )) {
        pendingStemLines.push(line);
      }
    }

    // Add last question
    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    return {
      questions,
      metadata: {
        totalDetected: questions.length,
        totalParagraphs: paragraphs.length,
        averageConfidence: questions.length > 0 
          ? questions.reduce((sum, q) => sum + (q.confidence || 0), 0) / questions.length 
          : 0,
        issues
      }
    };
  }

  isLikelyQuestionText(text) {
    const trimmed = String(text || '').replace(/\s+/g, ' ').trim();
    if (!trimmed) return false;

    const romanQuestionMatch = trimmed.match(/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI|XXII|XXIII|XXIV|XXV|XXVI|XXVII|XXVIII|XXIX|XXX|XXXI|XXXII|XXXIII|XXXIV|XXXV)[.)]\s*(.+)$/i);
    if (romanQuestionMatch) {
      const remainder = romanQuestionMatch[1].trim();
      return /^(which|what|where|when|why|how|define|list|is|are|can|does|do|should|would|ano|sino|alin|bakit|paano|kung|sinuri|isipin)\b/i.test(remainder) || /[?]$/.test(remainder) || remainder.length > 18;
    }

    if (/^(?:[A-D]|\d+)[.)]\s+.+$/i.test(trimmed)) return false;
    if (/^(?:Question|Q)\s*\d+\b/i.test(trimmed)) return true;
    if (/[?]$/.test(trimmed)) return true;
    if (/^(which|what|where|when|why|how|define|list|is|are|can|does|do|should|would|ano|sino|alin|bakit|paano|kung|sinuri|isipin)\b/i.test(trimmed)) return true;
    return trimmed.length > 18;
  }

  cleanQuestions(rawQuestions = []) {
    const cleaned = [];
    const seenText = new Set();
    const seenSourceNumber = new Set();

    // Sort by sourceNumber ascending so lower-numbered wins on collision
    const sorted = [...rawQuestions].sort((a, b) => {
      const na = parseFloat(a.sourceNumber) || 0;
      const nb = parseFloat(b.sourceNumber) || 0;
      return na - nb;
    });

    // Find the max real integer source number to use as a cap
    const maxSource = sorted.reduce((max, q) => {
      const n = parseInt(q.sourceNumber, 10);
      return !isNaN(n) && n > max ? n : max;
    }, 0);

    for (const question of sorted) {
      if (!question || typeof question !== 'object') continue;

      const questionText = String(question.question || '').replace(/\s+/g, ' ').trim();
      if (!questionText || !this.isLikelyQuestionText(questionText)) continue;

      // Deduplicate by normalized question text fingerprint (first 80 chars, lowercase)
      const textFingerprint = questionText.toLowerCase().slice(0, 80).replace(/\s+/g, ' ');
      if (seenText.has(textFingerprint)) continue;
      seenText.add(textFingerprint);

      // Deduplicate by integer source number
      const intSource = parseInt(question.sourceNumber, 10);
      if (!isNaN(intSource)) {
        if (seenSourceNumber.has(intSource)) continue;
        seenSourceNumber.add(intSource);
      }

      const normalizedOptions = Array.isArray(question.options)
        ? question.options
            .filter(option => option && option.text)
            .map(option => ({
              ...option,
              text: String(option.text).replace(/\s+/g, ' ').trim()
            }))
            .filter(option => !/^(?:[A-D]|[IVXLCDM]+|\d+)[.)]\s*$/i.test(String(option.text).trim()))
        : [];

      const sourceNumber = question.sourceNumber || (cleaned.length + 1);

      cleaned.push({
        ...question,
        question: questionText,
        sourceNumber,
        options: normalizedOptions
      });

      // Hard cap: stop once we've reached the highest integer source number
      if (maxSource > 0 && cleaned.length >= maxSource) break;
    }

    return cleaned;
  }

  /**
   * Validate parsed questions
   */
  validateQuestions(questions) {
    const issues = [];

    questions.forEach((q, index) => {
      const questionType = q.type || this.detectQuestionType(q.question || '', q.options);

      // Missing question text
      if (!q.question || q.question.trim().length === 0) {
        issues.push({
          questionNumber: q.sourceNumber,
          severity: 'error',
          message: 'Question has no text'
        });
      }

      // No options
      if (q.options.length === 0 && questionType !== 'essay' && questionType !== 'short_answer') {
        issues.push({
          questionNumber: q.sourceNumber,
          severity: 'error',
          message: 'No answer options detected'
        });
      }

      // Duplicate options
      const optionTexts = q.options.map(o => o.text.toLowerCase());
      const duplicates = optionTexts.filter((v, i) => optionTexts.indexOf(v) !== i);
      if (duplicates.length > 0) {
        issues.push({
          questionNumber: q.sourceNumber,
          severity: 'warning',
          message: 'Duplicate answer options detected'
        });
      }

      // Missing answer
      const correctAnswers = q.correctAnswers?.length
        ? q.correctAnswers
        : (q.correctAnswer ? [q.correctAnswer] : []);

      if (correctAnswers.length === 0 && questionType !== 'essay' && questionType !== 'short_answer') {
        issues.push({
          questionNumber: q.sourceNumber,
          severity: 'warning',
          message: 'Correct answer not found - marked for review',
          needsReview: true
        });
      }

      // Invalid answer
      if (correctAnswers.length > 0) {
        const validOptionIds = q.options.map(o => o.id.toUpperCase());
        if (correctAnswers.some(answer => !validOptionIds.includes(answer.toUpperCase()))) {
          issues.push({
            questionNumber: q.sourceNumber,
            severity: 'error',
            message: 'One or more correct answers do not match an option'
          });
        }
      }
    });

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      questionsNeedingReview: questions.filter(q => {
        const answers = q.correctAnswers?.length
          ? q.correctAnswers
          : (q.correctAnswer ? [q.correctAnswer] : []);
        return answers.length === 0;
      }).length
    };
  }

  /**
   * Create normalized quiz JSON structure
   */
  createNormalizedQuiz(questions, metadata = {}) {
    return {
      title: metadata.title || 'Imported Quiz',
      description: metadata.description || '',
      questions: questions.map(q => ({
        id: q.id || `q${questions.indexOf(q) + 1}`,
        type: q.type || this.detectQuestionType(q.question, q.options),
        question: {
          html: q.question,
          plainText: q.question
        },
        options: q.options.map(opt => ({
          id: opt.id,
          html: opt.text,
          plainText: opt.text
        })),
        subStatements: q.subStatements ? q.subStatements.map((s, idx) => ({
          index: idx + 1,
          html: s.text,
          plainText: s.text
        })) : [],
        correctAnswers: q.correctAnswers?.length
          ? q.correctAnswers
          : (q.correctAnswer ? [q.correctAnswer] : []),
        metadata: {
          sourceQuestionNumber: q.sourceNumber,
          confidence: q.confidence || 0.5,
          needsReview: !(q.correctAnswers?.length || q.correctAnswer),
          parsingPattern: q.parsingPattern || 'unknown'
        }
      })),
      importMetadata: {
        sourceFilename: metadata.filename || 'unknown',
        importedAt: new Date(),
        parsingReport: {
          totalQuestionsDetected: questions.length,
          successfullyImported: questions.length,
          needsReview: questions.filter(q => !(q.correctAnswers?.length || q.correctAnswer)).length,
          issues: []
        }
      }
    };
  }
}

export default DocxParser;
