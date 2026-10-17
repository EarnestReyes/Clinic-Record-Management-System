import Consultation from '../models/Consultation.js';
import { nextDisplayReference } from '../utils/displayReference.js';
import Patient from '../models/Patient.js';
import { ApiError } from '../middleware/errors.js';
import {
    pick,
    text,
    date,
    number,
    choice,
    clinicToday,
    pagination
} from '../middleware/validation.js';
import {
    specialtyByKey,
    specialtyKeyOf,
    ALL_VITALS
} from '../config/specialties.js';
import {
    activePatient,
    audit,
    existing
} from './shared.js';
import { nextMedicalRecordId } from '../utils/medicalRecordId.js';
import { consultationScope } from '../middleware/accessScopes.js';

export const listConsultations = async(req, res) => {
    const filter = await consultationScope(req.user);

    if (req.query.patientId) {
        filter.$and = [{
            patientId: text(req.query.patientId, 'Patient ID', {
                max: 100
            })
        }];
    }

    const { skip, limit } = pagination(req.query);

    const [items, total] = await Promise.all([
        Consultation.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
        Consultation.countDocuments(filter)
    ]);

    res.json({ items, total });
};

export const getConsultation = async(req, res) => {
    const filter = await consultationScope(req.user);
    const record = await Consultation.findOne({...filter, id: req.params.id });
    if (!record) throw new ApiError(403, 'This consultation is not authorized for your account.');
    res.json(record);
};

// Calculate age on the visit date from the patient's date of birth.
export function ageText(dob, visit) {
    const [by, bm, bd] = dob.split('-').map(Number);
    const [vy, vm, vd] = visit.split('-').map(Number);

    let months = (vy - by) * 12 + (vm - bm);

    if (vd < bd) months--;

    if (months < 0) months = 0;

    const years = Math.floor(months / 12);
    const rest = months % 12;

    return years >= 1 ?
        `${years} year${years === 1 ? '' : 's'}${
        rest ? `, ${rest} month${rest === 1 ? '' : 's'}` : ''
      }`
    : `${months} month${months === 1 ? '' : 's'}`;
}

// Validate specialty-specific fields against that specialty's form.
export function buildDetails(spec, input, patient, visitDate) {
  if (
    input !== undefined &&
    (typeof input !== 'object' ||
      input === null ||
      Array.isArray(input))
  ) {
    throw new ApiError(400, 'Specialty details must be an object.');
  }

  const raw = input || {};
  const details = {};

  for (const f of spec.fields) {
    if (f.computed === 'ageAtVisit') {
      details[f.name] = ageText(patient.dob, visitDate);
      continue;
    }

    let value;

    if (f.type === 'select') {
      value =
        raw[f.name] === undefined || raw[f.name] === ''
          ? ''
          : choice(raw[f.name], f.options, f.label);

      if (f.required && !value) {
        throw new ApiError(400, `${f.label} is required.`);
      }
    } else if (f.type === 'date') {
      value =
        raw[f.name] === undefined || raw[f.name] === ''
          ? ''
          : date(raw[f.name], f.label);

      if (f.required && !value) {
        throw new ApiError(400, `${f.label} is required.`);
      }
    } else if (f.type === 'number') {
      value = number(raw[f.name], f.label, 0, 10000);
    } else {
      value = text(raw[f.name], f.label, {
        required: !!f.required,
        max: f.type === 'textarea' ? 5000 : 300
      });
    }

    details[f.name] = value;
  }

  return details;
}

export const createConsultation = async (req, res) => {

 
  // Determine the clinician's specialty from their authenticated account.
  const key = specialtyKeyOf(req.user);
  const spec = specialtyByKey(key);

  const b = pick(req.body, [
    'patientId',
    'date',
    'type',
    'complaint',
    'symptoms',
    'diagnosis',
    'treatment',
    'followUp',
    'notes',
    'specialty',
    'details',
    'staffId',
    'staff',
    ...ALL_VITALS
  ]);

  if (b.specialty !== undefined && b.specialty !== key) {
    throw new ApiError(
      403,
      'You can only create records for your own specialty.'
    );
  }

  if (b.staffId !== undefined && b.staffId !== req.user.id) {
    throw new ApiError(
      403,
      'You can only create consultation records under your own name.'
    );
  }

  const patientId = text(b.patientId, 'Patient', {
    required: true,
    max: 100
  });

  const patient = await activePatient(patientId, req.user);

  const values = {
    patientId,
    date: date(b.date),
    staffId: req.user.id,
    staff: 'Dr. ' + req.user.name,
    specialty: key,
    recordType: spec.recordType
  };

  if (values.date > clinicToday()) {
    throw new ApiError(400, 'Consultation date cannot be in the future.');
  }

  for (const k of [
    'type',
    'complaint',
    'symptoms',
    'diagnosis',
    'treatment',
    'followUp',
    'notes'
  ]) {
    values[k] = text(b[k], k, {
      required: ['type', 'complaint', 'diagnosis', 'treatment'].includes(k)
    });
  }

  values.details = buildDetails(spec, b.details, patient, values.date);

  for (const k of ALL_VITALS) {
    if (!spec.vitals.includes(k) && b[k] !== undefined && b[k] !== '') {
      throw new ApiError(
        400,
        `${k} is not part of the ${spec.label} form.`
      );
    }
  }

  if (spec.vitals.includes('bp')) {
    values.bp = text(b.bp, 'Blood pressure', { max: 20 });

    if (values.bp && !/^\d{2,3}\/\d{2,3}$/.test(values.bp)) {
      throw new ApiError(
        400,
        'Use systolic/diastolic blood pressure, for example 120/80.'
      );
    }
  }

  for (const [k, min, max] of [
    ['pulse', 0, 300],
    ['temperature', 20, 50],
    ['weight', 0, 600],
    ['height', 0, 300],
    ['oxygen', 0, 100]
  ]) {
    if (spec.vitals.includes(k)) {
      values[k] = number(b[k], k, min, max);
    }
  }

  // Generate a daily sequential medical record ID.
  
  // Preserve the existing permanent ID and its relationships.
  const id = await nextMedicalRecordId();

  // Generate a separate, immutable display reference.
  const displayReference = await nextDisplayReference(
    'MR',
    key,
    req.user.role
  );

  const record = await Consultation.create({
    ...values,
    _id: id,
    id,
    displayReference,
    createdBy: req.user.id
  });


  await audit(req.user, 'Consultation created', 'Patient', patientId);

  res.status(201).json(record);
};
