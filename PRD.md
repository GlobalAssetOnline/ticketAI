# TicketWise - Product Requirements Document

## Overview

TicketWise is an AI-powered assistant for ConnectWise PSA (Professional Services Automation) that helps IT service desk technicians work faster. It runs as a **CW Hosted Tab pod** — an iframe embedded directly into service ticket views — giving technicians instant access to AI-driven ticket analysis without leaving their workflow.

## Problem Statement

IT service desk technicians spend significant time reading through ticket notes, searching for similar past issues, and composing responses. Ticket notes are often long, unstructured, and buried across multiple entries. Finding what was actually done to resolve a past issue requires reading through entire ticket histories.

## Target Users

**Primary:** IT service desk technicians (L1/L2 support) using ConnectWise PSA daily.

**Environment:** The app is accessed exclusively through the ConnectWise PSA interface — it cannot be used standalone. Technicians interact with it while viewing a service ticket.

## How It Works

1. Technician opens a service ticket in ConnectWise PSA
2. TicketWise pod loads automatically in the ticket view (iframe)
3. ConnectWise authenticates the user via postMessage handshake
4. Technician uses slash commands or free-text chat to query the AI
5. AI responds using the ticket's data (notes, configurations, similar tickets)

## Features

### Slash Commands

| Command | Description |
|---------|-------------|
| `/summary` | Summarise the current ticket — extracts issue, resolution (for closed), or current status (for open) |
| `/suggest` | AI-powered troubleshooting suggestions, prioritising quick wins |
| `/next` | Recommend next steps — what to do, who to contact, whether to escalate |
| `/similar` | Search for similar past tickets (same company first, then global). Shows what worked before |
| `/config` | Analyse the ticket history for attached configurations/devices |
| `/draft` | Draft a professional customer response |
| `/escalate` | Prepare structured escalation notes for handoff |
| `/5whys` | Root cause analysis using the 5 Whys methodology |
| `/refresh` | Clear chat history (client-side only) |

### Chat Interface

- Free-text questions about the current ticket
- Markdown-rendered AI responses
- **Copy to clipboard** button on every AI response (copies as rich text for Outlook/Teams)
- Conversation history maintained per session
- Auto-complete dropdown when typing `/`

### Permissions

All ConnectWise API calls use the logged-in technician's permissions via member impersonation (`x-cw-memberhash` header). If a technician can't see a ticket in CW, they can't see it through TicketWise either.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript (strict) |
| LLM | OpenRouter API (using OpenRouter-compatible SDK client) |
| Default Model | `moonshotai/kimi-k2.5:nitro` via OpenRouter |
| Validation | Zod |
| Markdown | react-markdown |
| Hosting | Coolify (Nixpacks) |
| CDN/Security | Cloudflare (TLS, HSTS) |

## Non-Functional Requirements

### Security
- Origin-validated postMessage communication (CW domains only)
- HTTP-only, Secure, SameSite=None cookies (required for cross-site iframe)
- CSP `frame-ancestors *` to allow CW iframe embedding
- No standalone access — shows "Pod Mode Only" outside CW
- All CW API calls respect user permissions via member impersonation

### Rate Limiting
- 30 requests per minute per authenticated member
- In-memory rate limiter (single instance; Redis recommended for scale)

### Performance
- AI responses via non-streaming completion (streaming implemented but not currently used in chat action)
- Ticket context fetched in parallel (ticket + notes + configs via `Promise.all`)
- Similar ticket search limited to 90-day window for company, 14-day for global

### Deployment
- Automatic builds on push to `main` via Coolify
- Nixpacks auto-detects Node.js, builds with `next build`, starts with `next start`
- Health check endpoint at `/api/health`

## Out of Scope (Current Version)

- Multi-tenant support (single CW instance)
- Persistent chat history across sessions
- Ticket modification (read-only — no writing back to CW)
- File/attachment analysis
- Real-time ticket update notifications
