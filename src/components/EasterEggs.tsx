'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { on } from '@/lib/events';
import { hasFinePointer, prefersReducedMotion } from '@/lib/motion';

// Every Easter egg is a separate chunk, loaded on idle or on first use, never during the
// initial render, so the CV itself ships almost no JavaScript.
const ThreeBodyCanvas = dynamic(() => import('@/features/three-body/Canvas'), { ssr: false });
const ShipCursor = dynamic(() => import('@/features/cursor/ShipCursor'), { ssr: false });
const Terminal = dynamic(() => import('@/features/karl/Terminal'), { ssr: false });
const ShooterOverlay = dynamic(() => import('@/features/shooter/Overlay'), { ssr: false });

export default function EasterEggs() {
  const [background, setBackground] = useState(false);
  const [cursor, setCursor] = useState(false);
  const [karl, setKarl] = useState<{ command?: string } | null>(null);
  const [shooter, setShooter] = useState(false);

  useEffect(() => {
    const load = () => {
      setBackground(true);
      if (hasFinePointer() && !prefersReducedMotion()) setCursor(true);
    };
    let cancelIdle: () => void;
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(load, { timeout: 2000 });
      cancelIdle = () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(load, 300);
      cancelIdle = () => clearTimeout(id);
    }
    // The first request mounts the feature; after that, the feature listens for itself.
    const offKarl = on('karl:open', (d) => setKarl((k) => k ?? d ?? {}));
    const offShooter = on('shooter:launch', () => setShooter(true));
    return () => {
      cancelIdle();
      offKarl();
      offShooter();
    };
  }, []);

  return (
    <>
      {background && <ThreeBodyCanvas />}
      {cursor && <ShipCursor />}
      {karl && <Terminal initialCommand={karl.command} />}
      {shooter && <ShooterOverlay autoStart />}
    </>
  );
}
