/**
 * The field scanner's specimens, built from the CV manifest. Pure, for tests.
 *
 * Every name, habitat and log line is copied verbatim from the manifest. The only text that
 * isn't is the Sightings region: short site copy about what the three-body lab draws, like
 * the lab panel's copy.
 */
import { formatRange } from '@/lib/format';
import type { RampName } from '@/lib/palette';
import type { CvManifest, Sector } from '@/lib/schema';
import type { SpriteKind } from './sprite';

export type ChipTone = 'cyan' | 'gold' | 'ink' | 'muted' | 'violet';
export type Chip = { label: string; tone: ChipTone };
export type LogBlock = { heading?: string; lines: string[] };
export type Chain = { labels: string[]; here: number };

export type RegionId =
  | 'experience'
  | 'projects'
  | 'certifications'
  | 'education'
  | 'skills'
  | 'achievements'
  | 'sightings';

export type Specimen = {
  /** Stable across manifest edits that don't touch this entry; the logbook stores it. */
  key: string;
  /** 1-based, in scan order across all regions. */
  no: number;
  region: RegionId;
  name: string;
  chips: Chip[];
  habitat?: string;
  period?: string;
  log: LogBlock[];
  chain?: Chain;
  sprite: SpriteKind;
  /** The ramp the sprite shades with. */
  ramp: RampName;
  /** Site copy rather than a CV fact (Sightings only). */
  siteCopy?: true;
};

export type Region = { id: RegionId; label: string; specimens: Specimen[] };

export const SECTOR_LABEL: Record<Sector, string> = {
  dev: 'SOFTWARE',
  ndt: 'NDT',
  edu: 'EDUCATION',
  other: 'OTHER',
};

const SECTOR_TONE: Record<Sector, ChipTone> = {
  dev: 'cyan',
  ndt: 'gold',
  edu: 'ink',
  other: 'muted',
};

const SECTOR_RAMP: Record<Sector, RampName> = {
  dev: 'cyan',
  ndt: 'gold',
  edu: 'violet',
  other: 'violet',
};

const sectorChip = (s: Sector): Chip => ({ label: SECTOR_LABEL[s], tone: SECTOR_TONE[s] });
const kindChip = (label: string): Chip => ({ label, tone: 'muted' });
const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');

/** Site copy for the Sightings region. Describes only what the lab actually draws. */
const SIGHTINGS: Array<
  Pick<Specimen, 'name' | 'sprite' | 'ramp'> & { text: string; here: number }
> = [
  {
    name: 'Main-sequence star',
    sprite: 'star',
    ramp: 'star',
    here: 0,
    text: 'Each star takes its colour from its temperature, from a dim red dwarf to a blue-white giant, and its surface slowly boils.',
  },
  {
    name: 'Dying star',
    sprite: 'dying',
    ramp: 'red',
    here: 1,
    text: 'A giant that swells, pulses and sheds rings of gas. Press AGE A STAR in the lab to watch one.',
  },
  {
    name: 'Black hole',
    sprite: 'black-hole',
    ramp: 'cyan',
    here: 2,
    text: 'What a blue-white giant leaves after its supernova: a black disc in a thin bright ring, with a disk that is cyan on one side and red on the other.',
  },
  {
    name: 'Living planet',
    sprite: 'planet',
    ramp: 'cyan',
    here: -1,
    text: 'A planet whose surface scorches or freezes with the light it gets from three stars. After a stable era, city lights appear on its night side.',
  },
];

const LIFECYCLE = ['Main sequence', 'Giant', 'Remnant'];

type Draft = Omit<Specimen, 'no'>;

function experience(m: CvManifest): Draft[] {
  return m.experience.map((e) => {
    const log: LogBlock[] = [];
    if (e.summary) log.push({ lines: [e.summary] });
    for (const r of e.roles ?? []) log.push({ heading: r.title, lines: r.highlights });
    if (e.highlights?.length) log.push({ lines: e.highlights });
    if (e.later) log.push({ lines: [e.later] });

    // An evolution chain only where the manifest links two entries: one org is a later
    // entry's client (Lead Life → GEN318).
    let chain: Chain | undefined;
    const later = m.experience.find((o) => o.id !== e.id && o.clients?.includes(e.org));
    const earlier = m.experience.find((o) => o.id !== e.id && e.clients?.includes(o.org));
    if (later) chain = { labels: [e.org, later.org], here: 0 };
    else if (earlier) chain = { labels: [earlier.org, e.org], here: 1 };

    return {
      key: `experience:${e.id}`,
      region: 'experience' as const,
      name: e.role,
      chips: [sectorChip(e.sector), kindChip(e.kind.toUpperCase())],
      habitat: join(e.org, e.location),
      period: formatRange(e.start, e.end),
      log,
      chain,
      sprite: 'ship' as const,
      ramp: SECTOR_RAMP[e.sector],
    };
  });
}

function projects(m: CvManifest): Draft[] {
  return m.projects.map((p) => ({
    key: `project:${p.id}`,
    region: 'projects' as const,
    name: p.name,
    chips: [sectorChip(p.sector), kindChip('PROJECT')],
    habitat: p.tagline,
    period: formatRange(p.start, p.end),
    log: [{ lines: p.highlights }],
    sprite: 'relay' as const,
    ramp: SECTOR_RAMP[p.sector],
  }));
}

function certifications(m: CvManifest): Draft[] {
  // One specimen per level, so the levels read as an evolution chain.
  return m.certifications.flatMap((c) =>
    c.levels.map((level, i) => ({
      key: `certification:${c.id}:${i}`,
      region: 'certifications' as const,
      name: level,
      chips: [sectorChip(c.sector), kindChip('CERTIFICATION')],
      habitat: join(c.issuer, c.location),
      period: formatRange(c.start, c.end),
      log: [{ lines: [c.name] }],
      chain: c.levels.length > 1 ? { labels: c.levels, here: i } : undefined,
      sprite: 'magnet' as const,
      ramp: SECTOR_RAMP[c.sector],
    })),
  );
}

function education(m: CvManifest): Draft[] {
  return m.education.map((e) => {
    const log: LogBlock[] = [];
    if (e.qualifications?.length) log.push({ lines: e.qualifications });
    if (e.detail) log.push({ lines: [e.detail] });
    return {
      key: `education:${e.id}`,
      region: 'education' as const,
      name: e.award,
      chips: [sectorChip(e.sector), kindChip('EDUCATION')],
      habitat: join(e.institution, e.location),
      period: formatRange(e.start, e.end),
      log,
      sprite: 'badge' as const,
      ramp: SECTOR_RAMP[e.sector],
    };
  });
}

function skills(m: CvManifest): Draft[] {
  return m.skills.map((s) => ({
    key: `skills:${s.category}`,
    region: 'skills' as const,
    name: s.category,
    chips: [sectorChip(s.sector), kindChip('SKILLS')],
    log: [{ lines: s.items }],
    sprite: 'creature' as const,
    ramp: SECTOR_RAMP[s.sector],
  }));
}

function achievements(m: CvManifest): Draft[] {
  return m.achievements.map((a) => ({
    key: `achievement:${a}`,
    region: 'achievements' as const,
    name: a,
    chips: [kindChip('ACHIEVEMENT')],
    log: [{ lines: [a] }],
    sprite: 'badge' as const,
    ramp: 'gold' as const,
  }));
}

function sightings(): Draft[] {
  return SIGHTINGS.map((s) => ({
    key: `sighting:${s.sprite}`,
    region: 'sightings' as const,
    name: s.name,
    chips: [{ label: 'SIGHTING', tone: 'violet' as const }],
    habitat: 'Three-body lab',
    log: [{ lines: [s.text] }],
    chain: s.here >= 0 ? { labels: LIFECYCLE, here: s.here } : undefined,
    sprite: s.sprite,
    ramp: s.ramp,
    siteCopy: true as const,
  }));
}

/** Every region, in scan order. Empty regions are left out. */
export function buildRegions(m: CvManifest): Region[] {
  const drafts: Array<[RegionId, string, Draft[]]> = [
    ['experience', 'EXPERIENCE', experience(m)],
    ['projects', 'PROJECTS', projects(m)],
    ['certifications', 'CERTS', certifications(m)],
    ['education', 'EDUCATION', education(m)],
    ['skills', 'SKILLS', skills(m)],
    ['achievements', 'AWARDS', achievements(m)],
    ['sightings', 'SIGHTINGS', sightings()],
  ];
  let no = 0;
  return drafts
    .filter(([, , list]) => list.length > 0)
    .map(([id, label, list]) => ({
      id,
      label,
      specimens: list.map((d) => ({ ...d, no: ++no })),
    }));
}

/** "#003" */
export function specimenNumber(no: number): string {
  return `#${String(no).padStart(3, '0')}`;
}
