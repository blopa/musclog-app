// Offline cost estimate for a live run, from the pinned snapshot prices (pessimistic token assumptions).
//   tsx scripts/estimate-cost.ts --models a,b --reps 3 --photos 60 --settings 16
import { parseArgs, pickModels } from './lib/core.ts';

const a = parseArgs();
const models = pickModels(a.str('models'));
const reps = a.num('reps', 3);
const photos = a.num('photos', 60);
const settings = a.num('settings', 16); // full + 5 edges x 3 qualities

// Meal photo call: system + schema + image in, JSON + reasoning out.
const IMG = { prompt: 1500 + 1100, completion: 450 + 600 };
// One rep of bench-models: [input tokens, output tokens incl. reasoning] per call
// (meal photo, label photo, 2 track_meal, workout plan, 3 coach chats, 2 tool round trips = 2 calls each).
const REP_CALLS = [
  [2600, 1050], [2300, 450], [900, 900], [900, 900], [1400, 2500], [500, 600], [500, 600], [500, 600], [700, 400], [700, 300], [800, 400], [800, 300],
];

let totalModels = 0;
let totalImages = 0;
console.log('model | models-bench USD | images-bench USD (calls)');
for (const m of models) {
  const cost = (i: number, o: number) => (i * m.promptPer1M + o * m.completionPer1M) / 1e6;
  const mb = reps * REP_CALLS.reduce((s, [i, o]) => s + cost(i, o), 0);
  const calls = photos * settings + 1;
  const ib = calls * cost(IMG.prompt, IMG.completion);
  totalModels += mb;
  totalImages += ib;
  console.log(`${m.id} | ${mb.toFixed(3)} | ${ib.toFixed(2)} (${calls})`);
}
console.log(`TOTAL models-bench ${totalModels.toFixed(2)}, images-bench ${totalImages.toFixed(2)}, together ${(totalModels + totalImages).toFixed(2)} USD (plus 5.5% credit fee, $0.80 minimum per purchase)`);
