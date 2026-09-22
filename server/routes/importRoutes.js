import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { ImportedDocument, Quiz } from '../models/index.js';
import DocxParser from '../utils/docxParser.js';
import { extractQuizWithGemini } from '../utils/aiQuizEnhancer.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // Only accept DOCX files
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.originalname.endsWith('.docx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are accepted'));
    }
  }
});

const parser = new DocxParser();

/**
 * GET /api/import/history
 * Get recent converted/imported files for a user
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.headers['user-id'] || 'anonymous';
    const documents = await ImportedDocument.find({ userId })
      .select('filename status detectedQuestions createdAt')
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    res.json({
      history: documents.map(document => ({
        id: document._id,
        filename: document.filename,
        status: document.status,
        detectedQuestions: document.detectedQuestions || 0,
        createdAt: document.createdAt
      }))
    });
  } catch (error) {
    console.error('Import history error:', error);
    res.status(500).json({ error: 'Failed to fetch converted file history' });
  }
});

/**
 * POST /api/import/upload
 * Upload and parse DOCX file
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.headers['user-id'] || 'anonymous';
    const filename = req.file.originalname;

    // Parse DOCX from buffer
    const parseResult = await parser.parseDocxBuffer(req.file.buffer);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Failed to parse DOCX file',
        details: parseResult.error
      });
    }

    // Extract questions
    const structuredLines = parser.structuredLines(parseResult.structure);
    const structuredContent = structuredLines.join('\n');
    let enhancedQuestions;
    let metadata;
    let aiMetadata;

    if (process.env.GEMINI_API_KEY) {
      try {
        const extraction = await extractQuizWithGemini(structuredContent, filename);
        enhancedQuestions = parser.cleanQuestions(extraction.questions || []);
        metadata = { totalDetected: enhancedQuestions.length, extraction: 'gemini' };
        aiMetadata = extraction;
      } catch (geminiErr) {
        console.warn('Gemini API high demand / error, falling back to local parser:', geminiErr.message);
        const deterministicResult = parser.parseQuestions(structuredContent);
        enhancedQuestions = parser.cleanQuestions(deterministicResult.questions);
        metadata = { ...deterministicResult.metadata, warning: 'Gemini high demand fallback used', totalDetected: enhancedQuestions.length };
        aiMetadata = { attempted: true, reason: geminiErr.message };
      }
    } else {
      const deterministicResult = parser.parseQuestions(structuredContent);
      enhancedQuestions = parser.cleanQuestions(deterministicResult.questions);
      metadata = { ...deterministicResult.metadata, totalDetected: enhancedQuestions.length };
      aiMetadata = { attempted: false, enhanced: 0, reason: 'GEMINI_API_KEY is not configured' };
    }

    // Validate deterministic and AI-enhanced results
    const validation = parser.validateQuestions(enhancedQuestions);

    // Save imported document to database
    const importedDoc = new ImportedDocument({
      userId,
      filename,
      originalContent: {
        text: parseResult.text,
        html: parseResult.html,
        structure: parseResult.structure,
        messages: parseResult.messages
      },
      parsedStructure: {
        questions: enhancedQuestions,
        metadata,
        elements: parseResult.structure,
        aiMetadata
      },
      detectedQuestions: enhancedQuestions.length,
      status: 'parsed'
    });

    await importedDoc.save();

    // Return preview data
    res.json({
      success: true,
      importId: importedDoc._id,
      filename,
      totalQuestionsDetected: enhancedQuestions.length,
      questionsNeedingReview: validation.questionsNeedingReview,
      issues: validation.issues,
      questions: enhancedQuestions.map(q => ({
        id: q.id,
        sourceNumber: q.sourceNumber,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        confidence: q.confidence,
        needsReview: !(q.correctAnswers?.length || q.correctAnswer)
      }))
    });
  } catch (error) {
    console.error('Import error:', error);
    const databaseUnavailable = mongoose.connection.readyState !== 1;
    res.status(databaseUnavailable ? 503 : 500).json({
      error: databaseUnavailable ? 'MongoDB unavailable' : 'Failed to process file',
      details: databaseUnavailable
        ? 'Start MongoDB or set MONGODB_URI before importing a quiz.'
        : error.message
    });
  }
});

/**
 * GET /api/import/preview/:importId
 * Get detailed preview of parsed questions
 */
router.get('/preview/:importId', async (req, res) => {
  try {
    const importedDoc = await ImportedDocument.findById(req.params.importId);

    if (!importedDoc) {
      return res.status(404).json({ error: 'Import not found' });
    }

    const questions = importedDoc.parsedStructure.questions;
    const validation = parser.validateQuestions(questions);

    res.json({
      filename: importedDoc.filename,
      totalDetected: questions.length,
      issues: validation.issues,
      questionsNeedingReview: validation.questionsNeedingReview,
      questions: questions.map((q, idx) => ({
        number: idx + 1,
        sourceNumber: q.sourceNumber,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        subStatements: q.subStatements,
        confidence: q.confidence,
        hasIssues: validation.issues.some(i => i.questionNumber === q.sourceNumber),
        issues: validation.issues.filter(i => i.questionNumber === q.sourceNumber)
      }))
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to get preview' });
  }
});

/**
 * POST /api/import/create-quiz
 * Convert import preview into actual quiz
 */
router.post('/create-quiz', async (req, res) => {
  try {
    const { importId, quizTitle, quizDescription, userId, isPublished, settings } = req.body;

    if (!importId || !quizTitle) {
      return res.status(400).json({
        error: 'Missing required fields: importId, quizTitle'
      });
    }

    const importedDoc = await ImportedDocument.findById(importId);

    if (!importedDoc) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Create normalized quiz structure
    const normalizedQuiz = parser.createNormalizedQuiz(
      importedDoc.parsedStructure.questions,
      {
        title: quizTitle,
        description: quizDescription,
        filename: importedDoc.filename
      }
    );

    // Create and save quiz
    const quiz = new Quiz({
      userId: userId || importedDoc.userId,
      title: normalizedQuiz.title,
      description: normalizedQuiz.description,
      questions: normalizedQuiz.questions,
      importMetadata: normalizedQuiz.importMetadata,
      isPublished: isPublished || false,
      settings: settings || {}
    });

    await quiz.save();

    res.json({
      success: true,
      quizId: quiz._id,
      title: quiz.title,
      questionsCreated: quiz.questions.length,
      message: 'Quiz created successfully. Review and make edits as needed.'
    });
  } catch (error) {
    console.error('Quiz creation error:', error);
    res.status(500).json({
      error: 'Failed to create quiz',
      details: error.message
    });
  }
});

/**
 * POST /api/import/update-question
 * Update a parsed question before saving quiz
 */
router.post('/update-question', async (req, res) => {
  try {
    const { importId, questionNumber, updates } = req.body;

    if (!importId || !questionNumber || !updates) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    const importedDoc = await ImportedDocument.findById(importId);

    if (!importedDoc) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Find and update question
    const questionIdx = importedDoc.parsedStructure.questions.findIndex(
      q => q.sourceNumber === questionNumber
    );

    if (questionIdx === -1) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Apply updates
    const question = importedDoc.parsedStructure.questions[questionIdx];
    Object.assign(question, updates);

    importedDoc.markModified('parsedStructure');
    await importedDoc.save();

    res.json({
      success: true,
      message: 'Question updated successfully'
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({
      error: 'Failed to update question',
      details: error.message
    });
  }
});

/**
 * DELETE /api/import/:importId
 * Delete an import
 */
router.delete('/:importId', async (req, res) => {
  try {
    await ImportedDocument.findByIdAndDelete(req.params.importId);
    res.json({ success: true, message: 'Import deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete import' });
  }
});

export default router;
