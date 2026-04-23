// backend/routes/user.js
// All routes protected by authMw (applied in server.js)
const router = require('express').Router();
const User   = require('../models/User');

const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// Helper: safely convert Mongoose Map/Object to plain JS object
function mapToObj(val) {
  if (!val) return {};
  if (val instanceof Map) return Object.fromEntries(val);
  if (typeof val === 'object' && typeof val.toJSON === 'function') {
    const j = val.toJSON();
    if (j && typeof j === 'object') return j;
  }
  return val;
}

// GET /api/user/data
router.get('/data', (req, res) => res.json({ user: req.user }));

// PATCH /api/user/settings
router.patch('/settings', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { dark: !!req.body.dark } },
      { new: true, select: '-password' }
    );
    res.json({ user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════
//  TASKS
// ════════════════════════════════

router.get('/tasks', (req, res) => res.json({ tasks: req.user.tasks }));

router.post('/tasks', async (req, res) => {
  try {
    const { name, cat } = req.body;
    if (!name) return res.status(400).json({ error: 'Task name required' });
    const task = { id: uid(), name: name.trim(), cat: cat || 'other' };
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { tasks: task } },
      { new: true, select: '-password' }
    );
    res.json({ task, tasks: user.tasks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/tasks/:taskId', async (req, res) => {
  try {
    const { name } = req.body;
    await User.updateOne(
      { _id: req.user._id, 'tasks.id': req.params.taskId },
      { $set: { 'tasks.$.name': name.trim() } }
    );
    const user = await User.findById(req.user._id).select('-password');
    res.json({ tasks: user.tasks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/tasks/:taskId', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { tasks: { id: req.params.taskId } } },
      { new: true, select: '-password' }
    );
    res.json({ tasks: user.tasks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/user/check  — save full done/skipped/notes maps
router.patch('/check', async (req, res) => {
  try {
    const { done, skipped, notes } = req.body;
    const update = {};
    if (done    !== undefined) update.done    = done;
    if (skipped !== undefined) update.skipped = skipped;
    if (notes   !== undefined) update.notes   = notes;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true, select: '-password' }
    );
    res.json({
      done:    mapToObj(user.done),
      skipped: mapToObj(user.skipped),
      notes:   mapToObj(user.notes),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════
//  TRANSACTIONS
// ════════════════════════════════

router.get('/transactions', (req, res) => res.json({ transactions: req.user.transactions }));

router.post('/transactions', async (req, res) => {
  try {
    const { date, name, cat, type, amt, status } = req.body;
    if (!name || !cat || !type || amt === undefined)
      return res.status(400).json({ error: 'Missing required fields' });
    const tx = {
      id:     uid(),
      date:   date || new Date().toISOString().slice(0, 10),
      name:   name.trim(),
      cat, type,
      amt:    Number(amt),
      status: status || 'cleared',
    };
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { transactions: { $each: [tx], $position: 0 } } },
      { new: true, select: '-password' }
    );
    res.status(201).json({ transaction: tx, transactions: user.transactions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/transactions/:txId', async (req, res) => {
  try {
    const { date, name, cat, type, amt, status } = req.body;
    const s = {};
    if (date   !== undefined) s['transactions.$.date']   = date;
    if (name   !== undefined) s['transactions.$.name']   = name.trim();
    if (cat    !== undefined) s['transactions.$.cat']    = cat;
    if (type   !== undefined) s['transactions.$.type']   = type;
    if (amt    !== undefined) s['transactions.$.amt']    = Number(amt);
    if (status !== undefined) s['transactions.$.status'] = status;
    await User.updateOne(
      { _id: req.user._id, 'transactions.id': req.params.txId },
      { $set: s }
    );
    const user = await User.findById(req.user._id).select('-password');
    res.json({ transactions: user.transactions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/transactions/:txId', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { transactions: { id: req.params.txId } } },
      { new: true, select: '-password' }
    );
    res.json({ transactions: user.transactions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk delete — body: { ids: [...] }
router.delete('/transactions', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { transactions: { id: { $in: ids } } } },
      { new: true, select: '-password' }
    );
    res.json({ transactions: user.transactions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════
//  JOURNALS
// ════════════════════════════════

router.get('/journals', (req, res) => res.json({ journals: req.user.journals }));

router.post('/journals', async (req, res) => {
  try {
    const { title, body, mood, tags, date } = req.body;
    if (!title && !body) return res.status(400).json({ error: 'Title or body required' });
    const entry = {
      id:        uid(),
      title:     (title || 'Untitled').trim(),
      body:      body || '',
      mood:      mood || null,
      tags:      tags || [],
      date:      date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { journals: { $each: [entry], $position: 0 } } },
      { new: true, select: '-password' }
    );
    res.status(201).json({ journal: entry, journals: user.journals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/journals/:jid', async (req, res) => {
  try {
    const { title, body, mood, tags } = req.body;
    const s = { 'journals.$.updatedAt': new Date().toISOString() };
    if (title !== undefined) s['journals.$.title'] = title.trim();
    if (body  !== undefined) s['journals.$.body']  = body;
    if (mood  !== undefined) s['journals.$.mood']  = mood;
    if (tags  !== undefined) s['journals.$.tags']  = tags;
    await User.updateOne(
      { _id: req.user._id, 'journals.id': req.params.jid },
      { $set: s }
    );
    const user = await User.findById(req.user._id).select('-password');
    res.json({ journals: user.journals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/journals/:jid', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { journals: { id: req.params.jid } } },
      { new: true, select: '-password' }
    );
    res.json({ journals: user.journals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════
//  SAVINGS GOALS
// ════════════════════════════════

router.get('/goals', (req, res) => res.json({ savingsGoals: req.user.savingsGoals }));

router.post('/goals', async (req, res) => {
  try {
    const { name, emoji, target, saved, color } = req.body;
    if (!name || !target) return res.status(400).json({ error: 'Name and target required' });
    const goal = {
      id:     uid(),
      name:   name.trim(),
      emoji:  emoji || '🎯',
      target: Number(target),
      saved:  Number(saved) || 0,
      color:  color || '#3b82f6',
    };
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { savingsGoals: goal } },
      { new: true, select: '-password' }
    );
    res.status(201).json({ goal, savingsGoals: user.savingsGoals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/goals/:gid', async (req, res) => {
  try {
    const { name, emoji, target, saved, color } = req.body;
    const s = {};
    if (name   !== undefined) s['savingsGoals.$.name']   = name.trim();
    if (emoji  !== undefined) s['savingsGoals.$.emoji']  = emoji;
    if (target !== undefined) s['savingsGoals.$.target'] = Number(target);
    if (saved  !== undefined) s['savingsGoals.$.saved']  = Number(saved);
    if (color  !== undefined) s['savingsGoals.$.color']  = color;
    await User.updateOne(
      { _id: req.user._id, 'savingsGoals.id': req.params.gid },
      { $set: s }
    );
    const user = await User.findById(req.user._id).select('-password');
    res.json({ savingsGoals: user.savingsGoals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/goals/:gid', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { savingsGoals: { id: req.params.gid } } },
      { new: true, select: '-password' }
    );
    res.json({ savingsGoals: user.savingsGoals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════
//  BUDGETS  (stored as Mongoose Map)
// ════════════════════════════════

router.get('/budgets', (req, res) => {
  res.json({ budgets: mapToObj(req.user.budgets) });
});

router.patch('/budgets', async (req, res) => {
  try {
    const { category, amount } = req.body;
    if (!category) return res.status(400).json({ error: 'Category required' });
    await User.updateOne(
      { _id: req.user._id },
      { $set: { [`budgets.${category}`]: Number(amount) } }
    );
    const user = await User.findById(req.user._id).select('-password');
    res.json({ budgets: mapToObj(user.budgets) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/budgets/:category', async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $unset: { [`budgets.${req.params.category}`]: '' } }
    );
    const user = await User.findById(req.user._id).select('-password');
    res.json({ budgets: mapToObj(user.budgets) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
