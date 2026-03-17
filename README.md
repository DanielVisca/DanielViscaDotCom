# Daniel Visca — Personal Site

Demo and source for [danielvisca.com](https://danielvisca.com).

## Demo

[![Watch the demo](https://img.youtube.com/vi/Y6xYmOsjt8E/maxresdefault.jpg)](https://www.youtube.com/watch?v=Y6xYmOsjt8E)

I had fun with this. If you are lucky you will meet 'peeker'... he may be shy at first.

## Tech

- **Next.js** (App Router)
- **React**, **Tailwind CSS**, **react-markdown**
- **PostHog** for analytics

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Env

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SITE_URL` — production URL (for SEO and canonical)
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` — optional, for analytics
