import { useState } from "react";

export default function ValidationTable({ rows, headers, aiSuggestions }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const filtered = rows.filter((r) => {
    if (filter === "valid") return r._errors.length === 0;
    if (filter === "invalid") return r._errors.length > 0;
    return true;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="table-section">
      <div className="table-toolbar">
        <div className="filter-tabs">
          {["all", "invalid", "valid"].map((f) => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? "active" : ""}`}
              onClick={() => { setFilter(f); setPage(0); }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "invalid" && <span className="badge-red">{rows.filter(r => r._errors.length > 0).length}</span>}
              {f === "valid" && <span className="badge-green">{rows.filter(r => r._errors.length === 0).length}</span>}
            </button>
          ))}
        </div>
        <span className="table-count">{filtered.length} rows</span>
      </div>

      <div className="table-wrap">
        <table className="vtable">
          <thead>
            <tr>
              <th>#</th>
              {headers.map((h) => <th key={h}>{h}</th>)}
              <th>Status</th>
              <th>Issues</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((row) => {
              const hasError = row._errors.length > 0;
              const errorFields = row._errors.map((e) => e.field);
              const suggestions = aiSuggestions[row._id];
              return (
                <tr key={row._id} className={hasError ? "row-error" : "row-ok"}>
                  <td className="row-num">{row._id + 1}</td>
                  {headers.map((h) => (
                    <td key={h} className={errorFields.includes(h) ? "cell-error" : ""}>
                      {row[h] || <span className="empty-cell">—</span>}
                    </td>
                  ))}
                  <td>
                    {hasError
                      ? <span className="badge-status error">✗ {row._errors.length} error{row._errors.length > 1 ? "s" : ""}</span>
                      : <span className="badge-status ok">✓ Valid</span>
                    }
                    {row._fixed && <span className="badge-fixed">auto-fixed</span>}
                  </td>
                  <td className="issues-cell">
                    {row._errors.map((e, i) => (
                      <div key={i} className="issue-item">
                        <span className="issue-field">{e.field}:</span> {e.message}
                        {suggestions && suggestions[e.field] && (
                          <div className="ai-suggestion">
                            🤖 {suggestions[e.field]}
                          </div>
                        )}
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>Next →</button>
        </div>
      )}
    </div>
  );
}
