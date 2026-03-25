import os
import re

files = [
    'components/MealSection.tsx',
    'components/PhaseWheel.tsx',
    'components/cards/InfoCard.tsx',
    'components/cards/PhysiologicalInsightsCard.tsx',
    'components/modals/CycleLogModal.tsx'
]

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()

    # Fix the syntax error: const theme = useTheme(); inside the parameter list
    # e.g. function Name({ const theme = useTheme(); ... }) -> function Name({ ... }) { const theme = useTheme();

    # Pattern to find function or const function with { const theme = useTheme();
    pattern = re.compile(r'(\(function\s+\w+\s*\(|\bfunction\s+\w+\s*\(|\w+\s*=\s*\([^)]*\)\s*=>\s*)\{\s*const\s+theme\s+=\s+useTheme\(\);', re.DOTALL)

    # This is tricky because of the different ways functions are defined.
    # Let's try a simpler approach for these specific files.

    # Fix MealSection.tsx
    if 'MealSection.tsx' in filepath:
        content = content.replace('const theme = useTheme();\n  const { t, i18n } = useTranslation();\n  const { t } = useTranslation();\n  title,', 'title,')
        content = content.replace('menuButton,\n}: MealSectionHeaderProps) {\n\n  return (', 'menuButton,\n}: MealSectionHeaderProps) {\n  const theme = useTheme();\n  const { t, i18n } = useTranslation();\n  return (')
        content = content.replace('function AddFoodButton({ mealType, onPress }: AddFoodButtonProps) {\n  const theme = useTheme();\n  const { t, i18n } = useTranslation();\n  const { t } = useTranslation();', 'function AddFoodButton({ mealType, onPress }: AddFoodButtonProps) {\n  const theme = useTheme();\n  const { t } = useTranslation();')

    # Fix PhaseWheel.tsx
    if 'PhaseWheel.tsx' in filepath:
        content = content.replace('export function PhaseWheel({\n  const theme = useTheme();\n  const { t } = useTranslation();\n  currentPhase,', 'export function PhaseWheel({\n  currentPhase,')
        content = content.replace('avgPeriodDuration = 5,\n}: PhaseWheelProps) {\n\n  // Calculate phases', 'avgPeriodDuration = 5,\n}: PhaseWheelProps) {\n  const theme = useTheme();\n  const { t } = useTranslation();\n  // Calculate phases')

    # Fix InfoCard.tsx
    if 'InfoCard.tsx' in filepath:
        content = content.replace('export function InfoCard({\n  const theme = useTheme();\n  variant,', 'export function InfoCard({\n  variant,')
        content = content.replace('size = \'md\',\n}: InsightCardProps) {', 'size = \'md\',\n}: InsightCardProps) {\n  const theme = useTheme();')

    # Fix PhysiologicalInsightsCard.tsx
    if 'PhysiologicalInsightsCard.tsx' in filepath:
        content = content.replace('export function PhysiologicalInsightsCard({\n  const theme = useTheme();\n  type,', 'export function PhysiologicalInsightsCard({\n  type,')
        content = content.replace('trend,\n}: PhysiologicalInsightsCardProps) {', 'trend,\n}: PhysiologicalInsightsCardProps) {\n  const theme = useTheme();')

    # Fix CycleLogModal.tsx
    if 'CycleLogModal.tsx' in filepath:
        content = content.replace('export function CycleLogModal({ visible, onClose, initialDate }: CycleLogModalProps) {\n  const theme = useTheme();\n  const { t } = useTranslation();', 'export function CycleLogModal({ visible, onClose, initialDate }: CycleLogModalProps) {\n  const theme = useTheme();\n  const { t } = useTranslation();')

    with open(filepath, 'w') as f:
        f.write(content)
