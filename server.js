// backend/server.js
require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const authMw   = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// ── CORS ─────────────────────────────────────────────────────────────────────
// DEV  (NODE_ENV !== 'production'):
//   ANY origin on localhost or 127.0.0.1 — any port — is allowed.
//   This covers port 60918, 5500, 3000, 8080 … whatever VS Code picks.
// PROD (NODE_ENV=production):
//   Only origins in CLIENT_ORIGINS env var (comma-separated).

const prodOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const LOCAL_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function originCheck(origin, cb) {
  if (!origin)                           return cb(null, true);  // curl/Postman
  if (!isProd && LOCAL_RE.test(origin))  return cb(null, true);  // any localhost port
  if (prodOrigins.includes(origin))      return cb(null, true);  // explicit whitelist
  console.warn('CORS blocked:', origin);
  cb(new Error('CORS: origin not allowed'));
}

const corsOpts = {
  origin: originCheck,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 204,
};

// OPTIONS preflight MUST be first — before any other middleware
app.options('*', cors(corsOpts));
app.use(cors(corsOpts));
app.use(express.json({ limit: '2mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', authMw, require('./routes/user'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date(), mode: isProd ? 'production' : 'development' });
});

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, _req, res, _next) => {
  if (err.message?.startsWith('CORS:')) return res.status(403).json({ error: err.message });
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── MongoDB ───────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅  MongoDB connected');
    app.listen(PORT, () => {
      console.log(`\n🚀  Devnix API  →  http://localhost:${PORT}`);
      console.log(`🌐  CORS mode   →  ${isProd ? 'production' : 'development (ALL localhost ports allowed)'}\n`);
    });
  })
  .catch(err => { console.error('❌  MongoDB failed:', err.message); process.exit(1); });
