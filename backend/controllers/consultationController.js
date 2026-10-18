import Appointment from "../models/Appointment.js";
import Consultation from "../models/Consultation.js";
import { nextDisplayReference } from "../utils/displayReference.js";
import { nextMedicalRecordId } from "../utils/medicalRecordId.js";
import { ApiError } from "../middleware/errors.js";
import {
    pick,
    text,
    date,
    number,
    choice,
    clinicToday,
    pagination
} from "../middleware/validation.js";
import {
    specialtyByKey,
    specialtyKeyOf,
    ALL_VITALS
} from "../config/specialties.js";
import {
    activePatient,
    audit
} from "./shared.js";
import { consultationScope } from "../middleware/accessScopes.js";

export const listConsultations = async(req, res) => {
    const filter = await consultationScope(req.user);

    if (req.query.patientId) {
        filter.$and = [{
            patientId: text(req.query.patientId, "Patient ID", {
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

    const record = await Consultation.findOne({
        ...filter,
        id: req.params.id
    });

    if (!record) {
        throw new ApiError(
            403,
            "This consultation is not authorized for your account."
        );
    }

    res.json(record);
};

export function ageText(dob, visit) {
    const [by, bm, bd] = dob.split("-").map(Number);
    const [vy, vm, vd] = visit.split("-").map(Number);

    let months = (vy - by) * 12 + (vm - bm);

    if (vd < bd) months--;
    if (months < 0) months = 0;

    const years = Math.floor(months / 12);
    const rest = months % 12;

    return years >= 1 ?
        `${years} year${years === 1 ? "" : "s"}${
        rest ? `, ${rest} month${rest === 1 ? "" : "s"}` : ""
      }`
    : `${months} month${months === 1 ? "" : "s"}`;
}

export function buildDetails(spec, input, patient, visitDate) {
  if (
    input !== undefined &&
    (typeof input !== "object" ||
      input === null ||
      Array.isArray(input))
  ) {
    throw new ApiError(
      400,
      "Specialty details must be an object."
    );
  }

  const raw = input || {};
  const details = {};

  for (const field of spec.fields) {
    if (field.computed === "ageAtVisit") {
      details[field.name] = ageText(patient.dob, visitDate);
      continue;
    }

    let value;

    if (field.type === "select") {
      value =
        raw[field.name] === undefined || raw[field.name] === ""
          ? ""
          : choice(raw[field.name], field.options, field.label);

      if (field.required && !value) {
        throw new ApiError(400, `${field.label} is required.`);
      }
    } else if (field.type === "date") {
      value =
        raw[field.name] === undefined || raw[field.name] === ""
          ? ""
          : date(raw[field.name], field.label);

      if (field.required && !value) {
        throw new ApiError(400, `${field.label} is required.`);
      }
    } else if (field.type === "number") {
      value = number(raw[field.name], field.label, 0, 10000);
    } else {
      value = text(raw[field.name], field.label, {
        required: !!field.required,
        max: field.type === "textarea" ? 5000 : 300
      });
    }

    details[field.name] = value;
  }

  return details;
}

export const createConsultation = async (req, res) => {
  const key = specialtyKeyOf(req.user);
  const spec = specialtyByKey(key);

  if (!spec) {
    throw new ApiError(
      403,
      "Your account does not have a valid medical specialty."
    );
  }

  const body = pick(req.body, [
    "patientId",
    "appointmentId",
    "appointmentDate",
    "date",
    "type",
    "complaint",
    "symptoms",
    "diagnosis",
    "treatment",
    "followUp",
    "notes",
    "specialty",
    "details",
    "staffId",
    "staff",
    ...ALL_VITALS
  ]);

  if (body.specialty !== undefined && body.specialty !== key) {
    throw new ApiError(
      403,
      "You can only create records for your own specialty."
    );
  }

  if (
    body.staffId !== undefined &&
    body.staffId !== req.user.id
  ) {
    throw new ApiError(
      403,
      "You can only create consultation records under your own name."
    );
  }

  const patientId = text(body.patientId, "Patient", {
    required: true,
    max: 100
  });

  const appointmentId = text(body.appointmentId, "Appointment ID", {
    required: true,
    max: 100
  });

  const patient = await activePatient(patientId, req.user);

  const appointment = await Appointment.findOne({
    id: appointmentId
  });

  if (!appointment) {
    throw new ApiError(
      404,
      "The selected appointment could not be found."
    );
  }

  if (
    appointment.patientId !== patientId ||
    appointment.staffId !== req.user.id ||
    appointment.specialty !== key
  ) {
    throw new ApiError(
      403,
      "The selected appointment is not assigned to you for this patient and specialty."
    );
  }

  if (!["Scheduled", "Completed"].includes(appointment.status)) {
    throw new ApiError(
      409,
      "Only Scheduled or Completed appointments can be linked to a consultation."
    );
  }

  if (
    appointment.status === "Scheduled" &&
    appointment.date > clinicToday()
  ) {
    throw new ApiError(
      400,
      "A consultation cannot be recorded against a future appointment."
    );
  }

  const duplicate = await Consultation.exists({
    appointmentId: appointment.id
  });

  if (duplicate) {
    throw new ApiError(
      409,
      "A consultation record already exists for this appointment."
    );
  }

  // The record date is the date the record is created.
  // The original appointment date is retained separately.
  const recordDate = clinicToday();

  const values = {
    patientId,
    appointmentId: appointment.id,
    appointmentDate: appointment.date,
    date: recordDate,
    staffId: req.user.id,
    staff: "Dr. " + req.user.name,
    specialty: key,
    recordType: spec.recordType
  };

  for (const field of [
    "type",
    "complaint",
    "symptoms",
    "diagnosis",
    "treatment",
    "followUp",
    "notes"
  ]) {
    values[field] = text(body[field], field, {
      required: [
        "type",
        "complaint",
        "diagnosis",
        "treatment"
      ].includes(field)
    });
  }

  // Computed fields such as ageAtVisit must use the appointment date,
  // not the date on which the clinician entered the record.
  values.details = buildDetails(
    spec,
    body.details,
    patient,
    appointment.date
  );

  for (const vital of ALL_VITALS) {
    if (
      !spec.vitals.includes(vital) &&
      body[vital] !== undefined &&
      body[vital] !== ""
    ) {
      throw new ApiError(
        400,
        `${vital} is not part of the ${spec.label} form.`
      );
    }
  }

  if (spec.vitals.includes("bp")) {
    values.bp = text(body.bp, "Blood pressure", { max: 20 });

    if (
      values.bp &&
      !/^\d{2,3}\/\d{2,3}$/.test(values.bp)
    ) {
      throw new ApiError(
        400,
        "Use systolic/diastolic blood pressure, for example 120/80."
      );
    }
  }

  for (const [field, min, max] of [
    ["pulse", 0, 300],
    ["temperature", 20, 50],
    ["weight", 0, 600],
    ["height", 0, 300],
    ["oxygen", 0, 100]
  ]) {
    if (spec.vitals.includes(field)) {
      values[field] = number(body[field], field, min, max);
    }
  }

  const id = await nextMedicalRecordId();

  const displayReference = await nextDisplayReference(
    "MR",
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

  await audit(
    req.user,
    "Consultation created",
    "Patient",
    patientId
  );

  res.status(201).json(record);
};