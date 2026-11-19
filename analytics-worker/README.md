# EX1.1 owner analytics collector (free)

Cloudflare Worker + D1 database. Free tier is plenty. Stores anonymous counts only:
no IP addresses, no cookies, no question text, no personal data.

Deploy once (on your computer, in this folder):

    npm i -g wrangler
    wrangler login
    wrangler d1 create ex11-analytics        # copy the database_id it prints into wrangler.toml
    wrangler d1 execute ex11-analytics --remote --file=schema.sql
    wrangler deploy                          # prints https://ex11-analytics.<you>.workers.dev

Then put that URL into the page (tracker + owner.html) and push.
