import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  ChevronRight,
  Target,
  Zap,
  AlertTriangle,
  Activity,
  Trophy,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { CHART_COLORS } from "./shared/themeConfig";
import "./Dashboard.css";

const Dashboard = ({ colors, isDarkMode, isEvaluating }) => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000/reports")
      .then((res) => setReports(res.data))
      .catch((err) => console.error(err));
  }, [isEvaluating]);

  // ── Derived stats ──────────────────────────────────────
  const total = reports.length;
  const avg =
    total > 0
      ? Math.round(
          reports.reduce(
            (a, r) => a + (r.evaluation_report?.total_score_out_of_50 || 0),
            0,
          ) / total,
        )
      : 0;
  const best =
    total > 0
      ? Math.max(
          ...reports.map(
            (r) => r.evaluation_report?.total_score_out_of_50 || 0,
          ),
        )
      : 0;

  const recent10 = [...reports]
    .slice(0, 10)
    .reverse()
    .map((r, i) => ({
      name: `S-${i + 1}`,
      date: new Date(r.timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      score: r.evaluation_report?.total_score_out_of_50 || 0,
      fullData: r,
    }));

  const pieData = [
    {
      name: "Elite (40-50)",
      value: reports.filter(
        (r) => (r.evaluation_report?.total_score_out_of_50 || 0) >= 40,
      ).length,
    },
    {
      name: "Proficient (30-39)",
      value: reports.filter((r) => {
        const s = r.evaluation_report?.total_score_out_of_50 || 0;
        return s >= 30 && s < 40;
      }).length,
    },
    {
      name: "Learner (0-29)",
      value: reports.filter(
        (r) => (r.evaluation_report?.total_score_out_of_50 || 0) < 30,
      ).length,
    },
  ].filter((d) => d.value > 0);

  const last35 = Array.from({ length: 35 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (34 - i));
    return d.toDateString();
  });
  const dateSet = reports.map((r) => new Date(r.timestamp).toDateString());
  const heatColor = (n) => {
    if (n === 0) return isDarkMode ? "#1f2937" : "#ebedf0";
    if (n === 1) return isDarkMode ? "#064e3b" : "#9be9a8";
    if (n === 2) return isDarkMode ? "#059669" : "#40c463";
    if (n === 3) return isDarkMode ? "#10b981" : "#30a14e";
    return isDarkMode ? "#34d399" : "#216e39";
  };

  const Tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    return (
      <div
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          padding: "10px 14px",
          borderRadius: "8px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
          color: "var(--text)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: 3 }}>
          {p.payload.date || p.name}
        </div>
        <div style={{ fontWeight: 700, color: p.color || "var(--text)" }}>
          {p.name.includes("Elite") ||
          p.name.includes("Proficient") ||
          p.name.includes("Learner")
            ? `${p.value} Sessions`
            : `Score: ${p.value}/50`}
        </div>
      </div>
    );
  };

  const empty = (label) => (
    <div
      style={{
        opacity: 0.3,
        textAlign: "center",
        margin: "auto",
        padding: "40px 0",
        fontSize: "0.85rem",
      }}
    >
      {label}
    </div>
  );

  return (
    <>
      <div className="dash-scroller">
        <div className="dash-max-width">
          {/* Page header */}
          <div style={{ marginBottom: 4 }}>
            <h1
              style={{
                fontFamily: "Bricolage Grotesque",
                fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
                letterSpacing: "-1px",
                margin: 0,
                color: "var(--text)",
              }}
            >
              Mastery Center
            </h1>
            <p
              style={{
                opacity: 0.45,
                marginTop: 5,
                fontSize: "0.9rem",
                color: "var(--text)",
              }}
            >
              Visualizing your cognitive progression.
            </p>
          </div>

          {/* KPI row */}
          <div className="bento-row-top">
            <div className="dash-card">
              <Activity className="kpi-icon" size={72} />
              <div className="dash-card-title">
                <Activity size={16} /> Total Sessions
              </div>
              <div className="kpi-value">{total}</div>
            </div>
            <div className="dash-card">
              <Target className="kpi-icon" size={72} />
              <div className="dash-card-title">
                <Target size={16} /> Avg Score
              </div>
              <div className="kpi-value" style={{ color: "#3B82F6" }}>
                {avg}
                <span
                  style={{
                    fontSize: "1rem",
                    opacity: 0.4,
                    color: "var(--text)",
                  }}
                >
                  /50
                </span>
              </div>
            </div>
            <div className="dash-card">
              <Trophy className="kpi-icon" size={72} />
              <div className="dash-card-title">
                <Trophy size={16} /> Highest Score
              </div>
              <div className="kpi-value" style={{ color: "#10B981" }}>
                {best}
              </div>
            </div>
          </div>

          {/* Area + Pie */}
          <div className="bento-row-charts">
            <div className="dash-card" style={{ paddingBottom: 14 }}>
              <div className="dash-card-title">
                <TrendingUp size={16} /> Mastery Trajectory
              </div>
              {recent10.length < 2 ? (
                empty("Need at least 2 sessions")
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart
                    data={recent10}
                    margin={{ top: 8, right: 8, left: -28, bottom: 0 }}
                    onClick={(d) =>
                      d?.activePayload &&
                      setSelectedReport(d.activePayload[0].payload.fullData)
                    }
                  >
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#2563EB"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="#2563EB"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                      tick={{
                        fontSize: 11,
                        fill: "var(--text)",
                        opacity: 0.55,
                      }}
                      dy={8}
                    />
                    <YAxis
                      domain={[0, 50]}
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 11,
                        fill: "var(--text)",
                        opacity: 0.55,
                      }}
                    />
                    <Tooltip
                      content={<Tip />}
                      cursor={{
                        stroke: "var(--border)",
                        strokeWidth: 2,
                        strokeDasharray: "5 5",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#grad)"
                      activeDot={{
                        r: 5,
                        fill: "var(--bg)",
                        stroke: "#2563EB",
                        strokeWidth: 2.5,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="dash-card">
              <div className="dash-card-title">
                <PieChartIcon size={16} /> Score Distribution
              </div>
              {pieData.length === 0 ? (
                empty("No data yet")
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<Tip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={34}
                      iconType="circle"
                      wrapperStyle={{
                        fontSize: "0.78rem",
                        opacity: 0.75,
                        paddingTop: 8,
                        color: "var(--text)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Heatmap + Bar */}
          <div className="bento-row-bot">
            <div className="dash-card">
              <div className="dash-card-title">
                <Zap size={16} /> 35-Day Consistency
              </div>
              <div className="heat-grid">
                {last35.map((d, i) => {
                  const n = dateSet.filter((x) => x === d).length;
                  return (
                    <div
                      key={i}
                      className="heat-cell"
                      style={{ backgroundColor: heatColor(n) }}
                      title={`${d}: ${n} sessions`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="dash-card" style={{ paddingBottom: 14 }}>
              <div className="dash-card-title">
                <BarChart2 size={16} /> Recent Performance
              </div>
              {recent10.length === 0 ? (
                empty("No data yet")
              ) : (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart
                    data={recent10}
                    margin={{ top: 8, right: 8, left: -28, bottom: 0 }}
                    onClick={(d) =>
                      d?.activePayload &&
                      setSelectedReport(d.activePayload[0].payload.fullData)
                    }
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                      tick={{
                        fontSize: 11,
                        fill: "var(--text)",
                        opacity: 0.55,
                      }}
                      dy={8}
                    />
                    <YAxis
                      domain={[0, 50]}
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 11,
                        fill: "var(--text)",
                        opacity: 0.55,
                      }}
                    />
                    <Tooltip
                      content={<Tip />}
                      cursor={{
                        fill: isDarkMode
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(0,0,0,0.03)",
                      }}
                    />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={44}>
                      {recent10.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Ledger table */}
          <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{ padding: "22px 24px 10px" }}
              className="dash-card-title"
            >
              Diagnostic Ledger
            </div>
            {reports.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  opacity: 0.4,
                  color: "var(--text)",
                }}
              >
                No sessions recorded.
              </div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr className="history-head">
                    <th className="history-cell" style={{ width: "20%" }}>
                      Date
                    </th>
                    <th className="history-cell" style={{ width: "14%" }}>
                      Score
                    </th>
                    <th className="history-cell">Core Concept</th>
                    <th className="history-cell" style={{ width: "5%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r, i) => (
                    <tr
                      key={i}
                      className="history-row"
                      onClick={() => setSelectedReport(r)}
                    >
                      <td className="history-cell" style={{ fontWeight: 600 }}>
                        {new Date(r.timestamp).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="history-cell">
                        <span
                          style={{
                            background: "var(--bg)",
                            padding: "3px 10px",
                            borderRadius: "7px",
                            border: "1px solid var(--border)",
                            fontWeight: 700,
                            color: "#3B82F6",
                            fontSize: "0.8rem",
                          }}
                        >
                          {r.evaluation_report?.total_score_out_of_50}/50
                        </span>
                      </td>
                      <td className="history-cell" style={{ opacity: 0.65 }}>
                        {r.evaluation_report?.detailed_strengths?.substring(
                          0,
                          60,
                        )}
                        …
                      </td>
                      <td
                        className="history-cell"
                        style={{ textAlign: "right", opacity: 0.4 }}
                      >
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Report modal */}
      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2
                style={{
                  fontFamily: "Bricolage Grotesque",
                  fontSize: "1.3rem",
                  margin: 0,
                }}
              >
                Diagnostic Report
              </h2>
              <X
                size={22}
                style={{ cursor: "pointer", opacity: 0.5 }}
                onClick={() => setSelectedReport(null)}
              />
            </div>
            <div className="modal-body">
              <div className="score-banner">
                <div className="score-circle">
                  {selectedReport.evaluation_report?.total_score_out_of_50}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>
                    Session Mastery Score
                  </div>
                  <div
                    style={{ opacity: 0.5, fontSize: "0.82rem", marginTop: 3 }}
                  >
                    {new Date(selectedReport.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              {[
                {
                  label: "Demonstrated Strengths",
                  icon: <Zap size={14} />,
                  color: "var(--success)",
                  key: "detailed_strengths",
                },
                {
                  label: "Logic Weaknesses Identified",
                  icon: <AlertTriangle size={14} />,
                  color: "var(--danger)",
                  key: "detailed_weaknesses",
                },
                {
                  label: "Next Action Plan",
                  icon: <Target size={14} />,
                  color: "#3B82F6",
                  key: "next_action_plan",
                },
              ].map(({ label, icon, color, key }) => (
                <div key={key} className="report-section">
                  <div className="report-label" style={{ color }}>
                    {icon} {label}
                  </div>
                  <div
                    className="report-text"
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    {selectedReport.evaluation_report?.[key] || "No data."}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
