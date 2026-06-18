import { useCallback, useState } from "react";

export default function Upload({ onFile }) {
  const [dragging, setDragging] = useState(false);

  const handle = useCallback((file) => {
    if (file && file.name.endsWith(".csv")) onFile(file);
    else alert("Please upload a .csv file");
  }, [onFile]);

  return (
    <div className="upload-wrapper">
      <div className="upload-hero">
        <h1>Transaction Data Validator</h1>
        <p>Upload a CSV to validate phone numbers, dates, emails, and data integrity — then download a cleaned file.</p>
      </div>
      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById("fileInput").click()}
      >
        <div className="drop-icon">⬡</div>
        <p className="drop-label">Drop your CSV here</p>
        <p className="drop-sub">or click to browse</p>
        <input
          id="fileInput" type="file" accept=".csv" hidden
          onChange={(e) => handle(e.target.files[0])}
        />
      </div>
    </div>
  );
}
