# Appointment conflict protection

Scheduling checks all Scheduled appointments for the patient across departments,
then the selected doctor's appointments. Intervals use the existing five-minute
grid, configured duration, and Asia/Manila calendar; adjacent intervals are allowed.
Edits exclude their own appointment. Legacy Scheduled records are checked even
when reservation metadata is absent. Conflict details follow existing appointment
access permissions; concurrent duplicate-key responses disclose no other records.

Both unique partial indexes must exist before scheduling:
`staffId_1_date_1_slots_1` and `patientId_1_date_1_slots_1`, with
`partialFilterExpression: { reserved: true }`. The normal Mongoose model initialization
builds declared indexes. Scheduling refuses requests when either index is missing.
MongoDB enforces these constraints across application processes and instances.

Before deployment, review existing reservation metadata and overlapping active
appointments in an authorized environment. Existing duplicate patient reservations
can prevent the new unique index from building and therefore prevent startup.
No automatic record repair or migration is included. Resolve historical data issues
through an explicitly reviewed process; do not remove index protection to deploy.
Environments with automatic indexing disabled require an administrator to provision
the same declared index before enabling scheduling. No database was connected to or
modified during implementation; tests use mocks, including a simulated concurrent
unique-index race. Real MongoDB concurrency verification remains a deployment check.
