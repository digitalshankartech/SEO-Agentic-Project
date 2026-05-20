# Marketing Suite

An AI-powered marketing toolkit that turns specialized agent skills into a clean, client-ready web application. Built on the [marketingskills](https://github.com/coreyhaines31/marketingskills) repository by Corey Haines.

## Tools included

| Tool | Skill(s) Used | What it does |
|---|---|---|
| **Product Context** | `product-marketing-context` | Single source of truth for your product — powers every other tool |
| **SEO Audit** | `seo-audit`, `ai-seo` | Technical SEO + AI search optimization audit |
| **AI Copywriter** | `copywriting` | Page copy for homepage, landing, pricing, feature, and more |
| **CRO Analyzer** | `page-cro` | Conversion blockers across 7 dimensions + quick wins |
| **Email Sequences** | `email-sequence` | Welcome, nurture, re-engagement, and onboarding sequences |
| **Content Strategy** | `content-strategy` | Content pillars + 12-week editorial calendar |
| **Competitor Analysis** | `competitor-alternatives` | Competitive positioning, comparison page strategy, objection handling |

## Requirements

- [Node.js](https://nodejs.org/) 18 or later
- An [Anthropic API key](https://console.anthropic.com/)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env

# 3. Add your Anthropic API key to .env
#    ANTHROPIC_API_KEY=sk-ant-...

# 4. Start the development server
npm run dev
```

Then open **http://localhost:5173** in your browser.

## How it works

1. **Set up Product Context** — fill in your product name, audience, pain points, and customer language once. All other tools use this to personalize their output.
2. **Run any tool** — each tool calls your Express server (`/api/chat`), which uses the Anthropic SDK to stream responses back to the UI in real time.
3. **Copy the output** — every result panel has a one-click copy button.

## Architecture

```
├── server.js              Express API server (proxies Claude API, handles SSE streaming)
├── src/
│   ├── App.jsx            React Router setup
│   ├── lib/
│   │   ├── api.js         SSE streaming client
│   │   └── storage.js     localStorage for product context
│   ├── skills/
│   │   └── prompts.js     System prompts for each tool (derived from marketingskills)
│   ├── components/
│   │   ├── Layout.jsx
│   │   ├── Sidebar.jsx
│   │   ├── ToolHeader.jsx
│   │   ├── StreamOutput.jsx   Markdown renderer for streaming output
│   │   └── OutputCard.jsx
│   └── pages/             One file per tool
```

## Production deployment

```bash
npm run build   # Builds React app to /dist
npm start       # Runs Express server serving /dist + API
```

Set `PORT` in `.env` to change the server port (default: 3001).

## Customizing prompts

All AI instructions live in [src/skills/prompts.js](src/skills/prompts.js). Each tool has a dedicated system prompt derived from the corresponding skill in the marketingskills repository. Edit them to match your client's specific needs.
