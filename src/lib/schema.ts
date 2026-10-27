import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}(-\d{2})?$/, 'Dates are ISO strings: YYYY or YYYY-MM');

export const sectorSchema = z.enum(['dev', 'ndt', 'edu', 'other']);
export type Sector = z.infer<typeof sectorSchema>;

export const gameSchema = z.object({
  hp: z.number().int().positive(),
  fragments: z.array(z.string().min(1)).min(1),
});
export type Game = z.infer<typeof gameSchema>;

export const experienceSchema = z.object({
  id: z.string().min(1),
  org: z.string(),
  role: z.string(),
  start: isoDate,
  end: isoDate.optional(),
  location: z.string(),
  sector: sectorSchema,
  kind: z.enum(['employment', 'volunteering']),
  summary: z.string().optional(),
  roles: z.array(z.object({ title: z.string(), highlights: z.array(z.string()) })).optional(),
  highlights: z.array(z.string()).optional(),
  later: z.string().optional(),
  clients: z.array(z.string()).optional(),
  game: gameSchema.optional(),
});

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  tagline: z.string(),
  start: isoDate,
  end: isoDate.nullable(),
  sector: sectorSchema,
  highlights: z.array(z.string()),
  game: gameSchema.optional(),
});

export const certificationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  issuer: z.string(),
  location: z.string(),
  start: isoDate,
  end: isoDate,
  levels: z.array(z.string()).min(1),
  sector: sectorSchema,
  game: gameSchema.optional(),
});

export const educationSchema = z.object({
  id: z.string().min(1),
  institution: z.string(),
  award: z.string(),
  location: z.string(),
  start: isoDate,
  end: isoDate,
  sector: sectorSchema,
  qualifications: z.array(z.string()).optional(),
  detail: z.string().optional(),
  game: gameSchema.optional(),
});

export const cvManifestSchema = z
  .object({
    $schemaVersion: z.literal(1).optional(),
    source: z.string().optional(),
    person: z.object({
      name: z.string().min(1),
      title: z.string().min(1),
      location: z.string(),
      summary: z.string().min(1),
      // Never phone or street address: the site and /cv.pdf are public.
      contact: z
        .object({
          email: z.email(),
          linkedin: z.url(),
          github: z.url(),
        })
        .strict(),
    }),
    experience: z.array(experienceSchema),
    projects: z.array(projectSchema),
    certifications: z.array(certificationSchema),
    education: z.array(educationSchema),
    skills: z.array(
      z.object({ category: z.string(), sector: sectorSchema, items: z.array(z.string()).min(1) }),
    ),
    spokenLanguages: z.array(z.object({ language: z.string(), level: z.string() })),
    achievements: z.array(z.string()),
    karl: z.object({ aliases: z.record(z.string(), z.array(z.string().min(1))) }),
  })
  .superRefine((m, ctx) => {
    const ids = [
      ...m.experience.map((e) => e.id),
      ...m.projects.map((p) => p.id),
      ...m.certifications.map((c) => c.id),
      ...m.education.map((e) => e.id),
    ];
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) ctx.addIssue({ code: 'custom', message: `Duplicate manifest id "${id}"` });
      seen.add(id);
    }
    for (const id of Object.keys(m.karl.aliases)) {
      if (!seen.has(id)) {
        ctx.addIssue({ code: 'custom', message: `karl.aliases refers to unknown id "${id}"` });
      }
    }
  });

export type CvManifest = z.infer<typeof cvManifestSchema>;
export type Experience = CvManifest['experience'][number];
export type Project = CvManifest['projects'][number];
export type Certification = CvManifest['certifications'][number];
export type Education = CvManifest['education'][number];

export function parseManifest(data: unknown): CvManifest {
  const result = cvManifestSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`cv-manifest.json is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
