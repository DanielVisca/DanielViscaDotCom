'use client';

import ReactMarkdown from 'react-markdown';

function prepareAboutContent(raw: string): string {
  const lines = raw.trimEnd().split('\n');
  const contactLine = '[email] · [github] · [linkedin] · [medium]';
  const linkedin = 'https://www.linkedin.com/in/daniel-visca/';
  const github = 'https://github.com/DanielVisca';
  const medium = 'https://medium.com/@danielvisca';
  const email = 'mailto:danielvisca96@gmail.com';
  const contactWithLinks = `[email](${email}) · [github](${github}) · [linkedin](${linkedin}) · [medium](${medium}) · [resume](/resume.pdf)`;

  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === contactLine.trim()) {
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
  return result;
}

export default function AboutContent({ content }: { content: string }) {
  const text = prepareAboutContent(content);

  return (
    <article
      className="prose prose-invert prose-lg max-w-none prose-p:leading-relaxed prose-p:mb-6 prose-p:mt-6 prose-p:first:mt-0 prose-p:last:mb-0 prose-p:last:mt-10 prose-headings:font-semibold prose-headings:mt-8 prose-headings:mb-3 prose-headings:first:mt-0 prose-a:text-cyan-300 prose-a:no-underline [&>p]:break-words"
      style={{ textShadow: '0 0 20px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.9)' }}
    >
      <ReactMarkdown
        components={{
          a: ({ href, children, ...props }) => (
            <span className="group/link relative inline-block">
              <a
                href={href}
                {...props}
                className="inline-block transition-all duration-200 hover:underline hover:scale-110 origin-left"
                {...(href?.startsWith('http') || href === '/resume.pdf'
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {children}
              </a>
              <span
                className="pointer-events-none absolute left-0 bottom-full mb-1 hidden group-hover/link:block whitespace-nowrap rounded bg-white/10 px-2 py-0.5 text-xs text-white/90 backdrop-blur-sm"
                style={{ textShadow: '0 0 8px rgba(0,0,0,0.8)' }}
              >
                Click me 👀
              </span>
            </span>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </article>
  );
}
