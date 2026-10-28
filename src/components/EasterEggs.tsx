'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { emit, on } from '@/lib/events';
import { hasFinePointer, prefersReducedMotion } from '@/lib/motion';

// Every Easter egg is a separate chunk, loaded on idle or on first use, never during the
// initial render, so the CV itself ships almost no JavaScript.
const ThreeBodyCanvas = dynamic(() => import('@/features/three-body/Canvas'), { ssr: false });
const ShipCursor = dynamic(() => import('@/features/cursor/ShipCursor'), { ssr: false });
const Terminal = dynamic(() => import('@/features/karl/Terminal'), { ssr: false });
const ShooterOverlay = dynamic(() => import('@/features/shooter/Overlay'), { ssr: false });
const Scanner = dynamic(() => import('@/features/field-scanner/Scanner'), { ssr: false });
const Deck = dynamic(() => import('@/features/three-body/deck/Deck'), { ssr: false });
const Inspection = dynamic(() => import('@/features/inspection/Inspection'), { ssr: false });

/** True while the user is typing, so M only toggles inspection mode outside text fields. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

export default function EasterEggs() {
  const [background, setBackground] = useState(false);
  const [cursor, setCursor] = useState(false);
  const [karl, setKarl] = useState<{ command?: string } | null>(null);
  const [shooter, setShooter] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [inspection, setInspection] = useState(false);
  const [deck, setDeck] = useState<{ view?: 'deck' | 'lab' } | null>(null);

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
    const offScanner = on('scanner:open', () => setScanner(true));
    const offInspection = on('inspection:toggle', () => setInspection(true));
    const offDeck = on('deck:open', (d) => setDeck((v) => v ?? d));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'm' && e.key !== 'M') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e.target)) return;
      if (document.querySelector('dialog[open]')) return;
      emit('inspection:toggle');
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelIdle();
      offKarl();
      offShooter();
      offScanner();
      offInspection();
      offDeck();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <>
      {background && <ThreeBodyCanvas />}
      {cursor && <ShipCursor />}
      {karl && <Terminal initialCommand={karl.command} />}
      {shooter && <ShooterOverlay autoStart />}
      {scanner && <Scanner />}
      {inspection && <Inspection />}
      {deck && <Deck initialView={deck.view} />}
    </>
  );
}
