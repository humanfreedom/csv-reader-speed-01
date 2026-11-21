// solve.js — a fast drop-in for csv-reader 1.0.0 (make.fun csv-reader-speed-01).
// Original work. One left-to-right scan: indexOf jumps between delimiters and
// field values are sliced out of the text, never built a character at a time.
// Returns exactly csv-reader 1.0.0's answer {columns, rows, errors}.

const QUOTE = 34; // "
const COMMA = 44; // ,
const LF = 10; // \n
const CR = 13; // \r
const FEFF = 0xFEFF;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === FEFF) pos = 1;

  let recordLine = 1;
  let recordRow = -1; // -1 means null (the header record)

  while (true) {
    // Skip lines left with no characters.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === LF) { pos += 1; line += 1; }
      else if (c === CR && pos + 1 < n && text.charCodeAt(pos + 1) === LF) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= n) break;

    recordLine = line;
    const isHeader = header && columns === null;
    recordRow = isHeader ? -1 : rows.length;
    const rowOut = recordRow < 0 ? null : recordRow;

    let fields = [];
    let quoted = false;
    let ended = 0; // 0 = comma, 1 = line break, 2 = end of text

    do {
      // ---- one field ----
      let value;
      let needScan = false; // run the unquoted scan below
      let junkCheck = false; // the scan is quote junk: error when it keeps a character
      if (text.charCodeAt(pos) === QUOTE) {
        quoted = true;
        const open = pos;
        const openLine = line;
        // Find the closing quote: the next quote not doubled.
        let q = pos + 1;
        let hasEsc = false;
        for (;;) {
          q = text.indexOf('"', q);
          if (q < 0) break;
          if (text.charCodeAt(q + 1) === QUOTE) { hasEsc = true; q += 2; continue; }
          break;
        }
        if (q < 0) {
          // Never closes: literal quote, re-read as unquoted from open + 1.
          errors.push({ code: 'unterminated_quote', line: recordLine, row: rowOut });
          pos = open + 1;
          line = openLine;
          value = '"';
          needScan = true;
        } else {
          const content = text.slice(open + 1, q);
          const hasNL = content.indexOf('\n') !== -1;
          const hasCR = content.indexOf('\r') !== -1;
          if (!hasNL && !hasCR) {
            value = hasEsc ? content.replaceAll('""', '"') : content;
          } else {
            // Content holds line breaks (and maybe escapes): build it, counting lines.
            let v = '';
            let s = 0;
            let i = s;
            const m = content.length;
            while (i < m) {
              const c = content.charCodeAt(i);
              if (c === QUOTE) {
                if (i > s) v += content.slice(s, i);
                v += '"';
                i += 2;
                s = i;
              } else if (c === CR) {
                if (i > s) v += content.slice(s, i);
                v += '\n';
                line += 1;
                i += (i + 1 < m && content.charCodeAt(i + 1) === LF) ? 2 : 1;
                s = i;
              } else if (c === LF) {
                if (i > s) v += content.slice(s, i);
                v += '\n';
                line += 1;
                i += 1;
                s = i;
              } else {
                i += 1;
              }
            }
            if (m > s) v += content.slice(s, m);
            value = v;
          }
          pos = q + 1;
          if (pos >= n) {
            ended = 2;
          } else {
            const c = text.charCodeAt(pos);
            if (c === COMMA) { pos += 1; ended = 0; }
            else if (c === LF) { pos += 1; line += 1; ended = 1; }
            else if (c === CR && pos + 1 < n && text.charCodeAt(pos + 1) === LF) { pos += 2; line += 1; ended = 1; }
            else { needScan = true; junkCheck = true; }
          }
        }
      } else {
        quoted = false;
        value = '';
        needScan = true;
      }

      if (needScan) {
        // Unquoted scan from pos, appending to value. The field ends at the
        // first comma or LF (a CR before that LF is the CRLF); a CR inside the
        // field is a lone CR, dropped with a stray_cr error. Finding the end
        // needs only two indexOf calls; a stray CR is found by scanning the
        // short slice, never by an unbounded search (in an LF file that would
        // run to the end of the text).
        let added = 0;
        const iComma = text.indexOf(',', pos);
        const iLF = text.indexOf('\n', pos);
        let end = n;
        let kind = 2; // 0 comma, 1 LF, 2 end
        if (iComma !== -1 && iComma < end) { end = iComma; kind = 0; }
        if (iLF !== -1 && iLF < end) { end = iLF; kind = 1; }
        let contentEnd = end;
        if (kind === 1 && end > pos && text.charCodeAt(end - 1) === CR) contentEnd = end - 1;
        if (contentEnd > pos) {
          const content = text.slice(pos, contentEnd);
          if (content.indexOf('\r') === -1) {
            if (value === '') value = content; else value += content;
            added += content.length;
          } else {
            // Lone CRs: drop each (stray_cr) and keep the rest.
            const parts = content.split('\r');
            for (let k = 1; k < parts.length; k++) {
              errors.push({ code: 'stray_cr', line: recordLine, row: rowOut });
            }
            const kept = parts.join('');
            if (kept !== '') {
              if (value === '') value = kept; else value += kept;
              added += kept.length;
            }
          }
        }
        if (kind === 0) { pos = end + 1; ended = 0; }
        else if (kind === 1) { pos = end + 1; line += 1; ended = 1; }
        else { pos = n; ended = 2; }
        if (junkCheck && added > 0) {
          errors.push({ code: 'quote_junk', line: recordLine, row: rowOut });
        }
      }

      fields.push(value);
    } while (ended === 0);

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: rowOut, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: rowOut, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
