import { firstSentences } from '@/lib/format';
import type { CvManifest } from '@/lib/schema';
import { ContactLinks } from './Contact';
import { KarlButton, ScannerButton } from './controls';

export function Hero({ person }: { person: CvManifest['person'] }) {
  const intro = firstSentences(person.summary, 3);
  const rest = person.summary.slice(intro.length).trim();
  return (
    <section
      id="top"
      aria-labelledby="name"
      className="glass pixel-border scroll-mt-24 border border-cyan/40 p-6 sm:p-8"
    >
      <h1 id="name" className="font-pixel text-xl leading-relaxed text-gold sm:text-3xl">
        {person.name}
      </h1>
      <p className="mt-2 text-base font-bold text-cyan sm:text-lg">{person.title}</p>
      <p className="mt-1 font-terminal text-lg text-ink-muted">{person.location}</p>

      <div className="mt-4">
        <ContactLinks person={person} />
      </div>

      <p className="mt-6 max-w-3xl text-sm leading-relaxed sm:text-base">{intro}</p>
      {rest && (
        <details className="mt-2 max-w-3xl text-sm">
          <summary className="cursor-pointer text-cyan">Full profile</summary>
          <p className="mt-2 leading-relaxed">{rest}</p>
        </details>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <a href="#experience-title" className="btn btn-cyan">
          EXPLORE CV
        </a>
        <ScannerButton className="btn btn-gold">OPEN FIELD SCANNER</ScannerButton>
        <KarlButton command="/core" className="btn btn-red">
          DIAGNOSE CORE
        </KarlButton>
        <KarlButton command="/noctus" className="btn btn-violet">
          PLAY NOCTUS UMBRA
        </KarlButton>
      </div>
    </section>
  );
}
