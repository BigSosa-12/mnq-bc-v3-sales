# Heart live Q&A (Cloudflare Worker)

Lets members ask Heart anything about markets. The Anthropic API key lives only in the Worker, never in the page.

## One-time setup (about 10 minutes, you do this part)
1. `cd worker && npx wrangler login`
2. `npx wrangler kv namespace create HEART_KV` and paste the returned id into `wrangler.toml` (uncomment the kv block).
3. `npx wrangler secret put ANTHROPIC_API_KEY` (paste your key when prompted)
4. `npx wrangler secret put MEMBER_CODE` (same access code your buyers use, as written in your purchase email)
5. `npx wrangler deploy` and copy the `https://heart-teacher.<you>.workers.dev` URL.
6. Give that URL to Claude so the page can be rebuilt pointing at it.

## Cost controls
- Members only; 40 questions per IP per day and 500 per day total (edit in `wrangler.toml`).
- Default model is the cheap Haiku tier. Web search for current events is on (`WEB_SEARCH`), about $10 per 1,000 searches plus tokens. Set it to "0" to turn it off.
- Set a monthly spend limit in the Anthropic console too.

## Safety
Educational scope only. Advice, signal, prediction and profit questions are refused before reaching the model, and answers are filtered after. Tested with a mock only; test with real keys and a list of tricky questions before announcing.
