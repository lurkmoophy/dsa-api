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

// Serve static YAML file at /openapi.yaml
app.get('/openapi.yaml', (req, res) => {
  res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

const app = express();
app.use(cors());
app.use(express.json());

const adapter = new JSONFile('db.json');
const db = new Low(adapter, {
  sessions: {},
  questions: {}
});
await db.read();
db.data ||= {};
db.data.sessions ||= {};
db.data.questions ||= {};

// Load question bank
const questionData = JSON.parse(fs.readFileSync('./questions.json', 'utf8'));
db.data.questions = questionData;

// Categories that need general info
const categoriesRequiringGeneral = new Set([
  "best-documentation",
  "best-accessibility",
  "best-governance",
  "best-collaboration",
  "best-adoption",
  "award-for-innovation"
]);

// Endpoint: Create a new session
app.post('/session', (req, res) => {
  const sessionId = nanoid();
  db.data.sessions[sessionId] = { general: {} };
  res.json({ sessionId });
});

// Endpoint: Get all categories
app.get('/categories', (req, res) => {
  res.json(Object.keys(db.data.questions));
});

// Endpoint: Get questions for a category
app.get('/questions/:category', (req, res) => {
  const { category } = req.params;
  const questions = db.data.questions[category];
  if (!questions) return res.status(404).send('Category not found');
  res.json({ category, questions });
});

// Endpoint: Save an answer
app.post('/answers', async (req, res) => {
  const { sessionId, category, question, answer, isGeneral } = req.body;
  if (!db.data.sessions[sessionId]) db.data.sessions[sessionId] = { general: {} };

  if (isGeneral) {
    db.data.sessions[sessionId].general[question] = answer;
  } else {
    if (!db.data.sessions[sessionId][category]) {
      db.data.sessions[sessionId][category] = {};
    }
    db.data.sessions[sessionId][category][question] = answer;
  }

  await db.write();
  res.sendStatus(200);
});

// Endpoint: Get answers for a category
app.get('/answers/:sessionId/:category', (req, res) => {
  const { sessionId, category } = req.params;
  const session = db.data.sessions[sessionId];
  if (!session) return res.status(404).send('Session not found');

  const general = session.general || {};
  const answers = session[category] || {};
  res.json({ category, general, answers });
});

// Endpoint: Generate final entry payload
app.post('/generate', (req, res) => {
  const { sessionId, category } = req.body;
  const session = db.data.sessions[sessionId];
  if (!session || !session[category]) {
    return res.status(404).send('No answers found for that category.');
  }

  res.json({
    sessionId,
    category,
    general: session.general || {},
    answers: session[category],
    questions: db.data.questions[category]
  });
});

// Endpoint: Return general questions
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

// Endpoint: Does this category require general info?
app.get('/needs-general/:category', (req, res) => {
  const { category } = req.params;
  const needsGeneral = categoriesRequiringGeneral.has(category);
  res.json({ category, needsGeneral });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ DSA API running on port ${PORT}`);
});