import EasterEggs from '@/components/EasterEggs';
import { Filters } from '@/components/cv/Filters';
import { Footer } from '@/components/cv/Footer';
import { Header } from '@/components/cv/Header';
import { Hero } from '@/components/cv/Hero';
import { LabPanel } from '@/components/cv/LabPanel';
import {
  Certifications,
  EducationSection,
  Experience,
  SkillsAndProjects,
} from '@/components/cv/Sections';
import { manifest } from '@/lib/manifest';
import { SITE_URL } from '@/lib/site';

function personJsonLd() {
  const { person, experience, education, certifications, skills } = manifest;
  const current = experience.find((e) => e.kind === 'employment');
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    jobTitle: person.title,
    email: `mailto:${person.contact.email}`,
    url: SITE_URL,
    sameAs: [person.contact.linkedin, person.contact.github],
    address: { '@type': 'PostalAddress', addressRegion: person.location },
    worksFor: current ? { '@type': 'Organization', name: current.org } : undefined,
    alumniOf: education.map((e) => ({ '@type': 'EducationalOrganization', name: e.institution })),
    hasCredential: certifications.flatMap((c) =>
      c.levels.map((l) => ({
        '@type': 'EducationalOccupationalCredential',
        name: l,
        recognizedBy: { '@type': 'Organization', name: c.issuer },
      })),
    ),
    knowsAbout: skills.flatMap((s) => s.items),
    knowsLanguage: manifest.spokenLanguages.map((l) => l.language),
  };
}

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-gold focus:p-2 focus:text-void"
      >
        Skip to CV
      </a>
      <EasterEggs />
      <Header person={manifest.person} />
      <main id="main" className="relative z-10 mx-auto max-w-7xl space-y-16 px-4 py-8">
        <Hero person={manifest.person} />
        <Filters>
          <Experience m={manifest} />
          <Certifications m={manifest} />
          <SkillsAndProjects m={manifest} />
          <EducationSection m={manifest} />
        </Filters>
        <LabPanel />
      </main>
      <Footer person={manifest.person} />
      <script
        type="application/ld+json"
        // JSON-LD built from the manifest at build time; no user input.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd()).replace(/</g, '\\u003c'),
        }}
      />
    </>
  );
}
