'use client';

import ReactMarkdown from 'react-markdown';

function prepareAboutContent(raw: string): string {
  const lines = raw.trimEnd().split('\n');
  const contactLine = '📬 [email] · [github] · [linkedin]';
  const linkedin = 'https://www.linkedin.com/in/daniel-visca/';
  const github = 'https://github.com/DanielVisca';
  const email = 'mailto:danielvisca96@gmail.com';
  const contactWithLinks = `📬 [email](${email}) · [github](${github}) · [linkedin](${linkedin})`;

  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === contactLine.trim()) {
      out.push(contactWithLinks);
      i += 4;
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }
  let result = out.join('\n');
  result = result.replace(/\*\*OutfitterHQ\*\*/, '**[OutfitterHQ](https://outfitterhq.ca/)**');
  return result;
}

export default function AboutContent({ content }: { content: string }) {
  const text = prepareAboutContent(content);

  return (
    <article
      className="prose prose-invert prose-lg max-w-none prose-p:leading-relaxed prose-p:mb-4 prose-headings:font-semibold prose-a:text-cyan-300 prose-a:no-underline hover:prose-a:underline"
      style={{ textShadow: '0 0 20px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.9)' }}
    >
      <ReactMarkdown>{text}</ReactMarkdown>
    </article>
  );
}
