// RFC 4180 quoting, including commas, escaped quotes, CRLF and multiline fields.
export function parseCSV(input, filename = "CSV") {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  const s = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed)
        throw new Error(
          `${filename}: unexpected quote at record ${rows.length + 1}`,
        );
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else {
      if (closed)
        throw new Error(
          `${filename}: text after closing quote at record ${rows.length + 1}`,
        );
      cell += c;
    }
  }
  if (quoted) throw new Error(`${filename}: unclosed quoted field`);
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift();
  if (!headers?.length || new Set(headers).size !== headers.length)
    throw new Error(`${filename}: missing or duplicate headers`);
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(
        `${filename}: row ${i + 2} has ${r.length} columns, expected ${headers.length}`,
      );
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
  });
}
export function stringifyCSV(rows, headers = Object.keys(rows[0] || {})) {
  const quote = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [headers, ...rows.map((r) => headers.map((h) => r[h]))]
      .map((r) => r.map(quote).join(","))
      .join("\r\n") +
    "\r\n"
  );
}
