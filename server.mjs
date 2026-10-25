/* ============================================================
   AI Interview Prep — Backend Server
   Serves the website and connects the AI features to the Claude API.
   The API key stays here on the server (read from .env) and is
   never sent to the browser.
   Run:  npm install   then   npm start   → http://localhost:3000
   ============================================================ */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(ROOT, ".env")); } catch { /* no .env file - AI stays off */ }

const PORT = Number(process.env.PORT) || 3000;
const MODEL = "claude-haiku-5-5";
const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY);
const client = HAS_KEY ? new Anthropic() : null;

/* ---------------------------------------------------------
   Claude helpers
--------------------------------------------------------- */
class AIError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

// One request to Claude. With a schema, the reply is forced into that JSON shape.
async function ask({ system, messages, schema, maxTokens = 4000, effort = "low" }) {
  if (!client) throw new AIError("AI is not configured. Add ANTHROPIC_API_KEY to the .env file.", 503);
  const output_config = { effort };
  if (schema) output_config.format = { type: "json_schema", schema };

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
      output_config,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new AIError("The API key in .env is invalid.", 503);
    if (err instanceof Anthropic.PermissionDeniedError) throw new AIError("This API key does not have access to the model.", 503);
    if (err instanceof Anthropic.RateLimitError) throw new AIError("AI is busy right now. Please try again in a moment.", 429);
    if (err instanceof Anthropic.BadRequestError) throw new AIError("The AI request was rejected: " + err.message, 400);
    if (err instanceof Anthropic.APIError) throw new AIError(`AI service error (${err.status}).`, 502);
    throw new AIError("Could not reach the AI service. Check your internet connection.", 502);
  }

  if (response.stop_reason === "refusal") throw new AIError("The AI could not answer this request. Please rephrase it.", 422);
  if (response.stop_reason === "max_tokens") throw new AIError("The AI response was too long. Please try again.", 502);

  const text = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
  if (!schema) return text;
  try { return JSON.parse(text); }
  catch { throw new AIError("The AI returned an unexpected format. Please try again.", 502); }
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const COACH_STYLE = "You are the AI interview coach inside 'AI Interview Prep', a practice website used mostly by Indian college students and freshers preparing for campus placements, internships and first jobs. Be encouraging but honest, practical and specific. Use simple, clear English.";

/* ---------------------------------------------------------
   Feature endpoints
--------------------------------------------------------- */

// 1 + 2. Real answer evaluation, plus an AI follow-up question
const EVAL_SCHEMA = {
  type: "object",
  properties: {
    communication: { type: "integer", description: "0-100: clarity, structure and flow" },
    relevance: { type: "integer", description: "0-100: how directly it answers the question asked" },
    confidence: { type: "integer", description: "0-100: assertive, specific wording vs. hesitant or vague" },
    technical: { type: "integer", description: "0-100: depth of domain/technical knowledge shown (for non-technical questions: depth of knowledge about the role and work)" },
    grammar: { type: "integer", description: "0-100: grammar and language quality" },
    good: { type: "array", items: { type: "string" }, description: "Exactly 3 specific things the answer did well" },
    improve: { type: "array", items: { type: "string" }, description: "Exactly 3 specific, actionable improvements" },
    suggestion: { type: "string", description: "One concrete tip to make this answer stronger, 1-2 sentences" },
    followUp: { type: "string", description: "One natural follow-up question an interviewer would ask next, based on what the candidate actually said" },
  },
  required: ["communication", "relevance", "confidence", "technical", "grammar", "good", "improve", "suggestion", "followUp"],
  additionalProperties: false,
};

async function evaluate(body) {
  const question = str(body.question, 600), answer = str(body.answer, 6000);
  if (!question) throw new AIError("Question is missing.", 400);
  const ctx = `Interview type: ${str(body.type, 40) || "General"}\nDifficulty: ${str(body.difficulty, 30) || "Intermediate"}\nExperience: ${str(body.experience, 30) || "Fresher"}\nJob role: ${str(body.role, 80) || "Not specified"}\nTarget company: ${str(body.company, 80) || "Not specified"}`;
  const result = await ask({
    system: `${COACH_STYLE} You evaluate one interview answer like an experienced interviewer would. Score strictly and realistically: a vague or very short answer should score low, a structured answer with specific examples and results should score high. If the answer is empty, unrelated or nonsense, give low scores and say so. Write feedback that refers to what the candidate actually said.`,
    messages: [{ role: "user", content: `${ctx}\n\nQuestion: ${question}\n\nCandidate's answer:\n${answer || "(The candidate skipped this question and gave no answer.)"}` }],
    schema: EVAL_SCHEMA,
    maxTokens: 3000,
  });
  const clamp = n => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const scores = {
    communication: clamp(result.communication), relevance: clamp(result.relevance),
    confidence: clamp(result.confidence), technical: clamp(result.technical), grammar: clamp(result.grammar),
  };
  scores.overall = Math.round((scores.communication + scores.relevance + scores.confidence + scores.technical + scores.grammar) / 5);
  return {
    scores,
    good: (result.good || []).slice(0, 3),
    improve: (result.improve || []).slice(0, 3),
    suggestion: result.suggestion || "",
    followUp: result.followUp || "",
  };
}

// 5. Model answer — rewrite the candidate's answer into a stronger version
const MODEL_ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string", description: "The improved answer, written in first person, 120-200 words" },
    changes: { type: "array", items: { type: "string" }, description: "3 short notes on what was improved and why" },
  },
  required: ["answer", "changes"],
  additionalProperties: false,
};

async function modelAnswer(body) {
  const question = str(body.question, 600), answer = str(body.answer, 6000);
  if (!question) throw new AIError("Question is missing.", 400);
  return ask({
    system: `${COACH_STYLE} Rewrite the candidate's interview answer into a stronger model answer. Keep the candidate's own facts, experiences and projects - do not invent achievements, numbers or companies they did not mention; where a detail would help, use a clearly generic placeholder like [your project]. Use the STAR structure for behavioral questions. If they gave no answer, write a sample answer a fresher could adapt, using placeholders.`,
    messages: [{ role: "user", content: `Job role: ${str(body.role, 80) || "Not specified"}\nInterview type: ${str(body.type, 40) || "General"}\n\nQuestion: ${question}\n\nCandidate's answer:\n${answer || "(no answer given)"}` }],
    schema: MODEL_ANSWER_SCHEMA,
  });
}

// 6. Company- and role-specific interview questions (also used by the Question Generator)
const QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, category: { type: "string", description: "Short label, e.g. HR, Technical, Behavioral, Role-Specific, or a skill name" } },
        required: ["text", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

async function interviewQuestions(body) {
  const count = Math.max(1, Math.min(10, Number(body.count) || 5));
  const company = str(body.company, 80);
  const skills = Array.isArray(body.skills) ? body.skills.map(s => str(s, 40)).filter(Boolean).slice(0, 10) : [];
  const result = await ask({
    system: `${COACH_STYLE} You write realistic interview questions. Questions must be answerable verbally in 1-3 minutes (no long coding tasks). Vary them - do not repeat the same idea. If a target company is given, reflect what is publicly known about how that company or that kind of company interviews (its values, typical rounds, business), without claiming to know its confidential question bank.`,
    messages: [{ role: "user", content: `Write exactly ${count} interview questions.\nInterview type: ${str(body.type, 40) || "General"}\nDifficulty: ${str(body.difficulty, 30) || "Intermediate"}\nExperience: ${str(body.experience, 30) || "Fresher"}\nJob role: ${str(body.role, 80) || "Not specified"}\nTarget company / industry: ${company || "Not specified"}${skills.length ? `\nSkills to cover: ${skills.join(", ")}` : ""}` }],
    schema: QUESTIONS_SCHEMA,
  });
  const questions = (result.questions || []).filter(q => q && q.text).slice(0, count);
  if (!questions.length) throw new AIError("No questions were generated. Please try again.", 502);
  return { questions };
}

// 4. Resume-based questions (PDF or text)
const RESUME_SCHEMA = {
  type: "object",
  properties: {
    skills: { type: "array", items: { type: "string" }, description: "Up to 8 key skills found in the resume" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, skill: { type: "string", description: "The skill, project or experience this question is about" } },
        required: ["text", "skill"],
        additionalProperties: false,
      },
      description: "8 interview questions that refer to specific projects, internships and skills in this resume",
    },
  },
  required: ["skills", "questions"],
  additionalProperties: false,
};

async function resumeQuestions(body) {
  const content = [];
  const pdf = typeof body.pdfBase64 === "string" ? body.pdfBase64.replace(/\s/g, "") : "";
  const text = str(body.text, 40000);
  if (pdf) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } });
  else if (text) content.push({ type: "text", text: `Resume:\n${text}` });
  else throw new AIError("Please upload a PDF or .txt resume.", 400);
  content.push({ type: "text", text: `Read this resume and write 8 personalized interview questions about the candidate's actual projects, internships, skills and achievements - mention them by name. Mix technical and behavioral questions.${str(body.role, 80) ? ` Target role: ${str(body.role, 80)}.` : ""} If the document is not a resume, return empty arrays.` });
  const result = await ask({
    system: `${COACH_STYLE} You prepare candidates for interviews based on their own resume.`,
    messages: [{ role: "user", content }],
    schema: RESUME_SCHEMA,
  });
  return { skills: (result.skills || []).slice(0, 8), questions: (result.questions || []).slice(0, 8) };
}

// 3. Chat coach — real conversation that knows the user's progress
async function chat(body) {
  const history = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  const messages = history
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") throw new AIError("Please type a message.", 400);

  const s = body.stats || {};
  const progress = `Interviews completed: ${Number(s.interviews) || 0}. Questions answered: ${Number(s.questionsAnswered) || 0}. Average score: ${Number(s.avgScore) || 0}/100.${s.lastScores ? ` Latest skill scores - ${str(JSON.stringify(s.lastScores), 300)}.` : ""}${s.weakest ? ` Weakest skill: ${str(s.weakest, 40)}.` : ""}`;
  const reply = await ask({
    system: `You are the AI assistant inside 'AI Interview Prep', a website used mostly by Indian college students and freshers. You are a helpful, friendly general-purpose chatbot: answer any question the user asks - studies, coding, maths, science, general knowledge, writing, careers, everyday advice or anything else - accurately and clearly, in simple English (reply in Hindi or Hinglish if the user writes that way). You are also an expert interview coach, so for interview, resume and job questions give especially practical, specific advice, and when it helps mention the site's features: Mock Interview (timed AI interview with scores), Question Bank, Practice From My Resume, AI Question Generator, Performance dashboard and Resources. The chat window is small: keep replies concise (usually under 200 words) unless the user asks for detail or the question needs it. Use plain text with line breaks and short numbered or dashed lists - no markdown headings, tables or ** bold markers; put code in plain indented lines. If you don't know something or it may be out of date, say so instead of guessing.

This user's progress on the site (use it only when relevant): ${progress}`,
    messages,
    maxTokens: 4000,
  });
  return { reply };
}

const ROUTES = {
  "/api/evaluate": evaluate,
  "/api/model-answer": modelAnswer,
  "/api/questions": interviewQuestions,
  "/api/resume": resumeQuestions,
  "/api/chat": chat,
};

/* ---------------------------------------------------------
   HTTP server
--------------------------------------------------------- */
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const PUBLIC = new Set(["index.html"]);
const PUBLIC_DIRS = ["css", "js", "assets"];
const MAX_BODY = 12 * 1024 * 1024; // PDFs are sent as base64

// Simple per-IP limit so one visitor can't run up the API bill
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), windowMs = 60_000, limit = 30;
  const list = (hits.get(ip) || []).filter(t => now - t < windowMs);
  list.push(now); hits.set(ip, list);
  return list.length > limit;
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > MAX_BODY) { reject(new AIError("File is too large (max 8 MB).", 413)); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(new AIError("Invalid request.", 400)); } });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400); return res.end(); }
  if (urlPath === "/") urlPath = "/index.html";
  const rel = path.normalize(urlPath).replace(/^[/\\]+/, "");
  const top = rel.split(/[/\\]/)[0];
  const allowed = PUBLIC.has(rel) || (PUBLIC_DIRS.includes(top) && rel.length > top.length);
  const file = path.join(ROOT, rel);
  if (!allowed || !file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end("Not found"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/health") return send(res, 200, { ok: true, ai: HAS_KEY, model: HAS_KEY ? MODEL : null });

  const handler = ROUTES[url.pathname];
  if (handler) {
    if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
    if (rateLimited(req.socket.remoteAddress || "?")) return send(res, 429, { error: "Too many requests. Please wait a minute." });
    try {
      const body = await readJson(req);
      return send(res, 200, await handler(body));
    } catch (err) {
      const status = err instanceof AIError ? err.status : 500;
      if (!(err instanceof AIError)) console.error(err);
      return send(res, status, { error: err instanceof AIError ? err.message : "Server error." });
    }
  }
  if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
  send(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`\n  AI Interview Prep running at  http://localhost:${PORT}`);
  console.log(HAS_KEY ? `  AI features: ON (${MODEL})\n` : "  AI features: OFF - add ANTHROPIC_API_KEY to the .env file and restart (demo mode is used meanwhile)\n");
});
