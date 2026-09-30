const GAP = 16;

/**
 * Scroll offset that brings the card form above the keyboard.
 * If the whole form fits, align its bottom with the visible area.
 * Otherwise keep the focused field on screen.
 */
export function offsetToRevealForm(
  currentOffset: number,
  visibleHeight: number,
  fieldY: number,
  fieldHeight: number,
  formY: number,
  formHeight: number,
): number {
  if (visibleHeight <= 0) return currentOffset;

  const visibleBottom = currentOffset + visibleHeight;
  const fieldBottom = fieldY + fieldHeight;
  const formBottom = formY + formHeight;
  const formCovered = formY < currentOffset || formBottom + GAP > visibleBottom;
  const fieldCovered = fieldY < currentOffset || fieldBottom + GAP > visibleBottom;
  if (!formCovered && !fieldCovered) return currentOffset;

  const formTarget = Math.max(0, formBottom + GAP - visibleHeight);
  const fieldFits =
    fieldY >= formTarget && fieldBottom + GAP <= formTarget + visibleHeight;
  if (fieldFits) return formTarget;
  return Math.max(0, fieldBottom + GAP - visibleHeight);
}

export const FIELD_SCROLL_GAP = GAP;
