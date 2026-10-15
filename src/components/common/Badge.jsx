import React from "react";

export default function Badge({ children }) {
  const label = String(children ?? "");
  const statusClass = label.toLowerCase().trim().replace(/\s+/g, "-");

  return (
    <span className={`badge ${statusClass}`}>
      {label}
    </span>
  );
}