import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIALTIES, specialtyKeyOf, specialtyByKey } from '../config/specialties.js';
import { permissionsFor } from '../middleware/permissions.jsx';
import { ageText, buildDetails } from '../controllers/consultationController.js';

test('specialty registry and permissions (no database needed)', () => {
    assert.equal(SPECIALTIES.length, 9);
    assert.equal(new Set(SPECIALTIES.map(s => s.key)).size, 9);
    assert.equal(specialtyKeyOf({ role: 'Clinic Staff', specialty: '' }), 'general-practitioner', 'legacy staff keep working');
    assert.equal(specialtyKeyOf({ role: 'Administrator', specialty: '' }), '', 'administrators are not practitioners by default');
    assert.equal(specialtyKeyOf({ role: 'Clinic Staff', specialty: 'not-real' }), 'general-practitioner');
    assert.equal(permissionsFor({ role: 'Administrator' }).createConsultation, false);
    assert.equal(permissionsFor({ role: 'Administrator' }).manageUsers, true);
    assert.equal(permissionsFor({ role: 'Administrator', specialty: 'cardiologist' }).createConsultation, true);
    const nurse = permissionsFor({ role: 'Clinic Staff', specialty: 'general-nurse' });
    assert.equal(nurse.createConsultation, false);
    assert.equal(nurse.viewRecords, false);
    assert.equal(nurse.intake, true);
    assert.equal(permissionsFor({ role: 'Clinic Staff', specialty: 'orthopedist' }).createConsultation, true);
    assert.equal(ageText('2024-03-10', '2026-05-09'), '2 years, 1 month');
    assert.equal(ageText('2026-01-31', '2026-03-15'), '1 month');
    const ortho = specialtyByKey('orthopedist');
    assert.throws(() => buildDetails(ortho, {}, { dob: '1990-01-01' }, '2026-01-01'), /required/);
    assert.throws(() => buildDetails(ortho, { bodyPart: 'Knee', laterality: 'Up' }, { dob: '1990-01-01' }, '2026-01-01'));
    const details = buildDetails(ortho, { bodyPart: 'Knee', laterality: 'Left', hacked: 'x' }, { dob: '1990-01-01' }, '2026-01-01');
    assert.equal(details.bodyPart, 'Knee');
    assert.equal(details.hacked, undefined);
});

test('role-based workflow through the real API', { skip: !process.env.MONGODB_TEST_URI, timeout: 120000 }, async() => {
    // Needs a dedicated, EMPTY database whose name ends in _test.
    const mongoose = (await
        import ('mongoose')).default;
    const bcrypt = (await
        import ('bcryptjs')).default;
    const { createApp } = await
    import ('../app.js');
    const User = (await
        import ('../models/User.js')).default;
    const Consultation = (await
        import ('../models/Consultation.js')).default;
    const uri = process.env.MONGODB_TEST_URI;
    assert(new URL(uri).pathname.slice(1).endsWith('_test'), 'MONGODB_TEST_URI must name a database ending in _test.');
    let server;
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        for (const c of await mongoose.connection.db.listCollections().toArray()) assert.equal(await mongoose.connection.db.collection(c.name).countDocuments(), 0, 'Test database must be empty.');
        const password = 'RolesTest12345!',
            passwordHash = await bcrypt.hash(password, 12);
        const make = (id, role, specialty) => User.create({ _id: id, id, name: id, email: id + '@example.test', role, specialty, active: true, passwordHash });
        await make('admin', 'Administrator', '');
        await make('legacy', 'Clinic Staff', undefined); // an account created before specialties existed
        server = await new Promise(resolve => { const s = createApp({ jwtSecret: 'roles-test-secret-with-32-characters-min', clients: ['http://localhost:5173'], production: false }).listen(0, '127.0.0.1', () => resolve(s)); });
        const base = `http://127.0.0.1:${server.address().port}/api`;

        function client() {
            let cookie = '',
                csrf = '';
            return async(path, method = 'GET', body, expected = 200) => {
                const response = await fetch(base + path, { method, headers: {...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
                const result = await response.json().catch(() => ({}));
                assert.equal(response.status, expected, `${method} ${path} -> ${response.status} ${JSON.stringify(result).slice(0, 160)}`);
                if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
                if (result.csrfToken) csrf = result.csrfToken;
                return result;
            };
        }
        const login = async id => {
            const c = client();
            await c('/auth/login', 'POST', { email: id + '@example.test', password });
            return c;
        };
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
        const admin = await login('admin');

        // 1 + 2: administrator registers personnel with a specialty; it persists across logout/login
        await admin('/users', 'POST', { name: 'No Specialty', email: 'x@example.test', password, role: 'Clinic Staff' }, 400);
        await admin('/users', 'POST', { name: 'Bad', email: 'y@example.test', password, role: 'Clinic Staff', specialty: 'wizard' }, 400);
        const ids = {};
        for (const [key, specialty] of[['nurse', 'general-nurse'], ['gp', 'general-practitioner'], ['ortho', 'orthopedist'], ['peds', 'pediatrician'], ['cardio', 'cardiologist'], ['derm', 'dermatologist'], ['neuro', 'neurologist'], ['obgyn', 'ob-gyn'], ['other', 'other-specialist']]) {
            const u = await admin('/users', 'POST', { name: key, email: key + '@example.test', password, role: 'Clinic Staff', specialty }, 201);
            assert.equal(u.specialty, specialty);
            ids[key] = u.id;
        }
        const nurse = await login('nurse');
        await nurse('/auth/logout', 'POST', {});
        const nurse2 = await login('nurse');
        assert.equal((await nurse2('/auth/me')).user.permissions.specialty, 'general-nurse');
        assert.equal((await nurse2('/workspace')).specialties.length, 9);
        await nurse2('/users', 'GET', undefined, 403);

        // 3: nurse registers a patient with intake info and forwards the patient; duplicates are refused
        const ortho = await login('ortho'),
            peds = await login('peds'),
            cardio = await login('cardio'),
            derm = await login('derm'),
            gp = await login('gp'),
            legacy = await login('legacy');
        const patient = await nurse2('/patients', 'POST', { name: 'Fictional Child', dob: '2024-03-10', gender: 'Female', phone: '0917', intakeComplaint: 'Fever for two days', assignedStaffId: ids.peds }, 201);
        assert.equal(patient.intakeComplaint, 'Fever for two days');
        assert.equal(patient.assignedStaff, 'peds');
        await nurse2('/patients', 'POST', { name: 'fictional child', dob: '2024-03-10', gender: 'Female', phone: '0918' }, 409);
        await nurse2('/patients', 'POST', { name: 'Other', dob: '2000-01-01', gender: 'Male', phone: '1', assignedStaffId: ids.nurse }, 400);
        await nurse2(`/patients/${patient.id}`, 'PATCH', { address: 'Pasay City' });

        // 4: nurse cannot write or read clinical records (direct API calls)
        const visit = { patientId: patient.id, date: today, type: 'Consultation', complaint: 'c', diagnosis: 'd', treatment: 't' };
        await nurse2('/consultations', 'POST', visit, 403);
        await nurse2('/consultations', 'GET', undefined, 403);
        await nurse2('/reports/consultations', 'GET', undefined, 403);
        await nurse2('/audit-logs', 'GET', undefined, 403);
        // an administrator without a specialty is not a practitioner either
        await admin('/consultations', 'POST', visit, 403);

        // 5-8: each specialty saves its own record type and fields
        const pedsRecord = await peds('/consultations', 'POST', {...visit, weight: '12', height: '88', details: { birthHistory: 'Term', immunization: 'Complete' } }, 201);
        assert.equal(pedsRecord.specialty, 'pediatrician');
        assert.equal(pedsRecord.recordType, 'Pediatric consultation');
        assert.equal(pedsRecord.details.ageAtVisit.startsWith('2 year'), true);
        assert.equal(pedsRecord.details.birthHistory, 'Term');
        await peds('/consultations', 'POST', {...visit, bp: '120/80' }, 400); // blood pressure is not on the pediatric form
        const adult = await gp('/patients', 'POST', { name: 'Fictional Adult', dob: '1980-05-05', gender: 'Male', phone: '2' }, 201);
        const base2 = {...visit, patientId: adult.id };
        await ortho('/consultations', 'POST', base2, 400); // body part and laterality are required
        const o = await ortho('/consultations', 'POST', {...base2, details: { bodyPart: 'Knee', laterality: 'Left', rangeOfMotion: '0-120' } }, 201);
        assert.equal(o.recordType, 'Orthopedic consultation');
        const c = await cardio('/consultations', 'POST', {...base2, bp: '150/95', pulse: '88', details: { ecg: 'Sinus rhythm' } }, 201);
        assert.equal(c.specialty, 'cardiologist');
        assert.equal(c.bp, '150/95');
        await derm('/consultations', 'POST', {...base2, details: { lesionLocation: 'Forearm', lesionDescription: 'Red patch' } }, 201);
        await derm('/consultations', 'POST', {...base2, details: { lesionLocation: 'Forearm' } }, 400);
        for (const key of['neuro', 'obgyn']) await (await login(key))('/consultations', 'POST', base2, 201);
        await (await login('other'))('/consultations', 'POST', base2, 400);
        const other = await (await login('other'))('/consultations', 'POST', {...base2, details: { specialtyName: 'ENT' } }, 201);
        assert.equal(other.details.specialtyName, 'ENT');

        // 9: no creating records under another specialty or another doctor's name
        await ortho('/consultations', 'POST', {...base2, specialty: 'cardiologist', details: { bodyPart: 'Knee', laterality: 'Left' } }, 403);
        await ortho('/consultations', 'POST', {...base2, staffId: ids.cardio, details: { bodyPart: 'Knee', laterality: 'Left' } }, 403);

        // 10: saved records reopen with their own fields; a legacy account still works as General Practitioner
        const reopened = await ortho(`/consultations/${o.id}`);
        assert.equal(reopened.details.bodyPart, 'Knee');
        assert.equal(reopened.specialty, 'orthopedist');
        const legacyRecord = await legacy('/consultations', 'POST', base2, 201);
        assert.equal(legacyRecord.specialty, 'general-practitioner');

        // 11: changing a specialty later never relabels finalized records, and permissions change at once
        await admin(`/users/${ids.ortho}`, 'PATCH', { specialty: 'general-nurse' });
        assert.equal((await gp(`/consultations/${o.id}`)).specialty, 'orthopedist');
        await ortho(`/consultations/${o.id}`, 'GET', undefined, 403); // now a nurse, so no clinical records
        assert.equal((await Consultation.findById(o.id)).specialty, 'orthopedist');
        await ortho('/consultations', 'POST', base2, 403);
        assert.equal((await ortho('/workspace')).consultations.length, 0);
        await admin(`/users/${ids.ortho}`, 'PATCH', { specialty: 'orthopedist' });
        await ortho('/consultations', 'POST', {...base2, details: { bodyPart: 'Hip', laterality: 'Right' } }, 201);

        // 12: existing behaviour still works (workspace, dashboard, reports, audit logs)
        assert((await gp('/workspace')).consultations.length >= 6);
        assert.equal((await nurse2('/dashboard')).todaysConsultations, 0);
        assert((await gp('/reports/patients')).total >= 2);
        assert((await admin('/audit-logs')).items.length > 0);
        // the last administrator rule and self-protection still apply
        await admin('/users/admin', 'PATCH', { role: 'Clinic Staff', specialty: 'general-nurse' }, 400);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    }
});