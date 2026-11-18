/** Shared tooltip body for every chart. */
export function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="min-w-40 rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs shadow-card">
      <p className="mb-1.5 max-w-64 font-semibold text-charcoal">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex justify-between gap-4 text-muted">
          <span>{r.label}</span>
          <span className="font-medium tabular-nums text-charcoal">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Visually hidden table: the screen-reader twin of a chart. The sr-only class sits on a
 * wrapper div because tables ignore a 1px height and would otherwise stretch the page.
 */
export function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
