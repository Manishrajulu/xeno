export default function ActionBar({ onAutoFix, onAISuggest, onDownload, onSplitDownload, onViewAudit, aiLoading, totalErrors }) {
  return (
    <div className="action-bar">
      <div className="action-left">
        <button className="btn btn-fix" onClick={onAutoFix} disabled={totalErrors === 0}>
          Auto-fix all errors
        </button>
        <button className={`btn btn-ai ${aiLoading ? "loading" : ""}`} onClick={onAISuggest} disabled={aiLoading || totalErrors === 0}>
          {aiLoading ? "Generating AI Fixes…" : "Generate AI Fixes"}
        </button>
      </div>
      <div className="action-right">
        <button className="btn btn-split" onClick={onViewAudit}>
          View Audit Log
        </button>
        <button className="btn btn-download" onClick={onDownload}>
          Download cleaned CSV
        </button>
        <button className="btn btn-split" onClick={onSplitDownload} title="Automatically scales chunk size based on total rows">
          Smart Split & Download
        </button>
      </div>
    </div>
  );
}
