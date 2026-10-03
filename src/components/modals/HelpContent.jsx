import React from "react";
export default function HelpContent() {
  return <div className="modal-body">
    <p>Careline brings your clinic’s daily work into one connected workspace.</p>
    {[['Patients', 'Add a patient, open their profile, and view their complete care history. Records can be archived and restored.'], ['Consultations', 'Capture visit details and vital signs. Saved consultations appear immediately in the patient timeline.'], ['Appointments', 'Schedule visits, switch to the calendar, and use the appointment menu to confirm, complete, or reschedule.'], ['Demo accounts', 'Administrator: admin@careline.demo · Staff: staff@careline.demo · Password: Careline123!'], ['Local demo data', 'Changes are saved to this browser. This is a frontend demonstration and is intended for fictional patient information.']].map(([k, v]) => <div className="clinical-section" key={k}>
      <h4>
        {k}
      </h4>
      <p>
        {v}
      </p>
    </div>)}
  </div>;
}
