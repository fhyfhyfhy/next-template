const startMarker = "/* @example-config */";
const endMarker = "/* @end-example-config */";

/**
 * Replaces only the example's initial config; the imports, interaction and JSX
 * come from the file that runs.
 */
export function formatExampleSource(source: string, config: object): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (
    start < 0 ||
    end <= start ||
    source.indexOf(startMarker, start + 1) !== -1 ||
    source.indexOf(endMarker, end + 1) !== -1
  ) {
    throw new Error("Expected one ordered example config marker pair");
  }
  const json = JSON.stringify(config, null, 2)
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  return (
    source.slice(0, start + startMarker.length) +
    " " +
    json +
    " " +
    source.slice(end)
  );
}
