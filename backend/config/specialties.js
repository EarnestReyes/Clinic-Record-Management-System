export const ALL_VITALS = ['bp', 'pulse', 'temperature', 'oxygen', 'weight', 'height'];

const examination = label => ({ name: 'examination', label, type: 'textarea' });

export const SPECIALTIES = [{
        key: 'general-nurse',
        label: 'General Nurse / Patient Intake Nurse',
        kind: 'intake',
        recordType: 'Patient intake',
        vitals: [],
        fields: []
    },
    {
        key: 'general-practitioner',
        label: 'General Practitioner',
        kind: 'clinical',
        recordType: 'General consultation',
        vitals: ALL_VITALS,
        fields: [
            { name: 'medicalHistory', label: 'Relevant medical history', type: 'textarea' },
            examination('General examination findings')
        ]
    },
    {
        key: 'orthopedist',
        label: 'Orthopedist',
        kind: 'clinical',
        recordType: 'Orthopedic consultation',
        vitals: [],
        fields: [
            { name: 'bodyPart', label: 'Affected body part', required: true },
            { name: 'laterality', label: 'Laterality', type: 'select', options: ['Left', 'Right', 'Both', 'Not applicable'], required: true },
            { name: 'musculoskeletalHistory', label: 'Musculoskeletal history', type: 'textarea' },
            { name: 'rangeOfMotion', label: 'Range of motion', type: 'textarea' },
            examination('Physical examination findings'),
            { name: 'imaging', label: 'Imaging / diagnostic test references', type: 'textarea' }
        ]
    },
    {
        key: 'pediatrician',
        label: 'Pediatrician',
        kind: 'clinical',
        recordType: 'Pediatric consultation',
        vitals: ['weight', 'height', 'temperature', 'pulse', 'oxygen'],
        fields: [
            { name: 'ageAtVisit', label: 'Age at visit (from date of birth)', computed: 'ageAtVisit' },
            { name: 'birthHistory', label: 'Birth history', type: 'textarea' },
            { name: 'developmentalHistory', label: 'Developmental history', type: 'textarea' },
            { name: 'immunization', label: 'Immunization history', type: 'textarea' },
            examination('Pediatric examination findings')
        ]
    },
    {
        key: 'cardiologist',
        label: 'Cardiologist',
        kind: 'clinical',
        recordType: 'Cardiology consultation',
        vitals: ['bp', 'pulse', 'oxygen', 'weight'],
        fields: [
            { name: 'cardiovascularHistory', label: 'Cardiovascular history', type: 'textarea' },
            { name: 'riskFactors', label: 'Symptoms and risk factors', type: 'textarea' },
            examination('Cardiovascular examination findings'),
            { name: 'ecg', label: 'ECG / diagnostic test references', type: 'textarea' }
        ]
    },
    {
        key: 'dermatologist',
        label: 'Dermatologist',
        kind: 'clinical',
        recordType: 'Dermatology consultation',
        vitals: [],
        fields: [
            { name: 'lesionLocation', label: 'Location of affected area', required: true },
            { name: 'lesionDescription', label: 'Description of affected area', type: 'textarea', required: true },
            { name: 'dermatologicalHistory', label: 'Dermatological history', type: 'textarea' },
            examination('Physical examination findings')
        ]
    },
    {
        key: 'neurologist',
        label: 'Neurologist',
        kind: 'clinical',
        recordType: 'Neurology consultation',
        vitals: ['bp', 'pulse'],
        fields: [
            { name: 'neurologicalHistory', label: 'Neurological history', type: 'textarea' },
            examination('Neurological examination (mental status, cranial nerves, motor, sensory, reflexes)'),
            { name: 'diagnosticTests', label: 'Imaging / EEG / diagnostic test references', type: 'textarea' }
        ]
    },
    {
        key: 'ob-gyn',
        label: 'Obstetrician-Gynecologist (OB-GYN)',
        kind: 'clinical',
        recordType: 'OB-GYN consultation',
        vitals: ['bp', 'pulse', 'weight', 'temperature'],
        fields: [
            { name: 'obstetricHistory', label: 'Obstetric history (gravida / para)', type: 'textarea' },
            { name: 'lastMenstrualPeriod', label: 'Last menstrual period', type: 'date' },
            { name: 'gestationalAge', label: 'Gestational age (if pregnant)' },
            { name: 'gynecologicHistory', label: 'Gynecologic history', type: 'textarea' },
            examination('Examination findings'),
            { name: 'diagnosticTests', label: 'Ultrasound / laboratory references', type: 'textarea' }
        ]
    },
    {
        key: 'other-specialist',
        label: 'Other Specialist',
        kind: 'clinical',
        recordType: 'Specialist consultation',
        vitals: ALL_VITALS,
        fields: [
            { name: 'specialtyName', label: 'Specialty / department', required: true },
            { name: 'medicalHistory', label: 'Relevant history', type: 'textarea' },
            examination('Examination findings')
        ]
    }
];

export const specialtyKeys = SPECIALTIES.map(s => s.key);
export const specialtyByKey = key => SPECIALTIES.find(s => s.key === key) || null;

// Which specialty does this account act as?
// Accounts created before specialties existed ("Clinic Staff" with nothing assigned)
// keep working as General Practitioner, so no existing login loses access.
// An Administrator has no specialty unless the administrator assigns one.
export function specialtyKeyOf(user) {
    if (!user) return '';
    if (user.specialty && specialtyByKey(user.specialty)) return user.specialty;
    return user.role === 'Clinic Staff' ? 'general-practitioner' : '';
}

export const isClinicalKey = key => specialtyByKey(key) ?.kind === 'clinical';

// The list sent to the frontend (the same objects, so the forms always match the server).
export const publicSpecialties = () => SPECIALTIES;