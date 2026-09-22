import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const questionSchema = new mongoose.Schema({
  id: String,
  type: {
    type: String,
    enum: [
      'multiple_choice',
      'multiple_select',
      'true_false',
      'fill_blank',
      'short_answer',
      'essay',
      'matching',
      'sub_statements'
    ]
  },
  question: {
    html: String,
    plainText: String
  },
  options: [{
    id: String,
    html: String,
    plainText: String
  }],
  subStatements: [{
    index: Number,
    html: String,
    plainText: String
  }],
  correctAnswers: [String], // Can be array for multiple select
  images: [{
    filename: String,
    base64: String,
    position: String // before, after, or embedded
  }],
  metadata: {
    sourceQuestionNumber: Number,
    confidence: Number,
    needsReview: Boolean,
    parsingNotes: String,
    originalFormat: String
  }
}, { _id: false });

const quizSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  questions: [questionSchema],
  importMetadata: {
    sourceFilename: String,
    importedAt: Date,
    docxStructure: mongoose.Schema.Types.Mixed, // Preserve original structure
    parsingReport: {
      totalQuestionsDetected: Number,
      successfullyImported: Number,
      needsReview: Number,
      issues: [mongoose.Schema.Types.Mixed]
    }
  },
  isPublished: { type: Boolean, default: false },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  clonedLinks: [{
    linkId: { type: String, required: true },
    label: { type: String, required: true },
    settings: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const importedDocumentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  filename: String,
  originalContent: mongoose.Schema.Types.Mixed, // Full preserved DOCX structure
  parsedStructure: mongoose.Schema.Types.Mixed, // Extracted and analyzed structure
  detectedQuestions: Number,
  status: {
    type: String,
    enum: ['uploaded', 'parsing', 'parsed', 'error'],
    default: 'uploaded'
  },
  error: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => Date.now() + 7*24*60*60*1000 } // 7 days
});

const quizAttemptSchema = new mongoose.Schema({
  userId: { type: String },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  answers: [{
    questionId: String,
    selectedAnswers: [String]
  }],
  score: Number,
  totalQuestions: Number,
  questionResults: [mongoose.Schema.Types.Mixed],
  deviceId: { type: String, default: null },
  deviceFingerprint: { type: String, default: null },
  userAgent: { type: String, default: null },
  ipAddress: { type: String, default: null },
  linkId: { type: String, default: null },
  linkLabel: { type: String, default: null },
  startedAt: Date,
  submittedAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);
export const Quiz = mongoose.model('Quiz', quizSchema);
export const ImportedDocument = mongoose.model('ImportedDocument', importedDocumentSchema);
export const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
