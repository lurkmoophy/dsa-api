import express from 'express';
import cors from 'cors';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Set up LowDB with default structure
const dbFile = path.join(__dirname, 'db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, {
  users: {},
  questions: {},
});

await db.read();
await db.write(); // ensure db.json exists

// Load questions.json
const questionsPath = path.join(__dirname, 'questions.json');
if (fs.existsSync(questionsPath)) {
  const questionData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  db.data.questions = questionData;
  await db.write();
}

// Categories that use general questions
const categoriesRequiringGeneral = new Set([
  "best-documentation",
  "best-accessibility",
  "best-governance",
  "best-collaboration",
  "best-adoption",
  "award-for-innovation"
]);

// Routes

app.get('/categories', (req, res) => {
  const categories = Object.keys(db.data.questions);
  res.json(categories);
});

app.get('/questions/:category', (req, res) => {
  const { category } = req.params;
  const questions = db.data.questions[category];
  if (!questions) return res.status(404).send('Category not found');
  res.json({ category, questions });
});

app.post('/answers', async (req, res) => {
  const { userId, category, question, answer, isGeneral } = req.body;

  if (!db.data.users[userId]) db.data.users[userId] = {};

  if (isGeneral) {
    db.data.users[userId].general ||= {};
    db.data.users[userId].general[question] = answer;
  } else {
    db.data.users[userId][category] ||= {};
    db.data.users[userId][category][question] = answer;
  }

  await db.write();
  res.sendStatus(200);
});

app.get('/answers/:userId/:category', (req, res) => {
  const { userId, category } = req.params;
  const general = db.data.users[userId]?.general || {};
  const answers = db.data.users[userId]?.[category] || {};
  res.json({ category, general, answers });
});

app.post('/generate', async (req, res) => {
  const { userId, category } = req.body;
  const general = db.data.users[userId]?.general || {};
  const answers = db.data.users[userId]?.[category] || {};

  if (!Object.keys(answers).length) {
    return res.status(404).send('No answers found for that category.');
  }

  res.json({
    userId,
    category,
    questions: db.data.questions[category],
    general,
    answers
  });
});

app.get('/general-questions', (req, res) => {
  res.json({
    questions: [
      "What’s the name of your organization?",
      "What’s the name of your design system?",
      "How big is your overall product organization (designers, developers, etc.)?",
      "How long has your design system existed?"
    ]
  });
});

app.get('/needs-general/:category', (req, res) => {
  const { category } = req.params;
  const needsGeneral = categoriesRequiringGeneral.has(category);
  res.json({ category, needsGeneral });
});

app.listen(3000, () => console.log('DSA API running on http://localhost:3000'));
