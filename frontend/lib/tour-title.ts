/** Capitalise lowercase words while retaining proper names and acronyms. */
export function formatTourTitle(title: string): string {
  return title.trim().replace(/\p{L}[\p{L}\p{M}\p{N}'’-]*/gu, word =>
    word === word.toLocaleLowerCase("en-IN")
      ? word.charAt(0).toLocaleUpperCase("en-IN") + word.slice(1)
      : word
  );
}
