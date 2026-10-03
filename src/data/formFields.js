import { today } from "../utils/helpers";
export const patientFields = [{
    name: 'name',
    label: 'Full name',
    required: true
  }, {
    name: 'dob',
    label: 'Date of birth',
    type: 'date',
    required: true,
    max: today()
  }, {
    name: 'gender',
    label: 'Gender',
    options: ['Female', 'Male', 'Other', 'Prefer not to say']
  }, {
    name: 'blood',
    label: 'Blood group',
    options: ['Unknown', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']
  }, {
    name: 'phone',
    label: 'Phone number',
    required: true
  }, {
    name: 'email',
    label: 'Email address',
    type: 'email'
  }, {
    name: 'address',
    label: 'Address',
    wide: true
  }, {
    name: 'emergencyName',
    label: 'Emergency contact name'
  }, {
    name: 'emergencyPhone',
    label: 'Emergency contact phone'
  }, {
    name: 'allergies',
    label: 'Allergies'
  }, {
    name: 'conditions',
    label: 'Existing conditions'
  }, {
    name: 'notes',
    label: 'Additional notes',
    type: 'textarea',
    wide: true
  }],
  statuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No Show'];
