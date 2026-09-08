export function shouldOpenTableRow(event: { target: EventTarget | null }) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return true;
  }

  return !target.closest(
    [
      "a",
      "button",
      "input",
      "label",
      "select",
      "textarea",
      "[role='button']",
      "[role='menuitem']",
      "[data-actions]",
      "[data-slot='dropdown-menu-content']",
      "[data-slot='dropdown-menu-item']",
    ].join(", ")
  );
}
