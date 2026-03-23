# TicketWise - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│  ConnectWise PSA (Browser)                          │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Service Ticket View                        │    │
│  │                                             │    │
│  │  ┌───────────────────────────────────────┐  │    │
│  │  │  TicketWise Pod (iframe)              │  │    │
│  │  │  https://your-domain.com              │  │    │
│  │  └───────────────┬───────────────────────┘  │    │
│  └──────────────────┼──────────────────────────┘    │
│                     │ postMessage                    │
└─────────────────────┼───────────────────────────────┘
                      │
         ┌────────────▼────────────┐
         │  Next.js App            │
         │  Server Actions         │
         │                         │
         │  ┌───────┐ ┌─────────┐  │
         │  │ Auth  │ │  Chat   │  │
         │  └───┬───┘ └────┬────┘  │
         │      │          │       │
         └──────┼──────────┼───────┘
                │          │
        ┌───────▼──┐  ┌────▼──────┐
        │ CW API   │  │ OpenRouter│
        │ (REST)   │  │ (LLM)    │
        └──────────┘  └──────────┘
```

## Data Flow

### Authentication Flow

```
1. Page loads → Pod component mounts
2. useHostedApi hook sends: { message: "ready" } to parent (targetOrigin: "*")
3. CW parent responds with: { MessageFrameID: "..." }
4. App stores frameID, marks ready
5. App sends: { hosted_request: "getMemberAuthentication", frameID: "..." }
6. CW responds with: { response: "getmemberauthentication", data: MemberAuth }
7. App validates with Zod, stores in HTTP-only cookies (8hr expiry)
8. All subsequent CW API calls include x-cw-memberhash header
```

Key protocol details:
- CW sends/expects JSON **strings** (must `JSON.parse`/`JSON.stringify`)
- Outgoing requests use `hosted_request` key, not `request` (CW silently ignores `request`)
- Auth response key is lowercase: `"getmemberauthentication"`
- Origin validation against allowed CW domains only

### Chat / Slash Command Flow

```
User types message
    │
    ▼
Chat component (client)
    │ processChat() server action
    ▼
Rate limit check (30/min per member)
    │
    ▼
Detect slash command (if starts with /)
    │
    ▼
Fetch ticket context (parallel):
  ├── getTicket(id)
  ├── getTicketNotes(id)
  └── getTicketConfigurations(id)
    │
    ▼
Format ticket as markdown for AI
    │
    ▼
If /similar: searchSimilarTickets()
  ├── Company tickets (90-day window)
  ├── Global tickets (14-day window, if <3 company results)
  └── Fetch notes for closed matches (to find actual resolution)
    │
If /config: getConfigurationTickets()
  └── Report API query by config_recids
    │
    ▼
Build LLM chat messages:
  [system prompt, ticket context, conversation history, slash command prompt]
    │
    ▼
OpenRouter API call (via OpenAI-compatible SDK)
  model: OPENROUTER_MODEL (default: moonshotai/kimi-k2.5:nitro)
  temperature: 0.3
  max_completion_tokens: 4096
    │
    ▼
Return response to client → render as Markdown
```

## Key Files

```
src/
├── app/
│   ├── page.tsx                # Entry point — renders Pod with URL params
│   ├── layout.tsx              # Root layout (Manrope font, metadata)
│   └── api/health/route.ts     # GET /api/health → { status: "healthy" }
│
├── components/
│   ├── pod.tsx                 # Pod wrapper — auth flow, loading/error states
│   └── chat.tsx                # Chat UI — messages, input, slash command dropdown, copy
│
├── hooks/
│   └── use-hosted-api.ts       # CW postMessage handshake, origin validation
│
├── lib/
│   ├── env.ts                  # Zod env validation (CW creds, OpenRouter, Node)
│   ├── ai.ts                   # OpenRouter client, system prompt, slash commands
│   ├── connectwise.ts          # CW REST API client, types, search functions
│   └── format.ts               # Ticket/note/config → markdown for AI context
│
├── actions/
│   ├── auth.ts                 # setAuthCookies, clearAuthCookies, checkAuth
│   ├── chat.ts                 # processChat (rate limit, context, AI call)
│   └── ticket.ts               # getTicketContext, findSimilar*, getConfigHistory
│
└── middleware.ts               # Security headers (CSP, X-Frame-Options removal)
```

### Server vs Client Boundary

| File | Side | Why |
|------|------|-----|
| `pod.tsx`, `chat.tsx` | Client (`"use client"`) | Interactive UI, postMessage, DOM |
| `use-hosted-api.ts` | Client | Browser postMessage API |
| `auth.ts`, `chat.ts`, `ticket.ts` | Server (`"use server"`) | Cookies, API keys, CW credentials |
| `ai.ts`, `connectwise.ts`, `env.ts`, `format.ts` | Server (imported by actions) | Secrets, external APIs |

## ConnectWise API Integration

### Authentication Method

Basic Auth with member impersonation:

```
Authorization: Basic base64(companyId+publicKey:privateKey)
clientId: CW_CLIENT_ID
x-cw-usertype: member
x-cw-memberhash: <memberId from cookies>
```

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /service/tickets/{id}` | Fetch ticket details |
| `GET /service/tickets/{id}/allNotes` | All notes (description, internal, resolution) |
| `GET /service/tickets/{id}/configurations` | Attached configurations |
| `GET /service/tickets?conditions=...` | Search similar tickets |
| `GET /company/configurations/{id}` | Configuration details |
| `GET /system/reports/Service` | Query tickets by config_recids (Report API) |

### Similar Ticket Search

Keywords are extracted from the ticket summary (stop words filtered), then searched via CW conditions:
```
dateEntered>=[date] and company/id=X and (summary like "%keyword1%" or summary like "%keyword2%")
```

Results are sorted to prioritise closed/resolved tickets (they have solutions).

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `CW_CLIENT_ID` | Yes | — | ConnectWise Developer Client ID |
| `CW_COMPANY_ID` | Yes | — | Company ID for API auth |
| `CW_COMPANY_URL` | Yes | — | CW cloud instance (e.g. `eu.myconnectwise.net`) |
| `CW_CODE_BASE` | No | `v4_6_release` | CW API version path |
| `CW_PUBLIC_KEY` | Yes | — | API public key |
| `CW_PRIVATE_KEY` | Yes | — | API private key |
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key (`sk-or-v1-...`) |
| `OPENROUTER_MODEL` | No | `moonshotai/kimi-k2.5:nitro` | LLM model identifier |
| `NODE_ENV` | No | `development` | Environment mode |
| `HOSTNAME` | Yes (prod) | — | Must be `0.0.0.0` for container binding |
