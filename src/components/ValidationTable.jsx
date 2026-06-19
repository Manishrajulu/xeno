import { useState } from "react";

export default function ValidationTable({ rows, headers, aiFixes, onCellUpdate }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const PAGE_SIZE = 20;

  const handleEditClick = (rowId, header, currentVal) => {
    setEditingCell({ rowId, header });
    setEditValue(currentVal || "");
  };

  const handleEditSave = () => {
    if (editingCell && onCellUpdate) {
      onCellUpdate(editingCell.rowId, editingCell.header, editValue);
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleEditSave();
    if (e.key === "Escape") setEditingCell(null);
  };

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
              return (
                <tr key={row._id} className={hasError ? "row-error" : "row-ok"}>
                  <td className="row-num">{row._id + 1}</td>
                  {headers.map((h) => {
                    const isEditing = editingCell?.rowId === row._id && editingCell?.header === h;
                    return (
                      <td 
                        key={h} 
                        className={`${errorFields.includes(h) ? "cell-error" : ""} ${isEditing ? "cell-editing" : "cell-editable"}`}
                        onClick={() => !isEditing && handleEditClick(row._id, h, row[h])}
                        title="Click to edit"
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            className="inline-edit-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleEditSave}
                            onKeyDown={handleKeyDown}
                          />
                        ) : (
                          row[h] || <span className="empty-cell">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    {hasError
                      ? <span className="badge-status error">✗ {row._errors.length} error{row._errors.length > 1 ? "s" : ""}</span>
                      : <span className="badge-status ok">✓ Valid</span>
                    }
                    {row._fixed && <span className="badge-fixed">auto-fixed</span>}
                    {row._editReason && <span className="badge-fixed" style={row._editReason === "AI Fix" ? { borderColor: '#14b8a6', color: '#0f766e', background: '#f0fdfa' } : { borderColor: 'var(--primary)', color: 'var(--primary)' }}>{row._editReason === "AI Fix" ? "ai-fixed" : "manually-edited"}</span>}
                  </td>
                  <td className="issues-cell">
                    <div className="issue-inline-list">
                      {row._errors.map((e, i) => (
                        <div key={i} style={{ display: 'inline-block', marginBottom: '2px', marginRight: '8px' }}>
                          <span className="issue-badge">{e.field}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-2)', marginLeft: '4px' }}>{e.message}</span>
                          {aiFixes && aiFixes[`${e.field}::${row[e.field]}`] && aiFixes[`${e.field}::${row[e.field]}`] !== row[e.field] && (
                            <span className="ai-suggestion" style={{ display: 'inline-block', marginLeft: '6px', marginTop: 0, padding: '2px 6px' }}>
                              <span style={{ fontWeight: 600, marginRight: '4px' }}>AI Predicts:</span> {aiFixes[`${e.field}::${row[e.field]}`]}
                              <button 
                                className="btn-magic" 
                                onClick={() => onCellUpdate && onCellUpdate(row._id, e.field, aiFixes[`${e.field}::${row[e.field]}`], "AI Fix")}
                                style={{ marginLeft: '6px', padding: '2px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #14b8a6', background: '#f0fdfa', color: '#0f766e', cursor: 'pointer', fontWeight: 600 }}
                              >
                                 Apply Fix
                              </button>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
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
