# Doctor availability

Administrators configure active doctors through **User Management → Availability**. Each doctor has their own weekdays, daily start/end times and fixed duration. Clinic times use Asia/Manila. Empty weekdays disable new bookings. No availability is assigned automatically.

Appointment creation/rescheduling requires a matching specialty and doctor, a future date and an available fixed slot. The API validates working days, hours, duration, alignment and overlap. Scheduled appointments reserve slots; Cancelled, Completed and No Show release them. Existing manual No Show rules and doctor-specific access remain unchanged.

The existing unique partial multikey index `staffId_1_date_1_slots_1` prevents concurrent overlapping reservations at five-minute resolution. Booking refuses to proceed if this index is absent. A separate conflict check includes legacy Scheduled records without reservation metadata. No historical records are migrated. Existing database initialization provisions model indexes; any index failure needs administrator review, not automatic deletion or repair of records.

Schedule changes report the IDs, dates and times of conflicting Scheduled appointments to administrators and leave appointments unchanged. Conflict reports are snapshots; administrators should recheck schedules after concurrent edits. Per-date exceptions, multiple daily windows and holidays are not supported by the existing architecture and have not been introduced.

Focused checks:

```sh
cd backend
node --test --test-isolation=none tests/availability.test.js tests/nurse-workflow.test.js tests/patient-isolation.test.js tests/critical-fixes.test.js
cd ..
node tests/critical-fixes.cjs availability
node tests/critical-fixes.cjs nurse
node tests/critical-fixes.cjs components
```

The real simultaneous-booking test is skipped by default. It requires explicit isolated-database opt-in through the existing safety helper, which creates and owns a fresh disposable test database. It must never use the shared clinic database. Local mocked tests do not establish real MongoDB concurrency behavior.

Files changed for this feature: `backend/config/availability.js`, `backend/models/User.js`, appointment/user controllers, `backend/routes/index.js`, appointment form/slot picker, shared form rendering, availability form, modal host, User Management, focused tests and the isolated integration fixture.
