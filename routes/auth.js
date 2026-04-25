// backend/routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const authMw = require('../middleware/auth');

// uid must be defined BEFORE DEFAULT_TASKS uses it
function uid() {
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
}

function makeDefaultTasks() {
  return [
    { id: uid(), name: 'Morning workout',    cat: 'health' },
    { id: uid(), name: 'Cold shower',        cat: 'health' },
    { id: uid(), name: 'Deep work block',    cat: 'work'   },
    { id: uid(), name: 'Read 30 min',        cat: 'study'  },
    { id: uid(), name: 'No social media AM', cat: 'other'  },
    { id: uid(), name: 'Meditate 10 min',    cat: 'health' },
  ];
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)       return res.status(400).json({ error: 'Email and password required' });
    if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    if (password.length < 6)       return res.status(400).json({ error: 'Password must be 6+ characters' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: 'Account already exists — sign in instead' });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({
      email:    email.toLowerCase(),
      password: hashed,
      tasks:    makeDefaultTasks(),
    });

    const token = signToken(user._id);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'No account found — create one first' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/auth/me
router.get('/me', authMw, (req, res) => {
  res.json({ user: req.user });  // ← req.user is a Mongoose DOCUMENT
});

module.exports = router;
