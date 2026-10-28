/**
 * K.A.R.L.'s replies. Every career fact comes from the manifest; only K.A.R.L.'s own lore
 * (the core) is written here.
 */
import { formatRange } from '@/lib/format';
import { entryTitle, findEntry } from '@/lib/entries';
import type { CvManifest } from '@/lib/schema';
import { line, type Line } from '@/lib/terminal';

export const CORE_LABEL = '1.43 M☉ sub-Chandrasekhar Si–Fe core';

export function helpLines(): Line[] {
  return [
    line('K.A.R.L. COMMANDS', 'heading'),
    line('/cv       Career summary'),
    line('/ndt      NDT certification'),
    line('/skills   Skills by category'),
    line('/contact  How to reach Luke'),
    line('/core     What powers this ship'),
    line('/noctus   Play the Noctus Umbra campaign'),
    line('/lab      Open the plain lab view on the observation deck'),
    line('/clear    Clear the log'),
    line('/exit     Leave the current mode, or close K.A.R.L.'),
    line('Or just ask: "what did Luke do at GEN318?", "homelab", "education".', 'muted'),
  ];
}

export function greetingLines(m: CvManifest): Line[] {
  return [
    line('[SYSTEM ONLINE] K.A.R.L. — Knight Automated Retro-Spacer Log.', 'heading'),
    line(
      `Welcome aboard, co-pilot. ${m.person.name} flies this ship; I keep the logs. Type /help for commands.`,
    ),
  ];
}

export function identityLines(m: CvManifest): Line[] {
  return [
    line('K.A.R.L. MARK-IV DUO-PILOT SPACER', 'heading'),
    line(`Pilot: ${m.person.name}. Co-pilot: you.`),
    line(
      "I run on a dying star. The pilot's software keeps my avionics flying; his magnetic particle inspections keep my reactor welds from cracking.",
    ),
  ];
}

export function cvLines(m: CvManifest): Line[] {
  const out = [line(`${m.person.name.toUpperCase()} — ${m.person.title}`, 'heading')];
  for (const e of m.experience) {
    const kind = e.kind === 'volunteering' ? ' (volunteering)' : '';
    out.push(line(`• ${e.role}, ${e.org}${kind} — ${formatRange(e.start, e.end)}`));
  }
  for (const c of m.certifications) {
    out.push(line(`• ${c.name}, ${c.issuer} — ${formatRange(c.start, c.end)}`));
  }
  for (const p of m.projects) {
    out.push(line(`• ${p.name}: ${p.tagline} — ${formatRange(p.start, p.end)}`));
  }
  for (const e of m.education) {
    out.push(line(`• ${e.award}, ${e.institution} — ${formatRange(e.start, e.end)}`));
  }
  out.push(line('Ask about any of these by name for details.', 'muted'));
  return out;
}

export function ndtLines(m: CvManifest): Line[] {
  const out: Line[] = [];
  for (const c of m.certifications.filter((x) => x.sector === 'ndt')) {
    out.push(...entryLines(m, c.id));
  }
  for (const s of m.skills.filter((x) => x.sector === 'ndt')) {
    out.push(line(`${s.category}: ${s.items.join(', ')}`));
  }
  return out;
}

export function skillsLines(m: CvManifest): Line[] {
  return [
    line('SKILLS', 'heading'),
    ...m.skills.map((s) => line(`${s.category}: ${s.items.join(', ')}`)),
    line(`Languages: ${m.spokenLanguages.map((l) => `${l.language} (${l.level})`).join(', ')}`),
  ];
}

export function contactLines(m: CvManifest): Line[] {
  const { email, linkedin, github } = m.person.contact;
  return [
    line('CONTACT', 'heading'),
    line(`Email: ${email}`, 'accent', `mailto:${email}`),
    line(`LinkedIn: ${linkedin}`, 'accent', linkedin),
    line(`GitHub: ${github}`, 'accent', github),
  ];
}

export function coreLines(m: CvManifest): Line[] {
  const cert = m.certifications.find((c) => c.sector === 'ndt');
  return [
    line(`CORE STATUS: ${CORE_LABEL}`, 'heading'),
    line(
      'My reactor holds a silicon-burning shell around an iron core, just under the Chandrasekhar limit (about 1.44 solar masses). Fusing iron absorbs energy instead of releasing it, so only electron degeneracy pressure stops the core from collapsing.',
    ),
    line(
      'Past 1.44 M☉ that pressure fails: the core implodes in milliseconds and rebounds as a supernova. I run at 1.43, harvesting the silicon shell right at the edge.',
    ),
    line(
      cert
        ? `Containment depends on flawless welds. The pilot is certified in ${cert.name} (${cert.issuer}), the method used to find surface cracks in magnetic metals.`
        : 'Containment depends on flawless welds.',
      'accent',
    ),
  ];
}

export function entryLines(m: CvManifest, id: string): Line[] {
  const found = findEntry(m, id);
  if (!found) return [line(`No log entry for "${id}".`, 'error')];
  const out = [line(entryTitle(found).toUpperCase(), 'heading')];
  switch (found.type) {
    case 'experience': {
      const e = found.entry;
      out.push(line(`${e.org} | ${e.location} | ${formatRange(e.start, e.end)}`, 'muted'));
      if (e.kind === 'volunteering') out.push(line('Volunteering', 'muted'));
      if (e.summary) out.push(line(e.summary));
      for (const r of e.roles ?? []) {
        out.push(line(r.title, 'accent'));
        r.highlights.forEach((h) => out.push(line(`• ${h}`)));
      }
      e.highlights?.forEach((h) => out.push(line(`• ${h}`)));
      if (e.later) out.push(line(e.later, 'muted'));
      if (e.clients?.length) out.push(line(`Clients include: ${e.clients.join(', ')}`, 'muted'));
      break;
    }
    case 'project': {
      const p = found.entry;
      out.push(line(`${p.tagline} | ${formatRange(p.start, p.end)}`, 'muted'));
      p.highlights.forEach((h) => out.push(line(`• ${h}`)));
      break;
    }
    case 'certification': {
      const c = found.entry;
      out.push(line(`${c.issuer} | ${c.location} | ${formatRange(c.start, c.end)}`, 'muted'));
      c.levels.forEach((l) => out.push(line(`• ${l}`)));
      break;
    }
    case 'education': {
      const e = found.entry;
      out.push(line(`${e.location} | ${formatRange(e.start, e.end)}`, 'muted'));
      e.qualifications?.forEach((q) => out.push(line(`• ${q}`)));
      if (e.detail) out.push(line(e.detail));
      if (e.id === 'mondeor') m.achievements.forEach((a) => out.push(line(`★ ${a}`)));
      break;
    }
  }
  return out;
}

export function unknownLines(input: string): Line[] {
  return [
    line(`"${input}" isn't in my logs, co-pilot. Type /help for what I can answer.`, 'muted'),
  ];
}
