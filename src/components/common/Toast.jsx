import React from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
export default function Toast({
  toast,
  type = 'success',
  setToast
}) {
  return toast && <div className={`toast ${type === 'error' ? 'toast-error' : ''}`} role={type === 'error' ? 'alert' : 'status'}>
    {type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
    <span>
      {toast}
    </span>
    <button className="icon-button" onClick={() => setToast('')} aria-label="Dismiss notification">
      <X size={16} />
    </button>
  </div>;
}
