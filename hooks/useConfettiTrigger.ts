import { ConfettiActivity, useConfettiInteractions } from '@/context/ConfettiInteractionsContext';

export function useConfettiTrigger() {
  const { triggerConfetti, isConfettiActive } = useConfettiInteractions();

  return { triggerConfetti, showConfetti: isConfettiActive };
}
