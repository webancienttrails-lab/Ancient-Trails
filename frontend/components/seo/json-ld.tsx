export function serializeJsonLd(data: Record<string, unknown> | Record<string, unknown>[]) {
  // Prevent content from terminating the script element when parsed as HTML.
  return JSON.stringify(data).replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data, id }: { data: Record<string, unknown> | Record<string, unknown>[] | null; id?: string }) {
  if (!data) return null;
  return <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
