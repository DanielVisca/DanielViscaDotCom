'use client';

import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import posthog from 'posthog-js';

const TOOLTIP_ADVANCE_COOLDOWN_MS = 600;

const LINK_TOOLTIPS = [
  'Click me 👀',
  'come on just click me!',
  'do it already 😛',
  '👀👀👀',
];

function prepareAboutContent(raw: string): string {
  const lines = raw.trimEnd().split('\n');
  const contactLine = '[email] · [github] · [linkedin] · [writing]';
  const linkedin = 'https://www.linkedin.com/in/daniel-visca/';
  const github = 'https://github.com/DanielVisca';
  const writing = 'https://medium.com/@danielvisca';
  const reading = 'https://www.goodreads.com/user/show/54860314-daniel';
  const strava = 'https://www.strava.com/athletes/69493448';
  const emailSubject = encodeURIComponent("Hey from the internet (your site said I should say hi 👋)");
  const email = `https://mail.google.com/mail/?view=cm&fs=1&to=danielvisca96@gmail.com&su=${emailSubject}`;
  const contactWithLinks = `[email](${email}) · [github](${github}) · [linkedin](${linkedin}) · [reading](${reading}) · [writing](${writing}) · [running](${strava}) · [resume](/resume.pdf)`;

  const buckAndBoo = "Oh and while you're here... my mom is a graphic designer and makes awesome shirts. It would make her week if you bought one → [Buck & Boo](https://buckandboo.com/).";

  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === contactLine.trim()) {
      out.push('');
      out.push(buckAndBoo);
      out.push('');
      out.push(contactWithLinks);
      i += 5;
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }
  let result = out.join('\n');
  result = result.replace(/\*\*OutfitterHQ\*\*/, '**[OutfitterHQ](https://outfitterhq.ca/)**');
  result = result.replace(/\*\*PostHog\*\*/, '**[PostHog](https://posthog.com/)**');
  result = result.replace(/\*\*Microsoft\*\*/, '**[Microsoft](https://www.microsoft.com/)**');
  result = result.replace(/\*\*The Muddy Goose\*\*/, '**[The Muddy Goose](https://muddygoosepottery.com/)**');
  return result;
}

export default function AboutContent({ content }: { content: string }) {
  const text = prepareAboutContent(content);
  const [tooltipIndex, setTooltipIndex] = useState(0);
  const lastAdvanceRef = useRef(0);

  const cycleTooltip = () => {
    const now = Date.now();
    if (now - lastAdvanceRef.current < TOOLTIP_ADVANCE_COOLDOWN_MS) return;
    lastAdvanceRef.current = now;
    setTooltipIndex((i) => (i + 1) % LINK_TOOLTIPS.length);
  };

  return (
    <article
      className="prose prose-invert prose-lg max-w-none prose-p:leading-relaxed prose-p:mb-6 prose-p:mt-6 prose-p:first:mt-0 prose-p:last:mb-0 prose-p:last:mt-10 prose-headings:font-semibold prose-headings:mt-8 prose-headings:mb-3 prose-headings:first:mt-0 prose-a:text-cyan-300 prose-a:no-underline [&>p]:break-words"
      style={{ textShadow: '0 0 20px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.9)' }}
    >
      <ReactMarkdown
        components={{
          a: ({ href, children, ...props }) => {
            const isBuckAndBoo = href?.includes('buckandboo.com');
            return (
            <span className="group/link relative inline-block" onMouseEnter={cycleTooltip}>
              <a
                href={href}
                {...props}
                className="inline-block transition-all duration-200 hover:underline hover:scale-110 origin-left"
                {...(href?.startsWith('http') || href === '/resume.pdf'
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                onClick={() => {
                  if (isBuckAndBoo && typeof posthog !== 'undefined' && posthog.capture) {
                    posthog.capture('buck_and_boo_clicked');
                  }
                }}
              >
                {children}
              </a>
              <span
                className="pointer-events-none absolute left-0 bottom-full mb-1 hidden group-hover/link:block whitespace-nowrap rounded bg-white/10 px-2 py-0.5 text-xs text-white/90 backdrop-blur-sm"
                style={{ textShadow: '0 0 8px rgba(0,0,0,0.8)' }}
              >
                {LINK_TOOLTIPS[tooltipIndex]}
              </span>
            </span>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </article>
  );
}
