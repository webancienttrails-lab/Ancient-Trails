export function shouldOpenTableRow(event: { target: EventTarget | null }) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return true;
  }

  return !target.closest(
    "a, button, input, label, select, textarea, [role='button'], [data-actions]"
  );
}
