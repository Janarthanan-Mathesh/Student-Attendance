import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

console.log('[DEBUG] Index.ts loaded');
console.log('[DEBUG] About to import apiRouter...');

import apiRouter from './routes/api';
console.log('[DEBUG] apiRouter imported');

import { seedDatabase } from './db/seed';
console.log('[DEBUG] seedDatabase imported');

console.log('[DEBUG] Routes imported');

const app = express();
const PORT = process.env.PORT || 5050;

console.log('[DEBUG] Express app initialized, PORT:', PORT);

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Intelligent Attendance Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', apiRouter);

// Start Server and Seed Database
async function startServer() {
  try {
    console.log('🔄 Seeding database...');
    const seedTimeout = setTimeout(() => {
      console.error('❌ Database seeding timeout after 30 seconds!');
      process.exit(1);
    }, 30000);

    await seedDatabase();
    clearTimeout(seedTimeout);

    console.log('✅ Database seeding complete.');
    console.log('🚀 Starting server...');

    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`✅ Backend API Server running at http://localhost:${PORT}`);
      console.log(`Health Check: http://localhost:${PORT}/health`);
      console.log(`API Base URL: http://localhost:${PORT}/api`);
      console.log(`====================================================`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is in use. Try these commands:`);
        console.error(`  netstat -ano | findstr :${PORT}`);
        console.error(`  taskkill /PID <PID> /F`);
        process.exit(1);
      } else {
        throw err;
      }
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Defer startup to next event loop tick
setImmediate(() => startServer());
