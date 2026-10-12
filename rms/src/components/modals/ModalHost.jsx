import React from "react";
import Modal from "../common/Modal.jsx";
import { modalTitle } from "./modalTitle.js";
import PatientForm from "../patients/PatientForm.jsx";
import ConsultationForm from "../medicalRecords/ConsultationForm.jsx";
import AppointmentForm from "../appointments/AppointmentForm.jsx";
import AppointmentDetails from "../appointments/AppointmentDetails.jsx";
import ConsultationDetails from "../medicalRecords/ConsultationDetails.jsx";
import ConfirmationContent from "./ConfirmationContent.jsx";
import UserForm from "../users/UserForm.jsx";
import DocumentUpload from "../documents/DocumentUpload.jsx";
import DocumentPreview from "../documents/DocumentPreview.jsx";
import HelpContent from "./HelpContent.jsx";
export default function ModalHost({
  modal,
  setModal,
  data,
  commit,
  active,
  user,
  notify,
  patient,
  personCell,
  addAppointment,
  updateAppointment
}) {
  return modal && <Modal title={modalTitle(modal)} wide={['patient', 'consultation', 'record'].includes(modal.type)} onClose={() => setModal(null)}>
  
    {modal.type === 'patient' && <PatientForm 
      modal={modal} 
      setModal={setModal} 
      data={data} 
      commit={commit} 
    />}
  
    {modal.type === 'consultation' && <ConsultationForm 
      active={active} 
      modal={modal} 
      user={user} 
      setModal={setModal} 
      notify={notify} 
      commit={commit} 
      data={data} 
      patient={patient} 
    />}
  
    {modal.type === 'appointment' && <AppointmentForm 
      active={active} 
      modal={modal} 
      setModal={setModal} 
      notify={notify} 
      data={data} 
      commit={commit} 
      patient={patient} 
    />}
  
    {modal.type === 'appointment-detail' && <AppointmentDetails 
      personCell={personCell} 
      patient={patient} 
      modal={modal} 
      addAppointment={addAppointment} 
      setModal={setModal} 
      updateAppointment={updateAppointment} 
    />}
  
    {modal.type === 'record' && <ConsultationDetails personCell={personCell} patient={patient} modal={modal} />}
  
    {modal.type === 'confirm' && <ConfirmationContent modal={modal} setModal={setModal} />}
  
    {modal.type === 'user' && <UserForm 
      modal={modal} 
      user={user} 
      setModal={setModal} 
      data={data} 
      notify={notify} 

      commit={commit} 
    />}
  
    {modal.type === 'upload' && <DocumentUpload 
      notify={notify} 
      commit={commit} 
      data={data} 
      modal={modal} 
      patient={patient} 
      setModal={setModal} 
    />}
  
    {modal.type === 'document' && <DocumentPreview modal={modal} notify={notify} />}
  
    {modal.type === 'help' && <HelpContent />}
  
  </Modal>;
}
