import React from "react";
import { CheckCircle2, X } from "lucide-react";
export default function Toast({
  toast,
  setToast
}) {
  return toast && <div className="toast" role="status">
    <CheckCircle2 size={20} />
    <span>
      {toast}
    </span>
    <button className="icon-button" onClick={() => setToast('')} aria-label="Dismiss notification">
      <X size={16} />
    </button>
  </div>;
}
