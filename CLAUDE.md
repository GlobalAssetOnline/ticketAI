# CLAUDE.md - TicketWise

TicketWise is an AI-powered assistant for ConnectWise PSA technicians. It runs as an iframe pod inside CW service tickets, using OpenRouter for LLM inference (via the OpenRouter-compatible SDK client client). Built with Next.js 15, React 19, TypeScript, and Tailwind CSS 4.

## Quick Start

```bash
cp .env.example .env     # Fill in CW credentials and OpenRouter key
npm install
npm run dev              # http://localhost:3000
```

The app requires a ConnectWise iframe context to authenticate. Running standalone shows a "Pod Mode Only" message. For local development, you need a CW Hosted API entry pointing to your dev URL, or manually set auth cookies.

## Key Architecture

- **Client components** (`pod.tsx`, `chat.tsx`, `use-hosted-api.ts`): UI and CW postMessage handshake
- **Server actions** (`actions/auth.ts`, `actions/chat.ts`, `actions/ticket.ts`): All CW API calls, cookie management, AI calls
- **Libraries** (`lib/ai.ts`, `lib/connectwise.ts`, `lib/env.ts`, `lib/format.ts`): OpenRouter client, CW REST client, env validation, data formatting

AI calls go through OpenRouter (not legacy provider endpoints). The OpenRouter-compatible SDK client is used as the HTTP client with `baseURL: "https://openrouter.ai/api/v1"`.

## Common Tasks

### Add a new slash command
1. Add entry to `SLASH_COMMANDS` in `src/lib/ai.ts` with `description` and `prompt`
2. If the command needs extra context (like `/similar` or `/config`), add data fetching in `src/actions/chat.ts` within `processChat()`
3. The command auto-appears in the UI dropdown — no changes needed in `chat.tsx`

### Change the LLM model
Set `OPENROUTER_MODEL` env var to any model available on OpenRouter (e.g. `anthropic/claude-sonnet-4`, `openai/gpt-4o`).

### Add a new CW API endpoint
1. Add types to `src/lib/connectwise.ts`
2. Create a function using `cwGet<T>()` or `cwPost<T>()`
3. Call it from a server action in `src/actions/`

### Modify the system prompt
Edit `SYSTEM_PROMPT` in `src/lib/ai.ts`. The prompt enforces British English, Markdown formatting, and strict data-only responses.

## Deployment

- Push to `main` triggers Coolify rebuild (Nixpacks)
- URL: https://ticketwise.ingeniotech.co.uk
- Health check: `GET /api/health`
- After deploy, tell users to hard-refresh (Ctrl+Shift+R) to clear cached client JS

## Important Gotchas

- **CW postMessage protocol**: Messages must be `JSON.stringify`'d. Use `hosted_request` key, not `request`. CW silently ignores the wrong key.
- **CW auth response**: The response key is lowercase `"getmemberauthentication"` — case-insensitive comparison required.
- **Start command**: Keep `"start": "next start"` in package.json. Do NOT change to `node .next/standalone/server.js` — it breaks static file serving under Nixpacks.
- **X-Frame-Options**: Next.js 15 defaults to `SAMEORIGIN`, which blocks CW iframe embedding. Overridden in both `next.config.ts` and `middleware.ts`.
- **Cookie SameSite**: Must be `"none"` + `secure: true` for cross-site iframe cookies to work.
- **Rate limiting**: In-memory only (30 req/min/member). Does not survive restarts or work across multiple instances.
- **OpenRouter-compatible SDK client**: We use the `openai` npm package but point it at OpenRouter. This is intentional — OpenRouter is API-compatible with OpenAI.
- **Similar ticket search**: Extracts keywords from summary, filters stop words, searches CW with `like` conditions. Results sorted closed-first.
- **Report API**: Used for config ticket history (`/system/reports/Service`) because it supports querying by `config_recids` — the main tickets API doesn't.

## Testing

No automated tests currently. Manual testing requires a ConnectWise PSA instance with:
1. A Hosted API entry pointing to the app URL
2. At least one service ticket with notes
3. Valid CW API credentials in `.env`

## Environment Variables

See `.env.example` for all required variables. Key ones:
- `OPENROUTER_API_KEY` — OpenRouter key (starts with `sk-or-v1-`)
- `OPENROUTER_MODEL` — defaults to `moonshotai/kimi-k2.5:nitro`
- `CW_*` — ConnectWise API credentials
- `HOSTNAME=0.0.0.0` — required in production for Coolify container binding
