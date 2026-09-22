import express from 'express';
import { Quiz, QuizAttempt } from '../models/index.js';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import { detectSimilarAttempts } from '../utils/detectSimilarAttempts.js';

const router = express.Router();

/**
 * GET /api/quizzes
 * Get all quizzes for a user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.headers['user-id'] || 'anonymous';

    const quizzes = await Quiz.find({ userId })
      .select('_id title description isPublished createdAt updatedAt questions clonedLinks')
      .lean();

    res.json({
      quizzes: quizzes.map(q => ({
        id: q._id,
        title: q.title,
        description: q.description,
        questionsCount: q.questions.length,
        isPublished: q.isPublished,
        clonedLinks: q.clonedLinks || [],
        createdAt: q.createdAt,
        updatedAt: q.updatedAt
      }))
    });
  } catch (error) {
    const databaseUnavailable = mongoose.connection.readyState !== 1;
    res.status(databaseUnavailable ? 503 : 500).json({
      error: databaseUnavailable ? 'MongoDB unavailable' : 'Failed to fetch quizzes',
      details: databaseUnavailable ? 'Start MongoDB or set MONGODB_URI before using the dashboard.' : undefined
    });
  }
});

/**
 * GET /api/quizzes/results/all
 * Get all results across all quizzes for a user
 */
router.get('/results/all', async (req, res) => {
  try {
    const userId = req.headers['user-id'] || 'anonymous';

    const quizzes = await Quiz.find({ userId }).select('_id title').lean();
    if (!quizzes.length) {
      return res.json({ results: [] });
    }

    const quizIds = quizzes.map(q => q._id);
    const attempts = await QuizAttempt.find({ quizId: { $in: quizIds } }).sort({ submittedAt: -1 }).lean();

    const results = attempts.map(attempt => {
      const quiz = quizzes.find(q => q._id.toString() === attempt.quizId.toString());
      return {
        id: attempt._id,
        quizId: attempt.quizId,
        quizTitle: quiz ? quiz.title : 'Unknown Quiz',
        studentName: attempt.userId || 'Anonymous',
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        questionResults: attempt.questionResults || [],
        answers: attempt.answers || [],
        deviceId: attempt.deviceId || null,
        deviceFingerprint: attempt.deviceFingerprint || null,
        userAgent: attempt.userAgent || null,
        ipAddress: attempt.ipAddress || null,
        linkId: attempt.linkId || null,
        linkLabel: attempt.linkLabel || null,
        submittedAt: attempt.submittedAt
      };
    });

    res.json({ results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

router.post('/results/detect-similar', async (req, res) => {
  try {
    const { resultId, quizId } = req.body;

    if (!resultId) {
      return res.status(400).json({ error: 'Result ID is required.' });
    }

    const userId = req.headers['user-id'] || 'anonymous';
    const quiz = await Quiz.findOne({ _id: quizId, userId }).select('_id').lean();
    if (!quiz && quizId) {
      return res.status(403).json({ error: 'Unauthorized quiz access.' });
    }

    const targetAttempt = await QuizAttempt.findById(resultId).lean();
    if (!targetAttempt) {
      return res.status(404).json({ error: 'Result not found.' });
    }

    const relatedAttempts = await QuizAttempt.find({
      quizId: targetAttempt.quizId,
      submittedAt: { $exists: true }
    }).sort({ submittedAt: -1 }).lean();

    const matches = detectSimilarAttempts(targetAttempt, relatedAttempts);

    res.json({
      success: true,
      matches,
      investigation: {
        target: {
          id: targetAttempt._id,
          studentName: targetAttempt.userId || 'Anonymous',
          submittedAt: targetAttempt.submittedAt
        },
        totalCompared: relatedAttempts.length,
        matchedCount: matches.length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to investigate related attempts.' });
  }
});

router.delete('/results/bulk', async (req, res) => {
  try {
    const userId = req.headers['user-id'] || 'anonymous';
    const { resultIds = [] } = req.body || {};

    if (!Array.isArray(resultIds) || resultIds.length === 0) {
      return res.status(400).json({ error: 'At least one result ID is required.' });
    }

    const validIds = resultIds.filter(Boolean);
    const quizzes = await Quiz.find({ userId }).select('_id').lean();
    const quizIds = quizzes.map(quiz => quiz._id);

    const deleted = await QuizAttempt.deleteMany({
      _id: { $in: validIds },
      quizId: { $in: quizIds }
    });

    res.json({ success: true, deletedCount: deleted.deletedCount || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete selected results.' });
  }
});

/**
 * POST /api/quizzes/:quizId/cloned-links
 * Create a new cloned link for a quiz
 */
router.post('/:quizId/cloned-links', async (req, res) => {
  try {
    const { label } = req.body;
    if (!label || !label.trim()) {
      return res.status(400).json({ error: 'Label is required' });
    }
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const linkId = randomBytes(8).toString('hex');
    quiz.clonedLinks = quiz.clonedLinks || [];
    quiz.clonedLinks.push({ linkId, label: label.trim() });
    await quiz.save();

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.json({
      success: true,
      link: { linkId, label: label.trim(), createdAt: new Date() },
      url: `${baseUrl}/quiz/${quiz._id}?linkId=${linkId}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create cloned link' });
  }
});

/**
 * DELETE /api/quizzes/:quizId/cloned-links/:linkId
 * Delete a cloned link
 */
router.delete('/:quizId/cloned-links/:linkId', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    quiz.clonedLinks = (quiz.clonedLinks || []).filter(l => l.linkId !== req.params.linkId);
    await quiz.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete cloned link' });
  }
});

/**
 * PUT /api/quizzes/:quizId/cloned-links/:linkId
 * Update label and/or custom settings for a cloned link
 */
router.put('/:quizId/cloned-links/:linkId', async (req, res) => {
  try {
    const { label, settings } = req.body;
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const link = (quiz.clonedLinks || []).find(l => l.linkId === req.params.linkId);
    if (!link) return res.status(404).json({ error: 'Cloned link not found' });

    if (label && label.trim()) link.label = label.trim();
    if (settings !== undefined) link.settings = settings;

    quiz.markModified('clonedLinks');
    await quiz.save();

    res.json({ success: true, link });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cloned link settings' });
  }
});

/**
 * GET /api/quizzes/:quizId
 * Get single quiz details
 */
router.get('/:quizId', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    res.json({
      id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      isPublished: quiz.isPublished,
      settings: quiz.settings || {},
      questions: quiz.questions,
      clonedLinks: quiz.clonedLinks || [],
      importMetadata: quiz.importMetadata,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

/**
 * POST /api/quizzes
 * Create new quiz
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.headers['user-id'] || 'anonymous';
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const quiz = new Quiz({
      userId,
      title,
      description: description || '',
      questions: [],
      isPublished: false
    });

    await quiz.save();

    res.status(201).json({
      id: quiz._id,
      title: quiz.title,
      message: 'Quiz created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

/**
 * PUT /api/quizzes/:quizId
 * Update quiz metadata
 */
router.put('/:quizId', async (req, res) => {
  try {
    const { title, description, isPublished, settings, questions } = req.body;

    const updateObj = {
      updatedAt: new Date()
    };
    if (title !== undefined) updateObj.title = title;
    if (description !== undefined) updateObj.description = description;
    if (isPublished !== undefined) updateObj.isPublished = isPublished;
    if (settings !== undefined) updateObj.settings = settings;
    if (questions !== undefined) updateObj.questions = questions;

    const quiz = await Quiz.findByIdAndUpdate(
      req.params.quizId,
      updateObj,
      { new: true }
    );

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    res.json({
      success: true,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        isPublished: quiz.isPublished,
        settings: quiz.settings || {}
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

/**
 * POST /api/quizzes/:quizId/questions
 * Add question to quiz
 */
router.post('/:quizId/questions', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question data is required' });
    }

    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    quiz.questions.push(question);
    await quiz.save();

    res.status(201).json({
      success: true,
      question: question
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add question' });
  }
});

/**
 * PUT /api/quizzes/:quizId/questions/:questionId
 * Update question
 */
router.put('/:quizId/questions/:questionId', async (req, res) => {
  try {
    const { quizId, questionId } = req.params;
    const updates = req.body;

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const question = quiz.questions.find(q => 
      (q.id && q.id.toString() === questionId) || 
      (q._id && q._id.toString() === questionId)
    );

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    Object.assign(question, updates);
    await quiz.save();

    res.json({
      success: true,
      question
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update question' });
  }
});

/**
 * DELETE /api/quizzes/:quizId/questions/:questionId
 * Delete question
 */
router.delete('/:quizId/questions/:questionId', async (req, res) => {
  try {
    const { quizId, questionId } = req.params;

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    quiz.questions = quiz.questions.filter(q => q.id !== questionId);
    await quiz.save();

    res.json({ success: true, message: 'Question deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

/**
 * DELETE /api/quizzes/:quizId
 * Delete entire quiz
 */
router.delete('/:quizId', async (req, res) => {
  try {
    await Quiz.findByIdAndDelete(req.params.quizId);
    res.json({ success: true, message: 'Quiz deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

/**
 * POST /api/quizzes/:quizId/publish
 * Publish quiz
 */
router.post('/:quizId/publish', async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndUpdate(
      req.params.quizId,
      { isPublished: true, updatedAt: new Date() },
      { new: true }
    );

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quizLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/quiz/${quiz._id}`;

    res.json({
      success: true,
      quizId: quiz._id,
      quizLink,
      message: 'Quiz published successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to publish quiz' });
  }
});

/**
 * GET /api/quizzes/:quizId/public
 * Get quiz for students taking it (strips correctAnswers)
 */
router.get('/:quizId/public', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz || !quiz.isPublished) {
      return res.status(404).json({ error: 'Quiz not found or not published' });
    }

    // Resolve linkLabel & merged custom settings if linkId query param provided
    let linkLabel = null;
    let effectiveSettings = quiz.settings || {};
    const { linkId } = req.query;
    if (linkId) {
      const found = (quiz.clonedLinks || []).find(l => l.linkId === linkId);
      if (found) {
        linkLabel = found.label;
        if (found.settings && Object.keys(found.settings).length > 0) {
          effectiveSettings = { ...quiz.settings, ...found.settings };
        }
      }
    }

    // Strip out correctAnswers and other sensitive data
    const publicQuestions = quiz.questions.map(q => {
      const publicQ = q.toObject ? q.toObject() : { ...q };
      delete publicQ.correctAnswers;
      delete publicQ.correctAnswer;
      return publicQ;
    });

    res.json({
      id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      settings: effectiveSettings,
      questions: publicQuestions,
      linkLabel: linkLabel || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load quiz' });
  }
});

/**
 * POST /api/quizzes/:quizId/submit
 * Submit a quiz attempt
 */
router.post('/:quizId/submit', async (req, res) => {
  try {
    const { studentName, answers } = req.body;
    
    if (!studentName || !answers) {
      return res.status(400).json({ error: 'Student name and answers are required' });
    }

    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const settings = quiz.settings || {};
    let score = 0;
    const questionResults = [];

    quiz.questions.forEach(question => {
      const qId = question.id || (question._id && question._id.toString());
      const studentAnswerObj = answers.find(a => a.questionId === qId);
      const selected = studentAnswerObj ? studentAnswerObj.selectedAnswers || [] : [];
      const correct = question.correctAnswers || (question.correctAnswer ? [question.correctAnswer] : []);

      const isCorrect = correct.length > 0 && 
                        correct.length === selected.length && 
                        correct.every((val, index) => val.toUpperCase() === (selected[index] || '').toUpperCase());

      if (isCorrect) {
        score += 1;
      } else if (settings.negativeMarking && selected.length > 0) {
        score -= 1;
      }

      questionResults.push({
        questionId: qId,
        selectedAnswers: selected,
        correctAnswers: correct,
        isCorrect
      });
    });

    const orderedQuestionResults = quiz.questions.map(question => {
      const qId = question.id || (question._id && question._id.toString());
      return questionResults.find(item => item.questionId === qId) || {
        questionId: qId,
        selectedAnswers: [],
        correctAnswers: [],
        isCorrect: false
      };
    });

    // Ensure score doesn't drop below 0 if negative marking is enabled
    if (score < 0) score = 0;

    const attempt = new QuizAttempt({
      userId: studentName,
      quizId: quiz._id,
      answers,
      questionResults: orderedQuestionResults,
      score,
      totalQuestions: quiz.questions.length,
      deviceId: req.body.deviceId || null,
      deviceFingerprint: req.body.deviceFingerprint || null,
      userAgent: req.body.userAgent || null,
      ipAddress: req.ip || null,
      linkId: req.body.linkId || null,
      linkLabel: req.body.linkLabel || null,
      startedAt: new Date(),
      submittedAt: new Date()
    });

    await attempt.save();

    res.json({ 
      success: true, 
      score, 
      totalQuestions: quiz.questions.length,
      settings,
      questionResults
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

export default router;
