import React from "react";
import { Plus } from "lucide-react";
export default function Brand() {
  return <div className="brand">
    <span className="brand-symbol">
      <Plus size={24} strokeWidth={3} />
    </span>
    <span>careline<span className="brand-period">.</span><small>CLINIC MANAGEMENT</small></span>
  </div>;
}
