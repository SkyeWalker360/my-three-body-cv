import { ImageResponse } from 'next/og';
import { manifest } from '@/lib/manifest';

export const dynamic = 'force-static';
export const alt = `${manifest.person.name} — CV`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Satori can't read CSS variables, so the theme tokens are repeated here.
const VOID = '#0a0e1a';
const INK = '#e2e8f0';
const CYAN = '#12b5cb';
const GOLD = '#ffd93d';
const RED = '#ff1e1e';

export default function OpengraphImage() {
  const { person } = manifest;
  const stars = [
    { x: 880, y: 180, c: CYAN },
    { x: 1010, y: 300, c: GOLD },
    { x: 900, y: 420, c: RED },
  ];
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        background: VOID,
        color: INK,
        border: `16px solid ${CYAN}`,
        position: 'relative',
      }}
    >
      {stars.map((s) => (
        <div
          key={s.c}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: 48,
            height: 48,
            background: s.c,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 24, height: 24, background: INK }} />
        </div>
      ))}
      <div style={{ fontSize: 88, fontWeight: 700, color: GOLD, letterSpacing: 4 }}>
        {person.name.toUpperCase()}
      </div>
      <div style={{ fontSize: 36, marginTop: 24, maxWidth: 720, color: CYAN }}>{person.title}</div>
      <div style={{ fontSize: 28, marginTop: 24, color: INK }}>{person.location}</div>
    </div>,
    size,
  );
}
