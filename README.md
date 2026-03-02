# TicketWise 🎫

AI-powered ticket assistant for ConnectWise PSA. Helps service desk technicians work faster by summarising tickets, suggesting solutions, and finding relevant history.

## Features

- **Ticket Summaries** - Get instant, clear summaries of any ticket
- **Smart Suggestions** - AI-powered troubleshooting recommendations
- **Similar Ticket Search** - Find related issues from company history and global tickets
- **Configuration History** - See past issues with attached devices/configurations
- **Slash Commands** - Quick actions like `/summary`, `/suggest`, `/config`
- **User Permissions** - Respects ConnectWise user permissions automatically

## Slash Commands

| Command | Description |
|---------|-------------|
| `/summary` | Summarise the current ticket |
| `/suggest` | Get troubleshooting suggestions |
| `/next` | Recommend next steps |
| `/similar` | Find and analyse similar tickets |
| `/config` | Analyse attached configuration history |
| `/draft` | Draft a customer response |
| `/escalate` | Prepare escalation notes |

## Setup

### Prerequisites

- ConnectWise PSA instance (cloud or on-prem)
- ConnectWise Developer Client ID ([register here](https://developer.connectwise.com/ClientId))
- OpenRouter API key ([sign up here](https://openrouter.ai))
- Node.js 20+

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# ConnectWise PSA
CW_CLIENT_ID=your-connectwise-client-id
CW_COMPANY_URL=eu.myconnectwise.net
CW_CODE_BASE=v4_6_release

# OpenRouter (https://openrouter.ai)
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-api-key
OPENROUTER_MODEL=moonshotai/kimi-k2.5:nitro
```

### Installation

```bash
npm install
npm run dev
```

### ConnectWise Pod Configuration

1. Navigate to **System → Setup Tables → Manage Hosted API**
2. Create a new entry with **+**
3. Configure:
   - **Description:** TicketWise
   - **Screen:** Service Ticket
   - **Origin:** `*`
   - **URL:** `https://your-domain.com/?id=[cw_id]&screen=[cw_screen]`
   - **Display:** Pod
   - **Pod Height:** 300 (or your preference)
4. Save

## Deployment

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

### Coolify

1. Add new resource → Public Repository
2. Repository: `https://github.com/mrsmickers/ticketwise`
3. Build Pack: Nixpacks (auto-detected)
4. Environment variables: Add from `.env.example`
5. Domain: Configure your subdomain

## Architecture

```
src/
├── app/                 # Next.js App Router pages
├── components/          # React components
│   ├── chat.tsx        # Chat interface
│   └── pod.tsx         # Pod wrapper with auth
├── hooks/
│   └── use-hosted-api.ts   # ConnectWise iframe communication
├── lib/
│   ├── ai.ts           # OpenRouter LLM integration
│   ├── connectwise.ts  # CW API client
│   └── env.ts          # Environment validation
└── actions/            # Server actions
    ├── auth.ts         # Cookie management
    ├── chat.ts         # Chat processing
    └── ticket.ts       # Ticket data fetching
```

## Security

- **User Permissions:** All ConnectWise API calls use the logged-in user's session, automatically respecting their board and ticket permissions
- **Cookie-Based Auth:** Authentication tokens stored in HTTP-only cookies with 8-hour expiry
- **Cloudflare Access:** Recommended for additional protection (Microsoft SSO)

## License

MIT

---

Built by [Ingenio Technologies](https://ingeniotech.co.uk)
