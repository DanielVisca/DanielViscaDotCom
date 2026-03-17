import fs from 'fs';
import path from 'path';
import FluidBackground from '@/components/FluidBackground';
import AboutContent from '@/components/AboutContent';
import CursorQuirks from '@/components/CursorQuirks';
import PhotoCollage from '@/components/PhotoCollage';

const PHOTO_ITEMS = [
  { src: '/imgs/selfieonrainier.jpeg', alt: 'Selfie on Rainier at sunrise', caption: 'Rainier sunrise' },
  { src: '/imgs/goofywearinggogglesandmic.JPG', alt: 'Wearing goggles and holding a karaoke mic', caption: 'Just goofing around' },
  { src: '/imgs/meinapplejuicecostume.jpg', alt: 'Wearing homemade apple juice box costume', caption: '100% apple juice costume' },
  { src: '/imgs/justboughtbike.jpg', alt: 'With touring bike, thumbs up', caption: 'Japan bike trip' },
];

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
            <PhotoCollage items={PHOTO_ITEMS} />
          </div>
        </div>
      </div>
      <CursorQuirks />
    </div>
  );
}
