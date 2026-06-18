import { useState, useCallback } from "react";
import Papa from "papaparse";
import Upload from "./components/Upload";
import Dashboard from "./components/Dashboard";
import ValidationTable from "./components/ValidationTable";
import ActionBar from "./components/ActionBar";
import { validateRow, autoFixRow, guessFieldType } from "./utils/validators";

export default function App() {
  const [raw, setRaw] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [stage, setStage] = useState("upload"); // upload | analyzing | results
  const [analyzingStage, setAnalyzingStage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [aiInsight, setAiInsight] = useState("");
  const [auditLog, setAuditLog] = useState([]);
  const [initialStats, setInitialStats] = useState(null);

  const handleFile = useCallback((file) => {
    setStage("analyzing");
    setAnalyzingStage("Mapping Headers...");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        let hdrs = result.meta.fields || [];
        let rawData = result.data;
        
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
        if (apiKey) {
           try {
             const prompt = `Map these raw CSV headers to a standard schema if possible. 
             Standard headers: Phone, Email, Date, Amount, Payment Mode, Country.
             Raw headers: ${JSON.stringify(hdrs)}.
             Return ONLY a JSON object mapping raw to standard: {"raw_header": "Standard Header"}. Keep original if no match. No markdown.`;
             const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
               method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
             });
             const data = await res.json();
             const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
             const clean = text.replace(/```json|```/g, "").trim();
             const mapping = JSON.parse(clean);
             
             hdrs = hdrs.map(h => mapping[h] || h);
             rawData = rawData.map(row => {
               const newRow = {};
               for (const key in row) {
                 newRow[mapping[key] || key] = row[key];
               }
               return newRow;
             });
           } catch(e) { console.error("Header mapping failed", e); }
        }

        setAnalyzingStage("Validating & Detecting Anomalies...");
        const validated = rawData.map((row, i) => ({
          _id: i,
          ...row,
          _errors: validateRow(row, hdrs),
          _fixed: false,
        }));
        
        // Statistical Anomaly Detection
        const amountHeaders = hdrs.filter(h => guessFieldType(h) === "amount");
        amountHeaders.forEach(h => {
          const validAmounts = validated.map(r => parseFloat(r[h])).filter(v => !isNaN(v));
          if (validAmounts.length > 0) {
            const mean = validAmounts.reduce((a,b) => a+b, 0) / validAmounts.length;
            const variance = validAmounts.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / validAmounts.length;
            const stdDev = Math.sqrt(variance);
            
            validated.forEach(r => {
              const val = parseFloat(r[h]);
              if (!isNaN(val) && (val > mean + 3 * stdDev || val < mean - 3 * stdDev)) {
                r._errors.push({ field: h, message: `Suspicious Anomaly (Statistical outlier). Value ${val} is far from average ${mean.toFixed(2)}` });
              }
            });
          }
        });
        
        const validCount = validated.filter((r) => r._errors.length === 0).length;
        const total = validated.length;
        setInitialStats({ valid: validCount, invalid: total - validCount, score: total > 0 ? Math.round((validCount / total) * 100) : 100 });
        
        setHeaders(hdrs);
        setRaw(rawData);
        setRows(validated);

        if (apiKey) {
           setAnalyzingStage("Generating AI Insights...");
           try {
             const statsStr = `Total: ${total}, Valid: ${validCount}, Invalid: ${total - validCount}. Errors: ${JSON.stringify(validated.flatMap(r=>r._errors.map(e=>e.field)).reduce((acc, f) => { acc[f]=(acc[f]||0)+1; return acc; }, {}))}`;
             const prompt = `You are a data analyst. Give a 2-3 sentence high-level business insight summary of this dataset's health based on these stats: ${statsStr}. Focus on the biggest issues. No markdown formatting.`;
             const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
               method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
             });
             const data = await res.json();
             const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
             setAiInsight(text.trim());
           } catch(e) {}
        }
        
        setStage("results");
      },
    });
  }, []);

  const handleAutoFix = () => {
    const newLogs = [];
    setRows((prev) =>
      prev.map((row) => {
        const originalRow = { ...row };
        const fixed = autoFixRow({ ...row }, headers);
        
        headers.forEach(h => {
          if (originalRow[h] !== fixed[h]) {
            newLogs.push({
              row: originalRow._id + 1,
              field: h,
              from: originalRow[h] || "empty",
              to: fixed[h],
              reason: "Auto-Fix",
            });
          }
        });

        return { ...fixed, _errors: validateRow(fixed, headers), _fixed: true };
      })
    );
    if (newLogs.length > 0) {
      setAuditLog(prev => [...prev, ...newLogs]);
    }
  };

  const handleAISuggest = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
    if (!apiKey) return alert("Please set VITE_GEMINI_API_KEY in your .env file.");
    const errorRows = rows.filter((r) => r._errors.length > 0).slice(0, 5);
    if (!errorRows.length) return alert("No errors found to suggest fixes for!");
    setAiLoading(true);
    let suggestions = {};
    try {
      const payloadData = errorRows.map(row => ({
        id: row._id,
        errors: row._errors,
        data: Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith("_")))
      }));
      const prompt = `You are a data validation assistant. Here are ${payloadData.length} CSV rows with errors:
${JSON.stringify(payloadData)}
Suggest a short fix for each error in plain English. 
Respond ONLY with a single JSON object mapping the row ID to an object of field_name and suggested fixes.
Format exactly like this: {"row_id_1": {"field_name": "suggested fix"}, "row_id_2": {"field_name": "suggested fix"}}. 
No markdown formatting, no explanations, just the JSON.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (!res.ok) {
         if (res.status === 429) throw new Error("Rate limit exceeded. Please wait a minute before trying again.");
         if (res.status === 503) throw new Error("Google AI servers are currently overloaded. Please try again later.");
         throw new Error("API request failed with status " + res.status);
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      suggestions = JSON.parse(clean);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to fetch AI suggestions.");
      errorRows.forEach(row => { suggestions[row._id] = { error: "Could not fetch suggestion" }; });
    }
    setAiSuggestions(suggestions);
    setAiLoading(false);
  };

  const handleDownload = () => {
    const clean = rows.map((row) => {
      const r = { ...row };
      delete r._id; delete r._errors; delete r._fixed;
      return r;
    });
    const csv = Papa.unparse(clean);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "validated_data.csv"; a.click();
  };

  const handleSplitDownload = () => {
    const clean = rows.map((row) => {
      const r = { ...row };
      delete r._id; delete r._errors; delete r._fixed;
      return r;
    });
    const chunkSize = 100;
    for (let i = 0; i < clean.length; i += chunkSize) {
      const chunk = clean.slice(i, i + chunkSize);
      const csv = Papa.unparse(chunk);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `validated_part_${Math.floor(i / chunkSize) + 1}.csv`;
      a.click();
    }
  };

  const handleDownloadAudit = () => {
    if (auditLog.length === 0) return alert("No automatic changes have been made yet.");
    const csv = Papa.unparse(auditLog);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "audit_log.csv"; a.click();
  };

  const handleReset = () => {
    setRaw([]); setHeaders([]); setRows([]);
    setAiSuggestions({}); setStage("upload");
    setAuditLog([]); setInitialStats(null); setAiInsight("");
  };

  const totalErrors = rows.reduce((s, r) => s + r._errors.length, 0);
  const validRows = rows.filter((r) => r._errors.length === 0).length;
  const invalidRows = rows.filter((r) => r._errors.length > 0).length;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⬡</span>
            <span className="logo-text">DataGuard</span>
            <span className="logo-tag">by Xeno</span>
          </div>
          {stage === "results" && (
            <button className="btn-ghost" onClick={handleReset}>↩ New file</button>
          )}
        </div>
      </header>

      <main className="main">
        {stage === "upload" && <Upload onFile={handleFile} />}
        {stage === "analyzing" && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <h2 style={{ fontSize: "24px", color: "#374151" }}>{analyzingStage}</h2>
            <p style={{ color: "#6b7280", marginTop: "10px" }}>Please wait while we process your data...</p>
          </div>
        )}
        {stage === "results" && (
          <>
            <Dashboard
              total={rows.length}
              valid={validRows}
              invalid={invalidRows}
              totalErrors={totalErrors}
              headers={headers}
              rows={rows}
              initialStats={initialStats}
              aiInsight={aiInsight}
            />
            <ActionBar
              onAutoFix={handleAutoFix}
              onAISuggest={handleAISuggest}
              onDownload={handleDownload}
              onSplitDownload={handleSplitDownload}
              onDownloadAudit={handleDownloadAudit}
              aiLoading={aiLoading}
              totalErrors={totalErrors}
            />
            <ValidationTable
              rows={rows}
              headers={headers}
              aiSuggestions={aiSuggestions}
            />
          </>
        )}
      </main>
    </div>
  );
}
