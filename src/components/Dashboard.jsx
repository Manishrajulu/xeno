import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function Dashboard({ total, valid, invalid, totalErrors, headers, rows, initialStats, aiInsight }) {
  const pieData = [
    { name: "Valid rows", value: valid },
    { name: "Invalid rows", value: invalid },
  ];

  const fieldErrorCounts = headers.map((h) => ({
    name: h.length > 12 ? h.slice(0, 12) + "…" : h,
    errors: rows.reduce((s, r) => s + r._errors.filter((e) => e.field === h).length, 0),
  })).filter((f) => f.errors > 0);

  const healthScore = total > 0 ? Math.round((valid / total) * 100) : 100;

  return (
    <div className="dashboard">
      {aiInsight && (
        <div className="ai-insight-panel" style={{ backgroundColor: "#f0fdfa", padding: "15px", borderRadius: "8px", border: "1px solid #ccfbf1", marginBottom: "20px" }}>
          <h4 style={{ margin: "0 0 5px 0", color: "#0f766e", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🤖</span> AI Dataset Insights
          </h4>
          <p style={{ margin: 0, color: "#115e59", fontSize: "14px", lineHeight: "1.5" }}>{aiInsight}</p>
        </div>
      )}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Total rows</span>
          <span className="stat-value">{total}</span>
        </div>
        <div className="stat-card stat-green">
          <span className="stat-label">Valid rows</span>
          <span className="stat-value">{valid}</span>
        </div>
        <div className="stat-card stat-red">
          <span className="stat-label">Invalid rows</span>
          <span className="stat-value">{invalid}</span>
        </div>
        <div className={`stat-card ${healthScore >= 80 ? "stat-green" : healthScore >= 50 ? "stat-amber" : "stat-red"}`}>
          <span className="stat-label">Health score</span>
          <span className="stat-value">
            {initialStats && initialStats.score !== healthScore ? (
              <>
                <span style={{ textDecoration: "line-through", opacity: 0.5, fontSize: "0.7em", marginRight: "8px" }}>{initialStats.score}%</span>
                <span>{healthScore}%</span>
              </>
            ) : (
              <span>{healthScore}%</span>
            )}
          </span>
        </div>
        <div className="stat-card stat-red">
          <span className="stat-label">Total errors</span>
          <span className="stat-value">{totalErrors}</span>
        </div>
      </div>

      {total > 0 && (
        <div className="charts-row">
          <div className="chart-card">
            <p className="chart-title">Row quality</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="legend">
              <span><span className="dot green"></span>Valid ({valid})</span>
              <span><span className="dot red"></span>Invalid ({invalid})</span>
            </div>
          </div>

          {fieldErrorCounts.length > 0 && (
            <div className="chart-card chart-wide">
              <p className="chart-title">Errors by column</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={fieldErrorCounts} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="errors" fill="#f97316" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
