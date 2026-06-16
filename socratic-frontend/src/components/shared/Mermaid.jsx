import React, { useRef, useEffect } from "react";
import mermaid from "mermaid";

const Mermaid = ({ chart, isDarkMode }) => {
  const ref = useRef(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: isDarkMode ? "dark" : "default",
      securityLevel: "loose",
    });
    if (ref.current) {
      mermaid.contentLoaded();
    }
  }, [chart, isDarkMode]);

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.02)",
        padding: "20px",
        borderRadius: "12px",
        margin: "10px 0",
      }}
    >
      <div className="mermaid" ref={ref}>
        {chart}
      </div>
    </div>
  );
};

export default Mermaid;
