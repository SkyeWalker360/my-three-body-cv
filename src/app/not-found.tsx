import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-pixel text-base text-gold">LOST IN SPACE</h1>
      <p className="mt-4 text-sm">That page drifted out of orbit.</p>
      <Link className="btn btn-cyan mt-8" href="/">
        BACK TO THE CV
      </Link>
    </main>
  );
}
