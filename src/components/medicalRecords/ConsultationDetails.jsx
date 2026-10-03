import React from "react";
import { dateLabel } from "../../utils/helpers";
import { download } from "../../utils/helpers";
import { ArrowDownToLine } from "lucide-react";
export default function ConsultationDetails({
  personCell,
  patient,
  modal
}) {
  return <div className="modal-body">
    <div className="row-between">
      {personCell(patient(modal.item.patientId))}
      <span className="record-id">
        {modal.item.id}
      </span>
    </div>
    <p className="muted">{dateLabel(modal.item.date)} · {modal.item.type} · {modal.item.staff}</p>
    <div className="vitals-grid">
      {[['Blood pressure', modal.item.bp, 'mmHg'], ['Pulse', modal.item.pulse, 'bpm'], ['Temperature', modal.item.temperature, '°C'], ['SpO₂', modal.item.oxygen, '%'], ['Weight', modal.item.weight, 'kg'], ['Height', modal.item.height, 'cm']].map(([k, v, unit]) => <div key={k}>
        <small>
          {k}
        </small>
        <strong>
          {v || '—'} 
          <span>
            {v && unit}
          </span>
        </strong>
      </div>)}
    </div>
    {[['Chief complaint', 'complaint'], ['Symptoms', 'symptoms'], ['Assessment / Diagnosis', 'diagnosis'], ['Treatment / Plan', 'treatment'], ['Notes', 'notes']].map(([label, k]) => <div className="clinical-section" key={k}>
      <h4>
        {label}
      </h4>
      <p>
        {modal.item[k] || 'Not recorded'}
      </p>
    </div>)}
    <button className="btn secondary" onClick={() => download(modal.item.id + '.txt', Object.entries(modal.item).map(([k, v]) => `${k}: ${v}`).join('\n'))}><ArrowDownToLine size={16} />Download record</button>
  </div>;
}
