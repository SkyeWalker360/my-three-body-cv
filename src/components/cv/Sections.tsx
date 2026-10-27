import { formatRange } from '@/lib/format';
import type { CvManifest } from '@/lib/schema';
import { Badge, Bullets, Card, SectionHeading } from './Card';

type Props = { m: CvManifest };

/** Space-separated sectors in a section, so the filters can hide sections left empty. */
const sectorsOf = (items: { sector: string }[]) =>
  [...new Set(items.map((i) => i.sector))].join(' ');

const time = (start: string, end: string | null | undefined) => (
  <time dateTime={start}>{formatRange(start, end)}</time>
);

export function Experience({ m }: Props) {
  return (
    <section
      aria-labelledby="experience-title"
      data-sectors={sectorsOf(m.experience)}
      className="scroll-mt-24"
    >
      <SectionHeading id="experience-title" kicker="AVIONICS LOG">
        EXPERIENCE
      </SectionHeading>
      <div className="grid gap-8 md:grid-cols-3">
        {m.experience.map((e) => (
          <Card
            key={e.id}
            id={e.id}
            label={e.org}
            sector={e.sector}
            className={e.kind === 'employment' ? 'md:col-span-2' : ''}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-2">
                <Badge>{time(e.start, e.end)}</Badge>
                <h3 className="font-pixel text-sm leading-relaxed text-cyan">{e.role}</h3>
                <p className="font-terminal text-lg text-gold">
                  {e.org} | {e.location}
                </p>
              </div>
              {e.kind === 'volunteering' && <Badge tone="green">VOLUNTEERING</Badge>}
            </div>
            {e.summary && <p className="mb-4 text-sm leading-relaxed">{e.summary}</p>}
            {e.roles && (
              <div className="grid gap-4 sm:grid-cols-2">
                {e.roles.map((r) => (
                  <div key={r.title} className="space-y-2">
                    <h4 className="text-sm font-bold text-cyan">{r.title}</h4>
                    <Bullets items={r.highlights} />
                  </div>
                ))}
              </div>
            )}
            {e.highlights && <Bullets items={e.highlights} />}
            {e.later && <p className="mt-4 text-sm text-ink-muted">{e.later}</p>}
            {e.clients && e.clients.length > 0 && (
              <p className="mt-4 text-sm text-ink-muted">Clients include: {e.clients.join(', ')}</p>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}

export function Certifications({ m }: Props) {
  return (
    <section
      aria-labelledby="ndt-title"
      data-sectors={sectorsOf(m.certifications)}
      className="scroll-mt-24"
    >
      <SectionHeading id="ndt-title" kicker="HULL & REACTOR CONTAINMENT">
        NDT CERTIFICATION
      </SectionHeading>
      <div className="grid gap-8 md:grid-cols-2">
        {m.certifications.map((c) => (
          <Card key={c.id} id={c.id} label={c.issuer} sector={c.sector}>
            <div className="space-y-2">
              <Badge tone="gold">{time(c.start, c.end)}</Badge>
              <h3 className="font-pixel text-sm leading-relaxed text-gold">{c.name}</h3>
              <p className="font-terminal text-lg text-ink">
                {c.issuer} | {c.location}
              </p>
            </div>
            <ul className="mt-4 space-y-2">
              {c.levels.map((l) => (
                <li key={l} className="border border-gold/30 bg-void px-4 py-2 text-sm">
                  {l}
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {m.skills
          .filter((s) => s.sector === 'ndt')
          .map((s) => (
            <div key={s.category} data-sector="ndt" className="glass border border-gold/30 p-6">
              <h3 className="mb-4 font-pixel text-xs text-gold">{s.category.toUpperCase()}</h3>
              <ul className="flex flex-wrap gap-2 text-sm">
                {s.items.map((i) => (
                  <li key={i} className="border border-gold/30 bg-void px-2 py-1">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </section>
  );
}

export function SkillsAndProjects({ m }: Props) {
  const skills = m.skills.filter((s) => s.sector !== 'ndt');
  return (
    <section
      aria-labelledby="skills-title"
      data-sectors={sectorsOf([...m.projects, { sector: 'dev' }])}
      className="scroll-mt-24"
    >
      <SectionHeading id="skills-title" kicker="SYSTEMS MANIFEST">
        SKILLS & PROJECTS
      </SectionHeading>
      <div className="grid gap-8 lg:grid-cols-3">
        <article
          data-destructible
          data-id="skills"
          data-label="SKILLS"
          data-sector="dev"
          className="glass pixel-border border border-cyan/40 p-6 lg:col-span-2"
        >
          <h3 className="sr-only">Skills</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            {skills.map((s) => (
              <div key={s.category} data-sector={s.sector} className="space-y-1">
                <dt className="font-pixel text-xs text-cyan">{s.category.toUpperCase()}</dt>
                <dd className="text-sm leading-relaxed">{s.items.join(', ')}</dd>
              </div>
            ))}
            <div data-sector="other" className="space-y-1">
              <dt className="font-pixel text-xs text-cyan">LANGUAGES</dt>
              <dd className="text-sm">
                {m.spokenLanguages.map((l) => `${l.language} (${l.level})`).join(', ')}
              </dd>
            </div>
          </dl>
        </article>
        {m.projects.map((p) => (
          <Card key={p.id} id={p.id} label={p.name} sector={p.sector}>
            <div className="mb-4 space-y-2">
              <Badge>{time(p.start, p.end)}</Badge>
              <h3 className="font-pixel text-sm leading-relaxed text-cyan">{p.name}</h3>
              <p className="font-terminal text-lg text-gold">{p.tagline}</p>
              <p className="text-sm text-ink-muted">Personal project</p>
            </div>
            <Bullets items={p.highlights} />
          </Card>
        ))}
      </div>
    </section>
  );
}

export function EducationSection({ m }: Props) {
  return (
    <section
      aria-labelledby="education-title"
      data-sectors={sectorsOf(m.education)}
      className="scroll-mt-24"
    >
      <SectionHeading id="education-title" kicker="TRAINING ARCHIVE">
        EDUCATION
      </SectionHeading>
      <div className="grid gap-8 md:grid-cols-3">
        {m.education.map((e, i) => (
          <Card
            key={e.id}
            id={e.id}
            label={e.institution}
            sector={e.sector}
            className={i === 0 ? 'md:col-span-2' : ''}
          >
            <div className="mb-4 space-y-2">
              <Badge tone="violet">{time(e.start, e.end)}</Badge>
              <h3 className="font-pixel text-sm leading-relaxed text-violet-ink">{e.award}</h3>
              <p className="font-terminal text-lg text-gold">
                {e.institution} | {e.location}
              </p>
            </div>
            {e.qualifications && <Bullets items={e.qualifications} />}
            {e.detail && <p className="text-sm leading-relaxed">{e.detail}</p>}
            {e.id === 'mondeor' && m.achievements.length > 0 && (
              <>
                <h4 className="mt-4 mb-2 font-pixel text-xs text-gold">ACHIEVEMENTS</h4>
                <Bullets items={m.achievements} />
              </>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
