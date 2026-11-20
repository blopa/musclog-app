// One command: the whole offline pipeline (shortlist snapshot is read from fixtures/, nothing is fetched here).
import { main as models } from './bench-models.ts';
import { main as images } from './bench-images.ts';

const m = await models(['--reps', '2']);
const i = await images(['--photos', '6']);
console.log(`dry-run complete: ${m.recs.length} model calls, ${i.recs.length} image calls, mock spend $${(m.spent + i.spent).toFixed(4)}`);
