# TicketWise Deployment Notes

## Hosting
- **Platform:** Business Coolify (ingcoolify, 100.99.183.58)
- **App UUID:** `qssc0wkcc0gkkkog0c84w0wo`
- **URL:** https://ticketwise.ingeniotech.co.uk
- **Routing:** Direct port mapping → Cloudflare Tunnel (NO Traefik)
- **Port:** 3000 (host) → 3000 (container)
- **Build:** Nixpacks (auto-detect)
- **Branch:** `main`
- **Repo:** `mrsmickers/ticketwise`

## Environment Variables
- `HOSTNAME=0.0.0.0` — required so Next.js binds to all interfaces (not just container hostname)
- `NIXPACKS_NODE_VERSION` — pinned Node version
- CW credentials: `CW_CLIENT_ID`, `CW_COMPANY_URL`, `CW_CODE_BASE`, `CW_COMPANY_ID`, `CW_PUBLIC_KEY`, `CW_PRIVATE_KEY`
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`

## ⚠️ Critical: Do NOT change the start command

**Keep `"start": "next start"` in package.json.**

Even though Next.js warns that `next start` doesn't work with `output: "standalone"`, it DOES work under Nixpacks because Nixpacks handles static file serving.

Changing to `node .next/standalone/server.js` **breaks the app** because:
- The standalone server doesn't serve `.next/static/` files
- Nixpacks doesn't copy static files into the standalone directory
- All JS/CSS assets return 404, making the app non-functional

The warning is cosmetic. Leave it alone.

## ConnectWise Pod Integration
- App runs inside a CW iframe (pod) on service tickets
- Auth via `postMessage` handshake — CW sends `MessageFrameID`, then app requests `getMemberAuthentication`
- Standalone detection shows "Pod Mode Only" when accessed outside CW
- If users see "Connecting to ConnectWise..." stuck, first try: **hard refresh (Ctrl+Shift+R)**
- Stale deployments cause "Failed to find Server Action" errors — the cached client JS references old build hashes

## ConnectWise Hosted API Protocol
- CW's official library: `ConnectWiseHostedAPI.1.0.js` (source: github.com/pv-ajay-thota/cw-manage-hosted-api)
- All outgoing postMessages MUST be `JSON.stringify`'d (CW sends strings, expects strings)
- Auth/screen requests use `hosted_request` key, NOT `request` (CW's lib renames it in `post()`)
- CW silently ignores messages with `request` instead of `hosted_request`
- Event acknowledgments: `{event, _id, result: "success", frameID}`
- Ready message: `{message: "ready"}` — sent to `*` on load
- X-Frame-Options MUST be overridden (Next.js 15 defaults to SAMEORIGIN, blocks CW iframe)

## Deployment Checklist
1. Push to `main` branch
2. Trigger restart via Coolify API or UI
3. Wait for container to be healthy (~60-90s)
4. Verify: `curl -s -o /dev/null -w "%{http_code}" https://ticketwise.ingeniotech.co.uk/` → 200
5. Tell users to hard-refresh if they had the old version cached
