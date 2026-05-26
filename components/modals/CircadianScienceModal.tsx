import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, ScrollView, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { localDayStartMs } from '@/utils/calendarDate';

import { FullScreenModal } from './FullScreenModal';

// ---------------------------------------------------------------------------
// Shared constants (mirrors CaloriesBurnedCard — kept in sync manually)
// ---------------------------------------------------------------------------

const BLOCK_FRACTIONS = {
    earlySlеep: 0.095,
    nadir: 0.085,
    morning: 0.195,
    midday: 0.225,
    peak: 0.25,
    evening: 0.15,
} as const;

type BlockKey = keyof typeof BLOCK_FRACTIONS;

const BLOCK_DURATION = 240; // minutes

const CIRCADIAN_SEGMENTS = [
    { start: 0,    end: 180,  blockKey: 'earlySlеep' as BlockKey },
    { start: 180,  end: 420,  blockKey: 'nadir'      as BlockKey },
    { start: 420,  end: 660,  blockKey: 'morning'    as BlockKey },
    { start: 660,  end: 900,  blockKey: 'midday'     as BlockKey },
    { start: 900,  end: 1140, blockKey: 'peak'       as BlockKey },
    { start: 1140, end: 1380, blockKey: 'evening'    as BlockKey },
    { start: 1380, end: 1440, blockKey: 'earlySlеep' as BlockKey },
] as const;

// Canonical display order for the 6 blocks (no midnight split).
const BLOCK_ORDER: BlockKey[] = ['earlySlеep', 'nadir', 'morning', 'midday', 'peak', 'evening'];

function getCircadianCaloriesBurned(tdee: number, minutesSinceMidnight: number): number {
    let burned = 0;
    for (const seg of CIRCADIAN_SEGMENTS) {
        if (minutesSinceMidnight <= seg.start) break;
        const rate = BLOCK_FRACTIONS[seg.blockKey] / BLOCK_DURATION;
        const elapsed = Math.min(minutesSinceMidnight, seg.end) - seg.start;
        burned += elapsed * rate * tdee;
    }
    return burned; // keep fractional for live display
}

function getCurrentBlockKey(minutesSinceMidnight: number): BlockKey {
    for (const seg of CIRCADIAN_SEGMENTS) {
        if (minutesSinceMidnight < seg.end) return seg.blockKey;
    }
    return CIRCADIAN_SEGMENTS[CIRCADIAN_SEGMENTS.length - 1].blockKey;
}

function getInstantRate(tdee: number, blockKey: BlockKey) {
    const ratePerMin = (BLOCK_FRACTIONS[blockKey] / BLOCK_DURATION) * tdee;
    return {
        perHour: ratePerMin * 60,
        perMinute: ratePerMin,
        perSecond: ratePerMin / 60,
    };
}

function getNow() {
    return (Date.now() - localDayStartMs(new Date())) / 60_000;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LiveDot() {
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, [opacity]);

    return (
        <Animated.View
            style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#00FFA3',
                opacity,
            }}
        />
    );
}

function RateStat({ label, value }: { label: string; value: string }) {
    const theme = useTheme();
    return (
        <View
            className="flex-1 items-center rounded-2xl py-3"
            style={{
                backgroundColor: theme.colors.background.card,
                borderWidth: 1,
                borderColor: theme.colors.background.white5,
            }}
        >
            <Text className="text-base font-bold text-white">{value}</Text>
            <Text className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.colors.text.secondary }}>
                {label}
            </Text>
        </View>
    );
}

function PhaseCard({
    blockKey,
    isActive,
    tdee,
}: {
    blockKey: BlockKey;
    isActive: boolean;
    tdee: number;
}) {
    const { t } = useTranslation();
    const theme = useTheme();

    const PHASE_COLOR: Record<BlockKey, { color: string; bg: string }> = {
        earlySlеep: { color: theme.colors.status.info,         bg: theme.colors.status.info10         },
        nadir:      { color: theme.colors.status.indigo,       bg: theme.colors.status.indigo10        },
        morning:    { color: theme.colors.status.amber,        bg: theme.colors.status.amber10         },
        midday:     { color: theme.colors.status.emeraldLight, bg: theme.colors.status.emerald10       },
        peak:       { color: theme.colors.status.warning,      bg: theme.colors.status.warning10       },
        evening:    { color: theme.colors.status.purple,       bg: theme.colors.status.purple10        },
    };

    const { color, bg } = PHASE_COLOR[blockKey];
    const pct = Math.round(BLOCK_FRACTIONS[blockKey] * 100 * 10) / 10;
    const kcalForBlock = Math.round(BLOCK_FRACTIONS[blockKey] * tdee);

    return (
        <View
            className="mb-3 overflow-hidden rounded-2xl"
            style={{
                backgroundColor: isActive ? bg : theme.colors.background.card,
                borderWidth: 1,
                borderColor: isActive ? color + '55' : theme.colors.background.white5,
            }}
        >
            <View className="flex-row items-start gap-3 p-4">
                {/* Color bar */}
                <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: color }} />

                <View className="flex-1">
                    {/* Header row */}
                    <View className="mb-1 flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                            {isActive ? <LiveDot /> : null}
                            <Text className="text-sm font-bold text-white">
                                {t(`progress.circadianPhase.${blockKey}`)}
                            </Text>
                        </View>
                        <View
                            className="rounded-full px-2.5 py-0.5"
                            style={{ backgroundColor: color + '22' }}
                        >
                            <Text className="text-[10px] font-bold" style={{ color }}>
                                {pct}% · ~{kcalForBlock} kcal
                            </Text>
                        </View>
                    </View>

                    {/* Time */}
                    <Text className="mb-1.5 text-[11px]" style={{ color: theme.colors.text.secondary }}>
                        {t(`progress.circadianModal.phaseTime.${blockKey}`)}
                    </Text>

                    {/* Description */}
                    <Text className="text-xs leading-relaxed" style={{ color: isActive ? '#D1D5DB' : theme.colors.text.secondary }}>
                        {t(`progress.circadianModal.phaseDesc.${blockKey}`)}
                    </Text>
                </View>
            </View>
        </View>
    );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

type Props = {
    visible: boolean;
    onClose: () => void;
    tdee: number;
};

export function CircadianScienceModal({ visible, onClose, tdee }: Props) {
    const { t } = useTranslation();
    const theme = useTheme();
    const { formatInteger, formatDecimal } = useFormatAppNumber();

    const [minutesSinceMidnight, setMinutesSinceMidnight] = useState(getNow);

    // Update every second while modal is visible.
    useEffect(() => {
        if (!visible) return;
        setMinutesSinceMidnight(getNow());
        const id = setInterval(() => setMinutesSinceMidnight(getNow()), 1_000);
        return () => clearInterval(id);
    }, [visible]);

    const burned = getCircadianCaloriesBurned(tdee, minutesSinceMidnight);
    const currentBlockKey = getCurrentBlockKey(minutesSinceMidnight);
    const { perHour, perMinute, perSecond } = getInstantRate(tdee, currentBlockKey);

    return (
        <FullScreenModal
            visible={visible}
            onClose={onClose}
            title={t('progress.circadianModal.title')}
            subtitle={t('progress.circadianModal.subtitle')}
            scrollable={false}
        >
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* ── Hero: live counter ─────────────────────────────────── */}
                <LinearGradient
                    colors={[theme.colors.accent.primary10, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 }}
                >
                    <View className="flex-row items-center gap-2">
                        <LiveDot />
                        <Text
                            className="text-[10px] font-bold uppercase tracking-widest"
                            style={{ color: theme.colors.accent.primary }}
                        >
                            {t('progress.circadianModal.liveCounter')}
                        </Text>
                    </View>

                    <Text
                        className="mt-2 font-bold tracking-tight text-white"
                        style={{ fontSize: 52, lineHeight: 56 }}
                    >
                        {formatInteger(Math.floor(burned))}
                        <Text style={{ fontSize: 22, fontWeight: '400', color: theme.colors.text.secondary }}>
                            {' '}kcal
                        </Text>
                    </Text>
                </LinearGradient>

                <View className="px-5">
                    {/* ── Rate stats row ─────────────────────────────────── */}
                    <View className="mb-5 flex-row gap-2">
                        <RateStat
                            label={t('progress.circadianModal.perHour')}
                            value={`${formatInteger(Math.round(perHour))}`}
                        />
                        <RateStat
                            label={t('progress.circadianModal.perMinute')}
                            value={formatDecimal(perMinute, 1)}
                        />
                        <RateStat
                            label={t('progress.circadianModal.perSecond')}
                            value={formatDecimal(perSecond, 3)}
                        />
                    </View>

                    {/* ── Phase breakdown ────────────────────────────────── */}
                    <Text
                        className="mb-3 text-xs font-bold uppercase tracking-widest"
                        style={{ color: theme.colors.text.secondary }}
                    >
                        {t('progress.circadianModal.allPhases')}
                    </Text>

                    {BLOCK_ORDER.map((key) => (
                        <PhaseCard
                            key={key}
                            blockKey={key}
                            isActive={key === currentBlockKey}
                            tdee={tdee}
                        />
                    ))}

                    {/* ── Science note ───────────────────────────────────── */}
                    <View
                        className="mt-2 rounded-2xl p-4"
                        style={{
                            backgroundColor: theme.colors.background.card,
                            borderWidth: 1,
                            borderColor: theme.colors.background.white5,
                        }}
                    >
                        <Text
                            className="text-[11px] leading-relaxed"
                            style={{ color: theme.colors.text.secondary }}
                        >
                            {t('progress.circadianModal.scienceNote')}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </FullScreenModal>
    );
}
