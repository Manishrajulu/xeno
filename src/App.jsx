import { useState, useCallback } from "react";
import Papa from "papaparse";
import Upload from "./components/Upload";
import Dashboard from "./components/Dashboard";
import ValidationTable from "./components/ValidationTable";
import ActionBar from "./components/ActionBar";
import AuditLogModal from "./components/AuditLogModal";
import { validateRow, autoFixRow, guessFieldType } from "./utils/validators";
import "./modal.css";

export default function App() {
  const [raw, setRaw] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [stage, setStage] = useState("upload"); // upload | analyzing | results
  const [analyzingStage, setAnalyzingStage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFixes, setAiFixes] = useState(null);
  const [aiInsight, setAiInsight] = useState("");
  const [showAuditLog, setShowAuditLog] = useState(false);
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
        
        const apiKey = import.meta.env.VITE_GROQ_API_KEY?.trim();
        if (apiKey) {
           try {
             const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
               method: "POST", headers: { 
                 "Authorization": `Bearer ${apiKey}`,
                 "Content-Type": "application/json" 
               },
               body: JSON.stringify({
                 model: "llama-3.1-8b-instant",
                 response_format: { type: "json_object" },
                 messages: [
                   { role: "system", content: "You are a data validation assistant. Respond ONLY with a valid JSON object mapping raw to standard. Example: {\"raw_header\": \"Standard Header\"}. Keep original if no match. Always start with { and end with }." },
                   { role: "user", content: `Map these raw CSV headers to a standard schema if possible.\nStandard headers: Phone, Email, Date, Amount, Payment Mode, Country.\nRaw headers: ${JSON.stringify(hdrs)}.` }
                 ]
               }),
             });
             if (!res.ok) {
                const errData = await res.json().catch(()=>({}));
                console.error("Groq Header Map Error:", errData);
                throw new Error(errData.error?.message || "Status " + res.status);
             }
             const data = await res.json();
             const text = data?.choices?.[0]?.message?.content || "{}";
             const clean = text.replace(/```json|```/g, "").trim();
             const mapping = JSON.parse(clean);
             
             const usedHeaders = new Set();
             hdrs = hdrs.map(h => {
                 let mapped = mapping[h] || h;
                 let finalName = mapped;
                 let i = 1;
                 while (usedHeaders.has(finalName)) {
                     finalName = `${mapped} (${i})`;
                     i++;
                 }
                 usedHeaders.add(finalName);
                 mapping[h] = finalName; // update mapping so row data matches!
                 return finalName;
             });
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
           try {
             setAiInsight("Generating AI insight...");
             const uniqueErrors = Array.from(new Set(validated.flatMap(r => r._errors.map(e => e.message))));
             const insightPrompt = `Analyze this dataset health. Total rows: ${total}, Valid: ${validCount}, Invalid: ${total - validCount}. Error types found: ${uniqueErrors.join(", ")}. Give a strictly 2-sentence summary of the dataset quality and what needs the most attention. Do not give any introduction.`;
             const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
               method: "POST", headers: { 
                 "Authorization": `Bearer ${apiKey}`,
                 "Content-Type": "application/json" 
               },
               body: JSON.stringify({
                 model: "llama-3.1-8b-instant",
                 messages: [{ role: "user", content: insightPrompt }]
               })
             });
             const data = await res.json();
             if (data.choices && data.choices.length > 0) {
               setAiInsight(data.choices[0].message.content.trim());
             } else {
               setAiInsight("Unable to generate insight at this time.");
             }
           } catch(e) {
             console.error("AI Insight failed", e);
             setAiInsight("AI insight generation failed.");
           }
        }
        setStage("results");
      },
    });
  }, []);

  const handleAutoFix = () => {
    const newLogs = [];
    const newRows = rows.map((row) => {
      const originalRow = { ...row };
      const fixed = autoFixRow({ ...row }, headers);
      let wasModified = false;
      
      headers.forEach(h => {
        if (originalRow[h] !== fixed[h]) {
          wasModified = true;
          newLogs.push({
            row: originalRow._id + 1,
            field: h,
            from: originalRow[h] || "empty",
            to: fixed[h],
            reason: "Auto-Fix"
          });
        }
      });
      
      return { ...fixed, _errors: validateRow(fixed, headers), _fixed: wasModified || row._fixed };
    });
    
    setRows(newRows);
    if (newLogs.length > 0) {
      setAuditLog(prev => [...prev, ...newLogs]);
    }
  };

  const handleCellUpdate = (rowId, header, newValue, customReason = "Manual Edit") => {
    let logEntry = null;
    const newRows = rows.map(row => {
      if (row._id === rowId) {
        const oldVal = row[header];
        if (oldVal === newValue) return row; // No change
        
        const updatedRow = { ...row, [header]: newValue, _manuallyFixed: true };
        updatedRow._errors = validateRow(updatedRow, headers);
        
        logEntry = {
          row: rowId + 1,
          field: header,
          from: oldVal || "empty",
          to: newValue,
          reason: customReason,
          timestamp: new Date().toLocaleTimeString()
        };
        
        return updatedRow;
      }
      return row;
    });

    if (logEntry) {
      setRows(newRows);
      setAuditLog(prev => [...prev, logEntry]);
    }
  };

  const handleAIFixes = async () => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY?.trim();
    if (!apiKey) return alert("Please set VITE_GROQ_API_KEY in your .env file.");
    
    const badValuesMap = new Map();
    rows.forEach(r => {
      r._errors.forEach(e => {
        const val = r[e.field];
        if (val !== undefined && val !== null) {
          const id = `${e.field}::${val}`;
          if (!badValuesMap.has(id)) {
            badValuesMap.set(id, { id, value: val, field: e.field, error: e.message });
          }
        }
      });
    });

    const badValues = Array.from(badValuesMap.values());
    if (!badValues.length) return alert("No correctable errors found!");
    setAiLoading(true);
    let allFixes = {};
    try {
      const chunks = [];
      for (let i = 0; i < badValues.length; i += 15) {
        chunks.push(badValues.slice(i, i + 15));
      }

      const promises = chunks.map(async (chunk) => {
        try {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { 
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json" 
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: "You are an automated data repair bot. Given a list of bad data values and their error context, predict the correct formatting. Return ONLY a valid JSON object mapping the exact 'id' string to the corrected value string. If a value cannot be confidently fixed, map it to null. Example: {\"email::john.doe\": \"john.doe@example.com\"}. Always start with { and end with }."
                },
                {
                  role: "user",
                  content: `Fix these bad values:\n${JSON.stringify(chunk)}\nFormat exactly as a single JSON object mapping "id" to the predicted string.`
                }
              ]
            }),
          });
          if (!res.ok) {
             const errData = await res.json().catch(()=>({}));
             console.error("Groq Suggest Error for chunk:", errData);
             return {}; // Skip this chunk on error
          }
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content || "{}";
          const clean = text.replace(/```json|```/g, "").trim();
          return JSON.parse(clean);
        } catch (e) {
          console.error("Chunk processing failed", e);
          return {};
        }
      });

      const results = await Promise.all(promises);
      results.forEach(fixes => {
        allFixes = { ...allFixes, ...fixes };
      });
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to fetch AI fixes.");
    }
    setAiFixes(allFixes);
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
    setShowAuditLog(false);
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
            <span className="logo-text">Xeno Data Validator</span>
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
              onAISuggest={handleAIFixes}
              onDownload={handleDownload}
              onSplitDownload={handleSplitDownload}
              onDownloadAudit={handleDownloadAudit}
              onViewAudit={() => setShowAuditLog(true)}
              aiLoading={aiLoading}
              totalErrors={totalErrors}
            />
            <ValidationTable
              rows={rows}
              headers={headers}
              aiFixes={aiFixes}
              onCellUpdate={handleCellUpdate}
            />
          </>
        )}
      </main>

      {showAuditLog && (
        <AuditLogModal 
          auditLog={auditLog} 
          onClose={() => setShowAuditLog(false)} 
        />
      )}
    </div>
  );
}
