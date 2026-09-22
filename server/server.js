import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import routes
import quizRoutes from './routes/quizRoutes.js';
import importRoutes from './routes/importRoutes.js';
import userRoutes from './routes/userRoutes.js';
import converterRoutes from './routes/converterRoutes.js';
import { User } from './models/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/quiz-importer';
mongoose.set('bufferTimeoutMS', 2000);
mongoose.connect(mongoUri)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/quizzes', quizRoutes);
app.use('/api/import', importRoutes);
app.use('/api/users', userRoutes);
app.use('/api/converter', converterRoutes);

// Health check
app.get('/api/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'OK' : 'DEGRADED',
    database: databaseReady ? 'connected' : 'unavailable',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
