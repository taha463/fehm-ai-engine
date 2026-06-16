import React from "react";
import Plot from "react-plotly.js";

const InteractiveChart = ({ data }) => (
  <div
    style={{
      width: "100%",
      margin: "15px 0",
      borderRadius: "12px",
      overflow: "hidden",
    }}
  >
    <Plot
      data={[
        {
          x: data.x,
          y: data.y,
          type: "scatter",
          mode: "lines+markers",
          marker: { color: "#7C3AED" },
          fill: "tozeroy",
          line: { shape: "spline" },
        },
      ]}
      layout={{
        autosize: true,
        title: {
          text: data.title,
          font: { family: "Instrument Sans", size: 16 },
        },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        margin: { l: 40, r: 20, t: 40, b: 40 },
        xaxis: { gridcolor: "rgba(0,0,0,0.1)" },
        yaxis: { gridcolor: "rgba(0,0,0,0.1)" },
      }}
      useResizeHandler={true}
      style={{ width: "100%", height: "320px" }}
      config={{ responsive: true, displayModeBar: false }}
    />
  </div>
);

export default InteractiveChart;
