const router = require('express').Router();
const User = require('../models/User');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

router.post('/mentor', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Fetch user data
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const journals = user.journals || [];
    const transactions = user.transactions || [];
    const tasks = user.tasks || [];
    const goals = user.savingsGoals || [];
    const budgets = mapToObj(user.budgets);

    // Prepare a summary of data to avoid sending massive payloads
    const recentJournals = journals.slice(0, 10).map(j => ({ date: j.date, title: j.title, mood: j.mood, tags: j.tags }));
    const recentTransactions = transactions.slice(0, 50).map(t => ({ date: t.date, name: t.name, cat: t.cat, type: t.type, amt: t.amt }));
    const currentTasks = tasks.map(t => ({ name: t.name, cat: t.cat }));
    
    // Construct prompt
    const prompt = `
      You are an expert AI Life and Financial Coach, acting as a "Growth Mentor" for the user.
      Analyze the following data about the user's recent journals, finances, and tasks, and provide actionable, personalized insights.
      
      User Data:
      - Recent Journals (up to 10): ${JSON.stringify(recentJournals)}
      - Recent Transactions (up to 50): ${JSON.stringify(recentTransactions)}
      - Tasks: ${JSON.stringify(currentTasks)}
      - Savings Goals: ${JSON.stringify(goals)}
      - Monthly Budgets: ${JSON.stringify(budgets)}

      Your response MUST be formatted strictly as a JSON object with the following schema:
      {
        "financial_insights": [ "insight 1", "insight 2" ],
        "productivity_insights": [ "insight 1", "insight 2" ],
        "emotional_wellbeing": [ "insight 1", "insight 2" ],
        "overall_advice": "A short, encouraging paragraph summarizing the key takeaway for the user."
      }
      
      Do not include any markdown formatting like \`\`\`json. Return only the raw JSON string. Keep insights concise, actionable, and encouraging.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Attempt to parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
      console.error('Failed to parse AI response:', text);
      return res.status(500).json({ error: 'Failed to generate valid insights. Please try again.' });
    }

    res.json({ insights: parsedResponse });
  } catch (err) {
    console.error('AI Mentor Error:', err);
    res.status(500).json({ error: err.message || 'An error occurred while generating insights.' });
  }
});

module.exports = router;
