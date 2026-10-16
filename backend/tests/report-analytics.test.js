import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { reportAnalytics, clinicDate } from '../../shared/reportAnalytics.js';
import { exportTable } from '../../shared/exportTables.js';
import { wordDocument } from '../../shared/wordDocument.js';

function parts(bytes) {
  const buffer = Buffer.from(bytes), files = {}; let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18), length = buffer.readUInt16LE(offset + 26), start = offset + 30 + length;
    files[buffer.toString('utf8', offset + 30, start)] = buffer.toString('utf8', start, start + size); offset = start + size;
  }
  return files;
}

test('analytics reconcile with included records for all types and use Manila date boundaries', () => {
  assert.equal(clinicDate('2026-10-15T16:01:00Z'), '2026-10-16');
  const rows = [{ id: '1', created: '2026-10-16', date: '2026-10-15T16:01:00Z', gender: 'Female', status: 'Active', specialty: 'cardiologist', action: 'Patient created' },
    { id: '2', created: '2026-10-18', date: '2026-10-18', gender: 'Male', status: 'Archived', specialty: 'orthopedist', action: 'Appointment completed' }];
  for (const type of ['patients','appointments','consultations','activity']) {
    const result = reportAnalytics(type, rows, { from: '2026-10-16', to: '2026-10-18' });
    assert.equal(result.total, 2); assert.equal(result.summary[0].value, 2);
    for (const chart of result.charts) assert.equal(chart.points.reduce((sum, point) => sum + point.value, 0), 2);
    assert.deepEqual(result.charts[0].points.map(point => point.value), [1,0,1]);
    assert.deepEqual(reportAnalytics(type, [], { from: '2026-10-16', to: '2026-10-18' }).charts, []);
  }
});

test('missing dates are disclosed, missing categories are explicit and large groups retain totals', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ action: `Action ${i}`, date: i ? '2026-01-01' : null }));
  const result = reportAnalytics('activity', rows, { from: '2026-01-01', to: '2026-12-31' });
  assert.equal(result.charts[0].points.reduce((sum, point) => sum + point.value, 0), 39);
  assert.equal(result.charts[1].points.reduce((sum, point) => sum + point.value, 0), 40);
  assert.equal(result.charts[1].points.length, 10);
  assert(result.notes[0].includes('1 included record'));
  const unknown = reportAnalytics('patients', [{ id:'unknown' }]);
  assert(!unknown.charts.some(chart => chart.trend));
  assert.equal(unknown.charts[0].points[0].label, 'Unknown / Not recorded');
});

test('analytical DOCX embeds actual native chart parts, relationships, statistics and detailed rows', () => {
  const rows = [{ id: 'P-1', name: 'Synthetic & Patient', gender: 'Female', status: 'Active', created: '2026-10-16' },
    { id: 'P-2', name: 'Synthetic Other', gender: 'Male', status: 'Archived', created: '2026-10-17' }];
  const analytics = reportAnalytics('patients', rows, { from: '2026-10-16', to: '2026-10-17' });
  const files = parts(wordDocument({ title: analytics.title, analytics, ...exportTable('patients', rows) }));
  const parser = new (new JSDOM('').window.DOMParser)();
  for (const content of Object.values(files)) assert.equal(parser.parseFromString(content, 'application/xml').querySelector('parsererror'), null);
  assert.equal(Object.keys(files).filter(name => name.startsWith('word/charts/')).length, 3);
  assert(files['word/document.xml'].includes('<w:drawing>'));
  assert(files['word/document.xml'].includes('Executive summary'));
  assert(files['word/document.xml'].includes('Detailed records'));
  assert(files['word/document.xml'].includes('Synthetic &amp; Patient'));
  assert(files['word/_rels/document.xml.rels'].includes('Target="charts/chart3.xml"'));
  for (let i = 0; i < analytics.charts.length; i++) {
    const chart = parser.parseFromString(files[`word/charts/chart${i+1}.xml`], 'application/xml');
    const values = [...chart.getElementsByTagName('c:numLit')[0].getElementsByTagName('c:v')].map(node => Number(node.textContent));
    assert.deepEqual(values, analytics.charts[i].points.map(point => point.value));
  }
});
