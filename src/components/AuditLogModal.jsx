import Papa from "papaparse";

export default function AuditLogModal({ auditLog, onClose }) {
  const handleDownload = () => {
    if (auditLog.length === 0) return alert("No changes to download.");
    const csv = Papa.unparse(auditLog);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; 
    a.download = "audit_log.csv"; 
    a.click();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>Audit Log</h2>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {auditLog.length === 0 ? (
            <p className="empty-msg">No automatic changes have been made yet.</p>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 'none' }}>
              <table className="vtable">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Field</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((log, i) => (
                    <tr key={i}>
                      <td>{log.row}</td>
                      <td style={{ fontWeight: 500 }}>{log.field}</td>
                      <td style={{ color: "var(--red)" }}>{log.from}</td>
                      <td style={{ color: "var(--green)" }}>{log.to}</td>
                      <td><span className="badge-fixed">{log.reason}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-split" onClick={handleDownload} disabled={auditLog.length === 0}>
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}
