# DOCX-to-Online-Quiz Importer Platform

A complete, professional-grade system for importing Word documents (.docx) containing quiz questions and converting them into structured, editable online quizzes. Built with Node.js/Express, React, and MongoDB.

## Features

### Core Functionality
- **Drag-and-drop DOCX Upload**: Professional upload interface with real-time progress tracking
- **Intelligent Question Extraction**: Robust parsing that handles various question formats
- **Multiple Question Types**: Multiple choice, multiple select, true/false, fill-in-blank, short answer, essay
- **Smart Answer Detection**: Automatic detection of correct answers from various formats
- **Roman Numeral Support**: Intelligent differentiation between sub-statements and answer options
- **Image & Table Preservation**: Maintains images and tables within questions
- **Formatting Preservation**: Bold, italic, underline, highlight, and other formatting
- **Confidence Scoring**: Questions flagged for review if parsing confidence is low
- **Validation System**: Comprehensive validation before quiz creation
- **Interactive Preview**: Review all extracted questions before saving
- **Quiz Editor**: Full-featured editor for manual question refinement
- **Publishing System**: Generate student quiz links

### Technical Architecture
- **Backend**: Express.js with MongoDB integration
- **Frontend**: React with modern UI components
- **DOCX Parsing**: Mammoth.js for reliable Word document extraction
- **Authentication**: JWT-based user authentication
- **File Upload**: Multer for secure file handling
- **Database**: MongoDB for flexible schema design

## Project Structure

```
quiz-importer-platform/
├── server/
│   ├── models/
│   │   └── index.js              # MongoDB schemas (User, Quiz, Question, etc.)
│   ├── routes/
│   │   ├── importRoutes.js       # DOCX upload and parsing endpoints
│   │   ├── quizRoutes.js         # Quiz CRUD operations
│   │   └── userRoutes.js         # User authentication
│   ├── utils/
│   │   └── docxParser.js         # Core DOCX parsing logic
│   └── server.js                 # Express app entry point
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.js      # Quiz management dashboard
│   │   │   ├── DocxUpload.js     # Upload and preview page
│   │   │   ├── QuizEditor.js     # Question editing interface
│   │   │   └── QuizPreview.js    # Student-facing quiz preview
│   │   ├── components/
│   │   │   └── Navigation.js     # App navigation
│   │   ├── App.js                # Main React component
│   │   └── index.js              # React entry point
│   ├── public/
│   │   └── index.html            # HTML template
│   └── package.json              # React dependencies
├── package.json                  # Backend dependencies
├── .env.example                  # Environment configuration template
└── README.md                     # This file
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- MongoDB (local or Atlas)
- A modern web browser

### Step 1: Clone & Setup

```bash
cd quiz-importer-platform
npm run install-all
```

### Step 2: Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/quiz-importer
JWT_SECRET=your-secure-secret-key
FRONTEND_URL=http://localhost:3000
CLOUDCONVERT_API_KEY=your-cloudconvert-api-key
```

File conversion uses CloudConvert. Create an API key in your CloudConvert account and set `CLOUDCONVERT_API_KEY` in the server environment before using the converter menu.

### Step 3: Start the Application

#### Option A: Development Mode (Both servers)
```bash
npm run dev
```

This runs:
- Backend server on http://localhost:5000
- Frontend on http://localhost:3000

#### Option B: Start Separately

Terminal 1 - Backend:
```bash
npm start
```

Terminal 2 - Frontend:
```bash
cd client
npm start
```

## Usage Guide

### 1. Upload DOCX File
1. Navigate to **Import Quiz from Word**
2. Drag and drop your .docx file or click to browse
3. Click **Upload & Analyze Document**
4. Wait for parsing to complete

### 2. Review Extraction Preview
The system displays:
- Total questions detected
- Questions needing review (if any)
- Each extracted question with:
  - Question text
  - Detected answer options
  - Correct answer (if found)
  - Confidence scoring
  - Any issues or warnings

### 3. Create Quiz
1. Review all extracted questions
2. Make corrections if needed:
   - Click the question to edit
   - Modify text, options, or correct answer
   - Save changes
3. Provide quiz title and description
4. Click **Create Quiz**

### 4. Edit Quiz (Optional)
1. From Dashboard, click **Edit** on a quiz
2. Modify:
   - Quiz title and description
   - Individual questions
   - Answer options
   - Correct answers
3. Click **Save Quiz**

### 5. Publish & Share
1. Click **Publish** to make quiz available
2. Share the generated student link
3. Students can access and take the quiz

## Supported Question Formats

### Question Recognition
✓ Numbered questions (1. 2. 3.)
✓ Q-format (Q1. Q2.)
✓ Question label format (Question 1: Question 2:)
✓ Keyword-based detection (Which, What, How, Why, etc.)

### Answer Options
✓ A) B) C) D) format
✓ A. B. C. D. format
✓ 1) 2) 3) 4) format
✓ i) ii) iii) iv) format (roman numerals)
✓ Options in tables
✓ Inline answer options

### Correct Answer Detection
✓ Answer: A
✓ Ans: A
✓ Correct Answer: A
✓ Key: A
✓ Bold/highlighted options
✓ Answer key sections

### Special Question Types
✓ True/False questions
✓ Multiple select (select all that apply)
✓ Questions with sub-statements
✓ Questions with images
✓ Questions with tables
✓ Fill-in-the-blank
✓ Short answer / Essay questions

## API Documentation

### Upload & Parse

**POST /api/import/upload**
- Upload and parse DOCX file
- Returns: Parsed questions with confidence scores

**GET /api/import/preview/:importId**
- Get detailed preview of parsed questions
- Returns: Formatted questions with issue reports

**POST /api/import/create-quiz**
- Convert parsed questions into quiz
- Returns: Created quiz ID

### Quiz Management

**GET /api/quizzes**
- List all quizzes for user

**GET /api/quizzes/:quizId**
- Get quiz details and all questions

**POST /api/quizzes**
- Create new quiz

**PUT /api/quizzes/:quizId**
- Update quiz metadata

**DELETE /api/quizzes/:quizId**
- Delete quiz

**POST /api/quizzes/:quizId/publish**
- Publish quiz and get shareable link

### Questions

**POST /api/quizzes/:quizId/questions**
- Add question to quiz

**PUT /api/quizzes/:quizId/questions/:questionId**
- Update question details

**DELETE /api/quizzes/:quizId/questions/:questionId**
- Remove question from quiz

## Database Schema

### User
```javascript
{
  email: String (unique),
  password: String (hashed),
  name: String,
  createdAt: Date
}
```

### Quiz
```javascript
{
  userId: ObjectId,
  title: String,
  description: String,
  questions: [Question],
  importMetadata: {
    sourceFilename: String,
    importedAt: Date,
    parsingReport: {
      totalQuestionsDetected: Number,
      successfullyImported: Number,
      needsReview: Number,
      issues: [Object]
    }
  },
  isPublished: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Question
```javascript
{
  id: String,
  type: String, // multiple_choice, multiple_select, true_false, etc.
  question: {
    html: String,
    plainText: String
  },
  options: [{
    id: String,
    html: String,
    plainText: String
  }],
  correctAnswers: [String],
  subStatements: [{
    index: Number,
    html: String
  }],
  metadata: {
    sourceQuestionNumber: Number,
    confidence: Number,
    needsReview: Boolean,
    parsingPattern: String
  }
}
```

## Advanced Configuration

### DOCX Parser Settings

Edit `server/utils/docxParser.js` to customize:
- Question detection patterns
- Option format recognition
- Answer detection rules
- Confidence thresholds

### Validation Rules

Modify `server/utils/docxParser.js` `validateQuestions()` to add:
- Custom validation checks
- Business logic rules
- Content restrictions

### UI Customization

All styling is in CSS files within each page/component folder:
- Colors: Update CSS variables
- Layouts: Modify grid/flex properties
- Fonts: Change font-family declarations

## Production Deployment

### Backend Deployment (Heroku, Railway, Render, etc.)

1. Set environment variables in deployment platform
2. MongoDB connection must be accessible
3. Deploy from `server/` directory or root with Procfile

### Frontend Deployment (Vercel, Netlify, etc.)

1. Update `FRONTEND_URL` in `.env` for backend
2. Deploy `client/` directory
3. Configure API proxy if needed

### Security Checklist
- [ ] Change JWT_SECRET to strong random value
- [ ] Enable HTTPS
- [ ] Configure CORS properly
- [ ] Use environment variables for all secrets
- [ ] Implement rate limiting
- [ ] Add input validation on backend
- [ ] Use secure password hashing (bcrypt)
- [ ] Implement proper error handling

## Performance Optimization

### Backend
- Implement caching for frequently accessed quizzes
- Add pagination for quiz listing
- Optimize MongoDB queries with proper indexing
- Compress file uploads

### Frontend
- Code splitting with React.lazy()
- Image optimization
- Minification and bundling
- Lazy load components

## Troubleshooting

### DOCX Parsing Issues

**Questions not detected:**
- Check document uses standard heading/numbering
- Verify questions follow expected format
- Review extraction report for confidence scores

**Wrong answer detected:**
- Manually correct in Quiz Editor
- Update docxParser patterns if systematic

**Missing images/tables:**
- Verify file isn't corrupted
- Check file size isn't exceeding limit
- Try re-uploading

### Connection Issues

**Cannot connect to MongoDB:**
- Verify connection string in .env
- Check MongoDB service is running
- Ensure IP whitelist on MongoDB Atlas

**CORS errors:**
- Verify proxy setting in client/package.json
- Check FRONTEND_URL in backend .env

**Port already in use:**
- Change PORT in .env
- Kill process using port: `lsof -ti:5000 | xargs kill -9`

## Development Tips

### Adding New Question Types

1. Add type to validation in `docxParser.js`
2. Add case in React preview component
3. Update question form UI

### Custom Parsing Rules

Extend the `DocxParser` class:
```javascript
addCustomPattern(pattern, regex) {
  this.questionPatterns.custom = regex;
}
```

### Debugging Parser

Enable verbose logging:
```javascript
// In docxParser.js
console.log('Detected questions:', questions);
console.log('Validation issues:', validation);
```

## Contributing

To extend or modify:
1. Follow existing code structure
2. Add comments for complex logic
3. Test with various DOCX formats
4. Update documentation

## License

This project is provided as-is for educational and commercial use.

## Support & Documentation

- See code comments for detailed explanations
- Review API responses for error details
- Check browser console for client-side errors
- Review server logs for backend issues

---

**Built with ❤️ for educators and quiz platforms**
