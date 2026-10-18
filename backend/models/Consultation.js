import {
    displayReferenceField,
    displayReferenceIndex
} from "../utils/displayReference.js";
import mongoose from "mongoose";
import { options, requiredText } from "./shared.js";

const schema = new mongoose.Schema({
    _id: String,
    displayReference: displayReferenceField("MR"),
    id: {
        type: String,
        unique: true,
        required: true
    },

    patientId: {
        type: String,
        ref: "Patient",
        required: true
    },

    appointmentId: {
        type: String,
        ref: "Appointment"
    },

    appointmentDate: String,

    date: requiredText,
    type: requiredText,
    complaint: requiredText,
    symptoms: String,
    diagnosis: requiredText,
    treatment: requiredText,
    followUp: String,
    notes: String,
    specialty: String,
    recordType: String,
    details: {
        type: Object,
        default: {}
    },

    staffId: {
        type: String,
        ref: "User",
        required: true
    },

    staff: requiredText,

    createdBy: {
        type: String,
        ref: "User",
        required: true
    },

    bp: String,
    pulse: String,
    temperature: String,
    weight: String,
    height: String,
    oxygen: String
}, options);

schema.index({ patientId: 1, date: -1 });
schema.index({ patientId: 1, appointmentDate: -1 });
schema.index({ appointmentId: 1 }, { unique: true, sparse: true });
schema.index({ date: -1 });
schema.index({ displayReference: 1 }, displayReferenceIndex);

export default mongoose.model("Consultation", schema);