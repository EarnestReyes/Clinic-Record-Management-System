import React from "react";
export default function HelpContent() {
  return <div className="modal-body">
    <p>Careline brings your clinic’s daily work into one connected workspace.</p>
    {[['Patients', 'Add a patient, open their profile, and view their complete care history. Records can be archived and restored.'], ['Consultations', 'Capture visit details and vital signs. Saved consultations appear immediately in the patient timeline.'], ['Appointments', 'Schedule visits, switch to the calendar, and use the appointment menu to confirm, complete, or reschedule.'], ['Clinic accounts', 'Sign in with the account and password assigned by your clinic administrator.'], ['Secure records', 'Changes are saved through the authenticated clinic API to MongoDB. Contact your administrator if the connection is unavailable.']].map(([k, v]) => <div className="clinical-section" key={k}>
      <h4>
        {k}
      </h4>
      <p>
        {v}
      </p>
    </div>)}
  </div>;
}
