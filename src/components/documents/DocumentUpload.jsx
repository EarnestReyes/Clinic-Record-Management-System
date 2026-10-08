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
      <p>Upload a PDF, image, or text document, or add a text note below.</p>
      <input 
        type="file" 
        accept=".txt,.csv,.json,.pdf,.png,.jpg,.jpeg"
        aria-label="Upload text document" 
        onChange={async e => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return notify('Please choose a document under 5 MB');

        commit('documents', [...data.documents, {
          id: 'DOC-' + Date.now(),
          patientId: modal.patientId,
          name: file.name,
          type: 'Uploaded document',
          date: today(),
          status: 'Active',
          file
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
      submit="Add document"
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
