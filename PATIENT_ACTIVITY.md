# Calculated patient activity

Activity is calculated on authorized reads. There is no persistent activity field, background job, migration, write, automatic archive, appointment cancellation, reassignment or permission change. Inactive patients remain eligible for existing authorized booking workflows; Archived patients retain the existing restore-before-booking restriction.

## Evidence and boundaries

- Saved consultation metadata with a reliable author, matching recorded profession and valid non-future date qualifies. Diagnoses, notes and prescriptions are not queried or returned by the activity API.
- A valid current/future Scheduled appointment explicitly assigned to an active eligible doctor overrides inactivity for a non-archived patient. An appointment in progress qualifies until its end; elapsed appointments and unresolved past Scheduled bookings do not prove recent clinical activity. This does not change their status, reservation, assignment or access behavior.
- Cancelled and No Show never qualify. Completed appointments have no reliable attendance attestation in the existing model, so completion alone is not qualifying clinical evidence. A newer unverified completion or invalid clinical metadata produces Unknown when the available evidence cannot otherwise prove Active.
- Routing alone has no stored active-care state and does not establish an active care assignment.
- Use the clinic date in Asia/Manila. Subtract calendar months, clamping to the final day of the target month: May 31 minus three months is February 28 (29 in a leap year).
- A consultation newer than the three-month cutoff means Active; exactly three months means At Risk; exactly six months or older means Inactive. A valid appointment can override these age bands. No reliable date means Unknown / Needs Review, not an inferred inactivity date based on registration or last profile edit.
- Archived remains an independent lifecycle value. Activity history may still be classified for an archived profile, but current appointments cannot activate that profile and archived profiles are excluded from activity summary counts.

## Scope and display

`GET /api/patient-activity` uses existing patient, consultation and appointment access scopes. Administrators receive clinic-wide metadata; doctors receive only their own clinical evidence for patients currently authorized to them. Query parameters cannot widen scope. Nurses and missing-profession accounts receive 403, because clinical-history-derived dates and classifications are not part of their approved access. Nurse scheduling remains unchanged.

The dashboard has a separate patient-activity card with counts, classification filters, last qualifying consultation dates, lifecycle labels, refresh and error states. Existing patient totals now explicitly distinguish non-archived profiles from clinical activity.

The administrator directory adds clinic-wide and doctor-specific activity per patient, inactive counts per doctor, clinic activity counts and an activity filter. One patient can be Inactive for one doctor and Active for another without creating profiles or sharing clinical access. Existing directory assignment counters remain separate: an unresolved past Scheduled relationship can still exist while its calculated clinical activity is Inactive.

The dashboard table initially excludes archived profiles; an explicit toggle can display their historical classifications. Activity counts continue to exclude archived profiles. Counts and classifications recompute on entry, refresh or existing workspace refresh after mutations. No automatic polling is added.

## Limitations and follow-up decisions

Reliable appointment attendance and explicit active care assignments are not currently stored. Supporting them would require team-approved fields and write workflows, rather than silently treating Completed or routing as proof. Missing/mismatched legacy consultation ownership or dates require review; no legacy records are repaired. Metadata is loaded within the authorized scope at read time; large clinics may later need aggregation/pagination. Rendered browser viewport and real MongoDB integration checks are not claimed.

Files: new `backend/controllers/activityController.js`, activity route, directory metadata integration, `src/components/patients/PatientActivitySummary.jsx`, dashboard and directory UI/filter changes, focused tests and this document. No models or authorization policies changed.
