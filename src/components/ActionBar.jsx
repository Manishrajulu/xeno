export default function ActionBar({ onAutoFix, onAISuggest, onDownload, onSplitDownload, onDownloadAudit, aiLoading, totalErrors }) {
  return (
    <div className="action-bar">
      <div className="action-left">
        <button className="btn btn-fix" onClick={onAutoFix} disabled={totalErrors === 0}>
          🔧 Auto-fix all errors
        </button>
        <button className="btn btn-ai" onClick={onAISuggest} disabled={aiLoading || totalErrors === 0}>
          {aiLoading ? "⏳ Getting suggestions…" : "🤖 AI suggestions"}
        </button>
      </div>
      <div className="action-right">
        <button className="btn btn-download" onClick={onDownloadAudit} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" }}>
          📜 Download Audit Log
        </button>
        <button className="btn btn-download" onClick={onDownload}>
          ⬇ Download cleaned CSV
        </button>
        <button className="btn btn-split" onClick={onSplitDownload}>
          ✂️ Split & download (100 rows/file)
        </button>
      </div>
    </div>
  );
}
