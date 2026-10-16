import test from 'node:test';
import assert from 'node:assert/strict';
import { wordDocument, wordMime } from '../../shared/wordDocument.js';
import { exportTable, sortReportRecords } from '../../shared/exportTables.js';
import { report } from '../controllers/reportController.js';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import Setting from '../models/Setting.js';
import AuditLog from '../models/AuditLog.js';

function entries(bytes) {
  const buffer = Buffer.from(bytes), files = {}; let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18), length = buffer.readUInt16LE(offset + 26), extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 30, offset + 30 + length), start = offset + 30 + length + extra;
    files[name] = buffer.toString('utf8', start, start + size); offset = start + size;
  }
  assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
  assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054b50);
  return files;
}

test('all export schemas produce genuine Word packages, safe text and readable empty documents', () => {
  for (const type of ['patients', 'consultations', 'appointments', 'activity']) {
    const table = exportTable(type, [{ id: 'R-1', name: 'José & <Ana>', patientId: 'P-1', date: '2026-10-16', created: '2026-10-16', diagnosis: 'Line one\nLine two', notes: 'PRIVATE INTERNAL FIELD' }], () => ({ name: 'José & <Ana>' }));
    const files = entries(wordDocument({ title: 'Clinic <report>', ...table }));
    assert(files['[Content_Types].xml'].includes('wordprocessingml.document.main+xml'));
    assert(files['word/document.xml'].includes('Clinic &lt;report&gt;'));
    assert(files['word/document.xml'].includes('<w:tblHeader/>'));
    assert(!files['word/document.xml'].includes('PRIVATE INTERNAL FIELD'));
    assert(files['word/footer1.xml'].includes('w:instr="PAGE"'));
    if (type !== 'activity') assert(files['word/document.xml'].includes('José &amp; &lt;Ana&gt;'));
    const empty = entries(wordDocument({ title: 'Empty', ...exportTable(type, []) }));
    assert(empty['word/document.xml'].includes('No records match'));
  }
  const files = entries(wordDocument({ title: 'Consultation', sections: [['Assessment', '0\nFollow-up & care\u0000']] }));
  assert(files['word/document.xml'].includes('<w:br/>'));
  assert(!files['word/document.xml'].includes('\u0000'));
  assert(!files['word/document.xml'].includes('w:orient="landscape"'));
});

test('document styling stays light and compact; long rows can paginate and report sorting is stable', () => {
  const rows = [{ id: 'b', date: '2026-10-16', value: 12 }, { id: 'a', date: '2025-01-01', value: 'Long text\n'.repeat(150) }];
  const document = entries(wordDocument({ title: 'Clinical report', clinic: { clinic: 'Configured Clinic' },
    columns: [{ key: 'id', label: 'ID' }, { key: 'value', label: 'Value' }], rows,
    generatedAt: new Date('2026-10-16T06:35:00Z'), subtitle: 'Period: October 2026' }));
  const body = document['word/document.xml'];
  assert(body.includes('Configured Clinic')); assert(body.includes('Total Records: 2'));
  assert(body.includes('Timezone: Asia/Manila')); assert(body.includes('Period: October 2026'));
  assert(body.includes('<w:background w:color="FFFFFF"/>')); assert(body.includes('w:fill="F5F8F8"'));
  assert(body.includes('<w:jc w:val="right"/>'));
  assert.equal((body.match(/<w:cantSplit\/>/g) || []).length, 2, 'header and short row stay together; tall row can split');
  assert(!document['word/styles.xml'].match(/TableHeading[\s\S]*?<w:keepNext/));
  assert(document['word/footer1.xml'].includes('Authorized Personnel Only'));
  assert(document['word/footer1.xml'].includes('NUMPAGES'));
  assert.deepEqual(sortReportRecords(rows, 'date', 'asc').map(row => row.id), ['a', 'b']);
  assert.equal(exportTable('appointments', [{ time: '13:05' }]).rows[0].time, '1:05 PM');
});

test('Word report uses authorized appointment scope and audits downloads', async t => {
  const doctor = { id: 'doctor', role: 'Clinic Staff', specialty: 'cardiologist' };
  t.mock.method(Appointment, 'find', filter => {
    assert.equal(filter.staffId, doctor.id);
    assert.equal(filter.specialty, doctor.specialty);
    return { sort: async () => [{ id: 'own-appointment-2', patientId: 'patient', date: '2026-10-16', time: '09:00', status: 'Completed' },
      { id: 'own-appointment', patientId: 'patient', date: '2026-10-16', time: '08:00', status: 'Completed' }] };
  });
  t.mock.method(Patient, 'find', filter => {
    assert.deepEqual(filter, { id: { $in: ['patient'] } });
    return { select: async () => [{ id: 'patient', name: 'Historical patient' }] };
  });
  t.mock.method(Setting, 'findById', async () => ({ clinic: 'Test Clinic' }));
  let logged = false;
  t.mock.method(AuditLog, 'create', async row => { logged = row.action === 'Report exported'; });
  let headers, bytes;
  await report({ user: doctor, params: { type: 'appointments' }, query: { from: '2026-01-01', to: '2026-12-31', format: 'docx', staffId: 'other', sort: 'id', direction: 'asc' } }, {
    set(value) { headers = value; return this; }, send(value) { bytes = value; }
  });
  assert.equal(headers['Content-Type'], wordMime);
  assert(headers['Content-Disposition'].includes('appointments-report.docx'));
  assert(logged);
  const document = entries(bytes)['word/document.xml'];
  assert(document.includes('own-appointment'));
  assert(document.includes('Historical patient'));
  assert(document.includes('Test Clinic'));
  assert(document.indexOf('own-appointment</w:t>') < document.indexOf('own-appointment-2</w:t>'));
});
