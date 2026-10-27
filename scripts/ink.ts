import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Compiler } from 'inkjs/compiler/Compiler';

/**
 * Inline INCLUDEs ourselves so the build needs no compiler file handler. An included file's
 * declarations (EXTERNAL, VAR) go before the act's content; its knots go after, so they
 * can't swallow the act's top-level text.
 */
export function resolveIncludes(path: string): string {
  const head: string[] = [];
  const tail: string[] = [];
  const body: string[] = [];
  for (const l of readFileSync(path, 'utf8').split('\n')) {
    const m = l.match(/^\s*INCLUDE\s+(.+?)\s*$/);
    if (!m) {
      body.push(l);
      continue;
    }
    const included = readFileSync(join(dirname(path), m[1]!), 'utf8');
    const split = included.search(/^===/m);
    head.push(split < 0 ? included : included.slice(0, split));
    if (split >= 0) tail.push(included.slice(split));
  }
  return [...head, body.join('\n'), ...tail].join('\n\n');
}

/** Compile an .ink file to the story JSON string the inkjs runtime loads. */
export function compileInk(path: string): string {
  const compiler = new Compiler(resolveIncludes(path));
  let story: ReturnType<Compiler['Compile']> | undefined;
  try {
    story = compiler.Compile();
  } catch (e) {
    const details = compiler.errors.length ? compiler.errors.join('\n') : String(e);
    throw new Error(`Failed to compile ${path}:\n${details}`);
  }
  if (compiler.errors.length) {
    throw new Error(`Failed to compile ${path}:\n${compiler.errors.join('\n')}`);
  }
  const json = story.ToJson();
  if (typeof json !== 'string') throw new Error(`No JSON produced for ${path}`);
  return json;
}
