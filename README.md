# AI Interview Prep

AI-Based Interview Preparation System. Practice mock interviews and get AI feedback.

## Run with live AI

1. Install [Node.js](https://nodejs.org) (version 20.12 or newer).
2. Copy `.env.example` to `.env` and paste your Claude API key after `ANTHROPIC_API_KEY=`.
3. In this folder run:
   ```
   npm install
   npm start
   ```
4. Open http://localhost:3000. The navbar badge shows **AI Live**.

Without a key (or when opened with VS Code Live Server), the site still works in **Demo Mode** using the built-in scoring.

## AI features
- Real answer evaluation (5 skill scores + specific feedback)
- AI follow-up questions based on your answer
- AI chat coach that knows your progress
- Resume questions from your PDF or .txt resume
- "Show Me a Better Answer" model answers
- Company-specific mock interviews (Target Company field)

The API key stays in `.env` on the server and is never sent to the browser. Do not upload `.env` anywhere.
