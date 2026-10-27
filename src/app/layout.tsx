import type { Metadata, Viewport } from 'next';
import { Press_Start_2P, Space_Mono, VT323 } from 'next/font/google';
import { manifest } from '@/lib/manifest';
import { SITE_URL } from '@/lib/site';
import './globals.css';

// next/font downloads these at build time and serves them from the site itself.
const pressStart = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-press-start',
});
const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-vt323',
});
const spaceMono = Space_Mono({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-mono',
});

const { person } = manifest;
const description = `${person.name}: ${person.title}. ${person.location}.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${person.name} | ${person.title}`,
  description,
  authors: [{ name: person.name, url: person.contact.github }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'profile',
    title: `${person.name} — CV`,
    description,
    url: '/',
    siteName: 'My Three Body CV',
    firstName: person.name.split(' ')[0],
    lastName: person.name.split(' ').slice(1).join(' '),
  },
  twitter: { card: 'summary_large_image', title: `${person.name} — CV`, description },
};

export const viewport: Viewport = {
  themeColor: '#0a0e1a', // mirrors --color-void; metadata can't read CSS variables
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pressStart.variable} ${vt323.variable} ${spaceMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
