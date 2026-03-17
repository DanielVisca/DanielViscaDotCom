import fs from 'fs';
import path from 'path';
import FluidBackground from '@/components/FluidBackground';
import AboutContent from '@/components/AboutContent';
import CursorQuirks from '@/components/CursorQuirks';

function getAboutContent(): string {
  const filePath = path.join(process.cwd(), 'docs', 'AboutMe.md');
  return fs.readFileSync(filePath, 'utf-8');
}

export default function Home() {
  const aboutRaw = getAboutContent();

  return (
    <div className="min-h-screen bg-black">
      <FluidBackground />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-[2] focus:rounded focus:bg-cyan-500 focus:px-4 focus:py-2 focus:text-black focus:outline-none"
      >
        Skip to content
      </a>
      <div id="main" className="relative z-[1] min-h-screen pointer-events-none" role="main">
        <div className="pointer-events-auto max-w-2xl mx-auto px-6 py-12 sm:py-16 md:py-20">
          <div className="rounded-2xl bg-black/60 backdrop-blur-sm border border-white/10 p-6 sm:p-8 md:p-10 shadow-2xl">
            <AboutContent content={aboutRaw} />
          </div>
        </div>
      </div>
      <CursorQuirks />
    </div>
  );
}
