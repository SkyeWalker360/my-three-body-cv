import { readFileSync, writeFileSync } from 'node:fs';
import { parseRamps, toGpl } from './palette-lib';

const css = readFileSync('src/app/globals.css', 'utf8');
writeFileSync('design/three-body-cv.gpl', toGpl(parseRamps(css)));
console.log('Wrote design/three-body-cv.gpl');
