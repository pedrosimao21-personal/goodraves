/**
 * Helpers for making buttons that sit next to text inputs respond to the FIRST
 * tap on mobile.
 *
 * The problem: while an input holds focus the on-screen keyboard is open.
 * Tapping a button blurs the input, which dismisses the keyboard, which grows
 * the visual viewport and reflows the page — and that happens *between*
 * `pointerdown` and `click`. The button moves out from under the finger, so the
 * click never lands on it and the tap appears to do nothing. The second tap
 * works because the keyboard is already closed and the layout is settled.
 */

function isTextEntryElement(node: Element | null): boolean {
  return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement;
}

/**
 * Use as an `onPointerDown` handler on a button that may be tapped while a text
 * field has focus. Suppresses the default focus shift so the keyboard stays up
 * for the duration of the tap, letting the `click` land on the button.
 *
 * Deliberately scoped to "a text field is currently focused": that's the only
 * case that triggers the reflow, so ordinary taps — and scroll gestures that
 * start on the button — keep their normal behaviour.
 */
export function keepKeyboardOpenOnTap(event: React.PointerEvent<HTMLElement>): void {
  if (isTextEntryElement(document.activeElement)) {
    event.preventDefault();
  }
}

/**
 * Blur whatever text field is focused, closing the on-screen keyboard. Pair
 * with `keepKeyboardOpenOnTap` so the keyboard still dismisses once the action
 * has actually run, rather than staying open over the results.
 */
export function dismissKeyboard(): void {
  const active = document.activeElement;
  if (isTextEntryElement(active)) {
    (active as HTMLElement).blur();
  }
}
