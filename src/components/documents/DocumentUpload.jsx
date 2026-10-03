import React from "react";
import { Upload } from "lucide-react";
import { today } from "../../utils/helpers";
import Form from "../common/Form.jsx";
export default function DocumentUpload({
  notify,
  commit,
  data,
  modal,
  patient,
  setModal
}) {
  return <div className="modal-body">
    <div className="upload-zone">
      <Upload size={30} />
      <h3>Add a patient document</h3>
      <p>Select a text document, or create a sample document below.</p>
      <input 
        type="file" 
        accept=".txt,.csv,.json" 
        aria-label="Upload text document" 
        onChange={async e => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1000000) return notify('Please choose a document under 1 MB');
        const content = await file.text();
        commit('documents', [...data.documents, {
          id: 'DOC-' + Date.now(),
          patientId: modal.patientId,
          name: file.name,
          type: 'Uploaded document',
          date: today(),
          status: 'Active',
          content
        }], 'Document uploaded', patient(modal.patientId)?.name + ' · ' + file.name);
      }} 
      />
    </div>
    <Form 
      fields={[{
      name: 'name',
      label: 'Document name',
      required: true,
      placeholder: 'Referral letter.txt'
    }, {
      name: 'type',
      label: 'Category',
      options: ['Referral', 'Laboratory', 'Prescription', 'Intake form', 'Other']
    }, {
      name: 'content',
      label: 'Document content',
      type: 'textarea',
      required: true,
      wide: true
    }]} 
      submit="Add mock document" 
      onCancel={() => setModal(null)} 
      onSave={v => commit('documents', [...data.documents, {
      ...v,
      id: 'DOC-' + Date.now(),
      patientId: modal.patientId,
      date: today(),
      status: 'Active'
    }], 'Document uploaded', patient(modal.patientId)?.name + ' · ' + v.name)} 
    />
  </div>;
}
