/**
 * On-device AI bench: runs `utils/__tests__/fixtures/localAiBench/scenarios.json` through the real
 * `requestStructured` path (and the engine directly for text, to read its timings), scores each
 * reply with the pure `utils/localAiBench.ts` and shares the result as JSON.
 *
 * Reached from Debug → "Test: On-device AI". Dev builds only (this route group redirects in
 * production). Dev-mode Hermes distorts timings, so record numbers from a release build, and read
 * RAM, battery and temperature by hand (Xcode Instruments, `adb shell dumpsys meminfo`).
 */
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
import { useTheme } from '@/hooks/useTheme';
import { AiService } from '@/services/AiService';
import { generateWithLocalModel } from '@/services/localModels/llamaRuntime';
import scenariosFile from '@/utils/__tests__/fixtures/localAiBench/scenarios.json';
import { requestStructured } from '@/utils/coachAI';
import {
  type BenchScenario,
  type BenchScenarioFile,
  type BenchScore,
  scoreScenario,
} from '@/utils/localAiBench';

const file = scenariosFile as unknown as BenchScenarioFile;

type RunRow = {
  id: string;
  label: string;
  ms: number;
  score: BenchScore | null;
  timings?: unknown;
  error?: string;
};

export default function LocalAiBenchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const status = useOnDeviceStatus({ refresh: true });
  const [rows, setRows] = useState<RunRow[]>([]);
  const [running, setRunning] = useState(false);

  const runOne = async (scenario: BenchScenario): Promise<RunRow> => {
    const started = Date.now();
    try {
      if (scenario.kind === 'photo') {
        return {
          id: scenario.id,
          label: scenario.label,
          ms: 0,
          score: null,
          error: 'manual: run the photo set by hand',
        };
      }

      if (scenario.kind === 'structured') {
        const config = await AiService.getAiConfigForProvider('on-device');
        if (!config) {
          throw new Error('on-device AI is not ready');
        }

        const result = await requestStructured(config, {
          operation: `bench:${scenario.id}`,
          schemaName: scenario.id,
          systemPrompt: scenario.systemPrompt,
          history: [],
          userMessage: scenario.userMessage,
          buildSchema: () => scenario.schema as object,
        });
        const score =
          result.kind === 'ok'
            ? scoreScenario(scenario, result.value)
            : { schemaValid: false, fieldsCorrect: false, problems: ['malformed reply'] };

        return { id: scenario.id, label: scenario.label, ms: Date.now() - started, score };
      }

      const reply = await generateWithLocalModel({
        messages: [
          { role: 'system', content: scenario.systemPrompt },
          { role: 'user', content: scenario.userMessage },
        ],
      });

      return {
        id: scenario.id,
        label: scenario.label,
        ms: Date.now() - started,
        score: scoreScenario(scenario, reply.text),
        timings: reply.timings,
      };
    } catch (error) {
      return {
        id: scenario.id,
        label: scenario.label,
        ms: Date.now() - started,
        score: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const runAll = async () => {
    setRunning(true);
    setRows([]);
    for (const scenario of file.scenarios) {
      const row = await runOne(scenario);
      setRows((prev) => [...prev, row]);
    }

    setRunning(false);
  };

  const structured = rows.filter((row) => row.score?.schemaValid !== null && row.score);
  const validRate = structured.length
    ? Math.round(
        (structured.filter((row) => row.score?.schemaValid).length / structured.length) * 100
      )
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56, gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ color: theme.colors.text.primary, fontSize: 22, fontWeight: '700' }}>
          On-device AI bench
        </Text>
        <Text style={{ color: theme.colors.text.secondary }}>
          Engine {status.engine}, state {status.state}. Not supported, so not counted:{' '}
          {file.notSupported.join('; ')}.
        </Text>
        <Button
          label={running ? 'Running…' : 'Run all scenarios'}
          onPress={() => void runAll()}
          disabled={running || status.state !== 'ready'}
          variant="accent"
          width="full"
        />
        {running ? <ActivityIndicator /> : null}
        {validRate !== null ? (
          <Text style={{ color: theme.colors.text.primary }}>
            Valid structured output: {validRate}% (bar: 98%)
          </Text>
        ) : null}
        {rows.map((row) => (
          <View key={row.id} style={{ gap: 2 }}>
            <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>{row.label}</Text>
            <Text style={{ color: theme.colors.text.secondary }}>
              {row.ms} ms · schema {String(row.score?.schemaValid)} · fields{' '}
              {String(row.score?.fieldsCorrect)}
              {row.error ? ` · ${row.error}` : ''}
            </Text>
            {row.score?.problems.map((problem) => (
              <Text key={problem} style={{ color: theme.colors.status.error }}>
                {problem}
              </Text>
            ))}
          </View>
        ))}
        {rows.length ? (
          <Button
            label="Share result JSON"
            variant="outline"
            width="full"
            onPress={() =>
              void Share.share({
                message: JSON.stringify({ engine: status.engine, rows }, null, 2),
              })
            }
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
