import type { Certification, CvManifest, Education, Experience, Project } from './schema';

/** Any manifest entry that can be addressed by id (cards, K.A.R.L. intents, asteroids). */
export type ManifestEntry =
  | { type: 'experience'; entry: Experience }
  | { type: 'project'; entry: Project }
  | { type: 'certification'; entry: Certification }
  | { type: 'education'; entry: Education };

export function findEntry(m: CvManifest, id: string): ManifestEntry | undefined {
  const exp = m.experience.find((e) => e.id === id);
  if (exp) return { type: 'experience', entry: exp };
  const proj = m.projects.find((e) => e.id === id);
  if (proj) return { type: 'project', entry: proj };
  const cert = m.certifications.find((e) => e.id === id);
  if (cert) return { type: 'certification', entry: cert };
  const edu = m.education.find((e) => e.id === id);
  if (edu) return { type: 'education', entry: edu };
  return undefined;
}

export function entryTitle(e: ManifestEntry): string {
  switch (e.type) {
    case 'experience':
      return `${e.entry.role} · ${e.entry.org}`;
    case 'project':
      return e.entry.name;
    case 'certification':
      return e.entry.name;
    case 'education':
      return `${e.entry.award} · ${e.entry.institution}`;
  }
}
