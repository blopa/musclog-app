/**
 * Voice routing benchmark, run through the APP'S OWN payload builder, parser and resolver against a
 * llama-server. Copy into the app as scripts/__tests__/zz-voice-bench.test.ts and run:
 *   BENCH_DIR=<this folder> BENCH_PORT=8091 BENCH_LABEL=450m BENCH_SETS=2,3,5 \
 *     npx jest --selectProjects node --runTestsByPath scripts/__tests__/zz-voice-bench.test.ts
 */
import fs from 'fs';
import http from 'http';

import { toEngineMessages, toEngineTools } from '@/services/localModels/localToolMessages';
import {
  buildNativeVoiceTools,
  nativeVoiceExamples,
  nativeVoiceReply,
} from '@/utils/voiceCommand/nativeTools';
import { parseVoiceCommands } from '@/utils/voiceCommand/parse';
import { resolveVoiceCommand } from '@/utils/voiceCommand/tools';
import { activeVoiceTools, DEFAULT_VOICE_TOOL_SELECTION } from '@/utils/voiceCommand/toolSelection';

const KINDS: Record<string, string> = {
  copy_meal: 'copyMeal',
  search_food: 'searchFood',
  log_weight: 'logWeight',
  log_meal: 'logMeal',
  add_note: 'addNote',
  go_to: 'goTo',
};

/** Payload variants tried while tuning; the empty variant is what the app sends. */
function vary(variant: string, messages: any[]): any[] {
  const preamble = messages.slice(0, 4);
  const blocks: any[][] = [];
  for (let i = 4; i < messages.length; i += 4) blocks.push(messages.slice(i, i + 4));
  const flat = (list: any[][]) => list.flat();
  let out = [...preamble, ...flat(blocks)];
  for (const name of variant.split('+').filter(Boolean)) {
    const pre = out.slice(0, 4);
    const rest = out.slice(4);
    const bl: any[][] = [];
    for (let i = 0; i < rest.length; ) {
      let j = i + 1;
      while (j < rest.length && rest[j].role !== 'user') j++;
      bl.push(rest.slice(i, j));
      i = j;
    }
    if (name === 'noPreamble') out = rest;
    if (name === 'reverse') out = [...pre, ...flat([...bl].reverse())];
    if (name === 'noDone') out = [...pre, ...flat(bl.map((b) => b.slice(0, 3)))];
    if (name === 'onePerTool') {
      const seen = new Set<string>();
      out = [...pre, ...flat(bl.filter((b) => { const n = b[1].tool_calls[0].function.name; if (seen.has(n)) return false; seen.add(n); return true; }))];
    }
    if (name === 'greetOnly') out = [...pre.slice(0, 2), ...rest];
    const ofTool = (b: any[]) => b[1].tool_calls[0].function.name;
    if (name === 'noWeightExample') out = [...pre, ...flat(bl.filter((b) => ofTool(b) !== 'log_weight'))];
    if (name === 'weightFirst') out = [...pre, ...flat([...bl.filter((b) => ofTool(b) === 'log_weight'), ...bl.filter((b) => ofTool(b) !== 'log_weight')])];
    if (name === 'weightMiddle') out = [...pre, ...flat([...bl.filter((b) => ofTool(b) === 'copy_meal'), ...bl.filter((b) => ofTool(b) === 'log_weight'), ...bl.filter((b) => ofTool(b) === 'search_food')])];
    if (name === 'searchTwice') {
      const search = bl.filter((b) => ofTool(b) === 'search_food');
      out = [...pre, ...flat(bl), ...flat(search.map((b) => b.map((m, i) => i === 0 ? { ...m, content: 'Add two apples to lunch' } : i === 1 ? { ...m, tool_calls: [{ ...m.tool_calls[0], id: 'call_9', function: { ...m.tool_calls[0].function, arguments: '{"food":"apples","meal":"lunch"}' } }] } : i === 2 ? { ...m, tool_call_id: 'call_9' } : m)))];
    }
    // The 1.2B's template ignores `tool_calls`: write each example call as the model itself does.
    if (name === 'inline') out = out.map((m) => m.tool_calls ? { role: 'assistant', content: `<|tool_call_start|>[${m.tool_calls.map((c: any) => `${c.function.name}(${Object.entries(JSON.parse(c.function.arguments)).map(([k, v]) => `${k}="${v}"`).join(', ')})`).join(', ')}]<|tool_call_end|>` } : m);
    if (name === 'sys') out = [{ role: 'system', content: 'You turn what a person says to a fitness app into a tool call. Call a tool whenever they ask to do something.' }, ...out];
  }

  return out;
}

const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function post(port: number, body: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const request = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (response) => {
        let text = '';
        response.on('data', (chunk) => (text += chunk));
        response.on('end', () => {
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(new Error(text));
          }
        });
      }
    );
    request.on('error', reject);
    request.end(data);
  });
}

function argsMatch(
  want: Record<string, any>,
  action: any,
  command: any,
  sentence: string
): boolean {
  return Object.entries(want).every(([key, value]) => {
    if (key === 'food') {
      return action.kind !== 'searchFood' || fold(action.query).includes(value);
    }
    if (key === 'body') {
      return fold(action.body).includes(fold(value));
    }
    if (key === 'value') {
      // The action holds kilograms; a case said in pounds expects the pounds figure.
      const kilograms = /pound|\blbs?\b/i.test(sentence) ? value * 0.45359237 : value;

      return Math.abs(action.weightKg - kilograms) < 0.01;
    }
    if (key === 'screen') {
      return action.screen === value;
    }
    if (key === 'mealType') {
      return action.mealType === undefined || action.mealType === value;
    }

    return command[key] === value;
  });
}

it(
  'benchmarks voice routing',
  async () => {
    const dir = process.env.BENCH_DIR as string;
    const port = Number(process.env.BENCH_PORT);
    const label = process.env.BENCH_LABEL as string;
    const cases = JSON.parse(fs.readFileSync(`${dir}/cases.json`, 'utf8'));
    const summary: string[] = [];
    for (const size of (process.env.BENCH_SETS as string).split(',').map(Number)) {
      const offered = activeVoiceTools(DEFAULT_VOICE_TOOL_SELECTION, size);
      const variant = process.env.BENCH_VARIANT ?? '';
      const examples = vary(variant, toEngineMessages(nativeVoiceExamples(offered)) as any[]);
      const tools = toEngineTools(buildNativeVoiceTools(offered));
      const rows: any[] = [];
      for (const { set, text, accept, args } of cases) {
        const response = await post(port, {
          messages: [...examples, { role: 'user', content: text }],
          tools,
          tool_choice: 'auto',
          temperature: 0,
          max_tokens: 1024,
          cache_prompt: true,
        });
        const message = response.choices[0].message;
        const toolCalls = (message.tool_calls ?? []).map((call: any, index: number) => ({
          id: `c${index}`,
          name: call.function.name,
          arguments: call.function.arguments ?? '',
        }));
        const reply = nativeVoiceReply({ text: message.content ?? '', toolCalls });
        const command = reply ? parseVoiceCommands(reply, offered)?.[0] : undefined;
        const resolution = command
          ? resolveVoiceCommand(command, {
              now: new Date(),
              transcript: text,
              weightUnit: 'kg',
            })
          : undefined;
        const action: any = resolution?.ok ? resolution.action : null;
        const accepted = accept.filter((tool: string) => offered.includes(tool as never));
        let tag = 'OK';
        if (accepted.length === 0) {
          tag = action ? 'WRONG' : 'OK';
        } else if (!action) {
          tag = 'MISS';
        } else if (
          !accepted.some((tool: string) => KINDS[tool] === action.kind) ||
          !argsMatch(args, action, command, text)
        ) {
          tag = 'WRONG';
        }
        rows.push({ set, text, accept: accepted, tag, call: toolCalls[0] ?? message.content, action });
      }
      fs.writeFileSync(`${dir}/${label}_${size}tools${variant ? `_${variant}` : ''}.json`, JSON.stringify(rows, null, 1));
      const count = (filter: (row: any) => boolean) => {
        const subset = rows.filter(filter);

        return `${subset.filter((r) => r.tag === 'OK').length}/${subset.length} ok, ${subset.filter((r) => r.tag === 'WRONG').length} wrong, ${subset.filter((r) => r.tag === 'MISS').length} missed`;
      };
      summary.push(`== ${label} ${size} tools ${variant} [${offered.join(',')}]`);
      summary.push(`   old37: ${count((r) => r.set === 'old37')}`);
      summary.push(`   all:   ${count(() => true)}`);
      for (const tool of Object.keys(KINDS).filter((t) => offered.includes(t as never))) {
        summary.push(`   ${tool}: ${count((r) => r.accept.includes(tool))}`);
      }
      summary.push(`   not-a-command: ${count((r) => r.accept.length === 0)}`);
    }
    fs.writeFileSync(`${dir}/${label}${process.env.BENCH_VARIANT ? `_${process.env.BENCH_VARIANT}` : ''}_summary.txt`, summary.join('\n') + '\n');
  },
  900000
);
