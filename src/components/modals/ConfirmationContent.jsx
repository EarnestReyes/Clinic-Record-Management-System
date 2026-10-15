import React from "react";
import { ShieldCheck } from "lucide-react";
import { Check } from "lucide-react";
export default function ConfirmationContent({
  modal,
  setModal
}) {
  return <div className="modal-body">
    <div className="confirm-symbol">
      <ShieldCheck size={30} />
    </div>
    <p>
      {modal.text}
    </p>
    <footer className="modal-footer">
      <button className="btn secondary" onClick={() => setModal(null)}>Keep as is</button>
      <button className="btn primary" onClick={modal.action}>Confirm<Check size={16} /></button>
    </footer>
  </div>;
}
