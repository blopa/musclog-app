/**
 * Re-slotting a workout plan's membership after the user drags its order around.
 *
 * The plan editor only renders the members whose workout it can still find in the library — one
 * whose workout was archived stays in the draft so saving does not silently unfile it, but it has
 * nothing to draw and so cannot take part in a reorder. `orderedTemplateIds` therefore describes
 * the VISIBLE rows only, and those rows have to land back among the members that were never shown.
 */

/**
 * Applies `orderedTemplateIds` to `members`, leaving members it does not name exactly where they
 * are. The named members are dealt back into the slots they collectively occupied, in the given
 * order, so an unrendered member keeps its absolute position rather than being pushed to an end.
 *
 * Ids that match no member are ignored, and members the ids do not mention are untouched — the
 * result is always a permutation of the input.
 */
export function reorderPlanMembers<T extends { templateId: string }>(
  members: T[],
  orderedTemplateIds: string[]
): T[] {
  // Deduped so a repeated id cannot deal one member into two slots and drop another.
  const reordered = [...new Set(orderedTemplateIds)].flatMap((templateId) => {
    const member = members.find((candidate) => candidate.templateId === templateId);
    return member ? [member] : [];
  });

  const moved = new Set(reordered.map((member) => member.templateId));
  let next = 0;

  return members.map((member) => (moved.has(member.templateId) ? reordered[next++] : member));
}
