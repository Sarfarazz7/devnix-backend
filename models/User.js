// backend/models/User.js
const mongoose = require('mongoose');

// ── Sub-schemas ────────────────────────────────────────────

const TaskSchema = new mongoose.Schema({
  id:   { type: String, required: true },
  name: { type: String, required: true, trim: true },
  cat:  { type: String, default: 'other' }
}, { _id: false });

const TransactionSchema = new mongoose.Schema({
  id:     { type: String, required: true },
  date:   { type: String, required: true },      // YYYY-MM-DD
  name:   { type: String, required: true, trim: true },
  cat:    { type: String, required: true },
  type:   { type: String, enum: ['income', 'expense'], required: true },
  amt:    { type: Number, required: true },
  status: { type: String, enum: ['cleared', 'pending'], default: 'cleared' }
}, { _id: false });

const JournalSchema = new mongoose.Schema({
  id:        { type: String, required: true },
  title:     { type: String, default: 'Untitled', trim: true },
  body:      { type: String, default: '' },
  mood:      { type: String, default: null },
  tags:      [{ type: String }],
  date:      { type: String, required: true },   // YYYY-MM-DD
  createdAt: { type: String },
  updatedAt: { type: String, default: null }
}, { _id: false });

const SavingsGoalSchema = new mongoose.Schema({
  id:     { type: String, required: true },
  name:   { type: String, required: true, trim: true },
  emoji:  { type: String, default: '🎯' },
  target: { type: Number, required: true },
  saved:  { type: Number, default: 0 },
  color:  { type: String, default: '#3b82f6' }
}, { _id: false });

// ── Main User schema ───────────────────────────────────────

const UserSchema = new mongoose.Schema({
  email: {
    type:     String,
    required: true,
    unique:   true,
    lowercase: true,
    trim:     true,
    index:    true
  },
  password: {
    type:     String,
    required: true,
    minlength: 6
  },
  dark: {
    type:    Boolean,
    default: false
  },

  // Discipline tracker
  tasks:   { type: [TaskSchema], default: [] },
  done:    { type: Map, of: Boolean, default: {} },   // "taskId_YYYY-MM-DD" → true
  skipped: { type: Map, of: Boolean, default: {} },
  notes:   { type: Map, of: String, default: {} },

  // Finance
  transactions:  { type: [TransactionSchema], default: [] },
  savingsGoals:  { type: [SavingsGoalSchema], default: [] },
  budgets:       { type: Map, of: Number, default: {} },  // category → monthly budget

  // Journal
  journals: { type: [JournalSchema], default: [] }

}, {
  timestamps: true   // adds createdAt / updatedAt to the document
});

// Strip password from any JSON response
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
