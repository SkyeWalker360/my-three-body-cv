import { asset } from '@/lib/asset';
import type { CvManifest } from '@/lib/schema';

/** Email, LinkedIn, GitHub and the PDF. Never phone or street address. */
export function ContactLinks({
  person,
  compact = false,
}: {
  person: CvManifest['person'];
  compact?: boolean;
}) {
  const { email, linkedin, github } = person.contact;
  const link =
    'inline-flex min-h-11 items-center gap-2 border border-cyan/40 bg-void px-3 py-2 text-sm hover:border-cyan';
  return (
    <ul className={`flex flex-wrap gap-2 ${compact ? 'justify-center' : ''}`} aria-label="Contact">
      <li>
        <a className={link} href={`mailto:${email}`}>
          <span aria-hidden="true">✉</span> {email}
        </a>
      </li>
      <li>
        <a className={link} href={linkedin} rel="me noreferrer" target="_blank">
          LinkedIn
        </a>
      </li>
      <li>
        <a className={link} href={github} rel="me noreferrer" target="_blank">
          GitHub
        </a>
      </li>
      <li>
        <a className="btn btn-gold" href={asset('/cv.pdf')} download="Luke_Gorry_CV.pdf">
          ⬇ DOWNLOAD CV (PDF)
        </a>
      </li>
    </ul>
  );
}
