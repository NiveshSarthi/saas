import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import functionRoutes from './routes/functions.js';
// Database Connection
import { MongoMemoryServer } from 'mongodb-memory-server';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (for unified config in Docker)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Also load local .env if exists (for development)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // In production, check against allowed origins
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-mock-user-email', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // Cache preflight request for 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '50mb' }));

const connectDB = async () => {
  let mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sarthi_task_tracker';

  try {
    // Try connecting to local/provided URI first
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    console.log(`Connected to MongoDB at ${mongoUri}`);
  } catch (err) {
    console.warn(`Local MongoDB connection failed: ${err.message}`);
    console.log('Starting In-Memory MongoDB...');

    try {
      const mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      await mongoose.connect(mongoUri);
      console.log(`Connected to In-Memory MongoDB at ${mongoUri}`);

      // Auto-seed for in-memory
      console.log('Seeding initial data...');
      try {
        const { seedData } = await import('./seeds/rbac_seed.js');
        await seedData();
        console.log('Seeding complete.');
      } catch (seedErr) {
        console.error('Seeding failed:', seedErr);
      }

    } catch (memErr) {
      console.error('Fatal: Could not start in-memory database:', memErr);
    }
  }
};
connectDB();

// Routes
app.use('/auth', authRoutes);
app.use('/rest/v1', entityRoutes); // Emulate Base44 entity API
app.use('/functions/v1', functionRoutes); // Emulate Base44 function API

// Debug Route: Dump complete database
app.get('/debug/db-dump', async (req, res) => {
  try {
    const collections = mongoose.connection.collections;
    const dump = {};

    for (const key in collections) {
      const collectionName = collections[key].collectionName;
      const model = Object.values(mongoose.models).find(m => m.collection.collectionName === collectionName);
      if (model) {
        dump[collectionName] = await model.find({});
      }
    }

    res.json({
      timestamp: new Date(),
      database_type: 'in-memory-mongodb',
      collections: dump
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// =============================================
// STATIC FILE SERVING (Production)
// =============================================
// In production, serve the built frontend from /dist
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../dist');

  // Serve static files
  app.use(express.static(distPath));

  // SPA catch-all: serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  console.log(`Serving static files from ${distPath}`);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
