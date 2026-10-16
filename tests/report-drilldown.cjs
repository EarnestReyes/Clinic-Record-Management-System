// Focused component workflow with synthetic API responses; no server or MongoDB connection.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
for (const key of ['window','document','navigator','HTMLElement']) Object.defineProperty(global,key,{ configurable: true,value: key === 'window' ? dom.window : dom.window[key] });
global.IS_REACT_ACT_ENVIRONMENT = true;
const babel = require('@babel/core');
for (const ext of ['.js','.jsx']) {
  const original = require.extensions[ext] || require.extensions['.js'];
  require.extensions[ext] = (module, filename) => {
    if (!filename.startsWith(path.resolve(__dirname,'../src'))) return original(module,filename);
    module._compile(babel.transformSync(fs.readFileSync(filename,'utf8'),{ filename,configFile: false,babelrc: false,presets: [[require.resolve('@babel/preset-env'),{ targets: { node: 'current' } }],[require.resolve('@babel/preset-react'),{ runtime: 'automatic' }]] }).code,filename);
  };
}
require.extensions['.css'] = () => {};
const React = require('react');
const { render, screen, fireEvent, waitFor, within, cleanup } = require('@testing-library/react');
const { reportAnalytics } = require('../shared/reportAnalytics.js');
const rows = Array.from({ length: 60 }, (_,index) => ({ id: `record-${String(index).padStart(2,'0')}`, patientId: 'synthetic-patient', name: `Synthetic ${index}`, gender: 'Other', date: index < 40 ? '2026-01-16' : '2026-02-16', created: index < 40 ? '2026-01-16' : '2026-02-16', status: index % 2 ? 'Completed' : 'Cancelled', specialty: 'cardiologist', type: 'Review' }));
const ids = { Patients: 'patients',Appointments: 'appointments',Consultations: 'consultations','Clinic Activity': 'activity' };
const calls = [], downloads = [];
let failRecords = false;
const apiPath = path.resolve(__dirname,'../src/services/api.js');
require.cache[apiPath] = { id: apiPath,filename: apiPath,loaded: true,exports: {
  reportTypeId: type => ids[type],
  getReport: async (type,from,to,signal,options) => {
    calls.push({ type,from,to,options });
    if (options.mode === 'records' && failRecords) throw new Error('Synthetic record error');
    let included = rows.filter(row => row.date >= from && row.date <= to);
    if (options.mode === 'summary') return { analytics: reportAnalytics(ids[type],included,{ from,to }),generatedAt: '2026-02-20T00:00:00Z' };
    const filter = options.filter;
    if (filter.field) included = included.filter(row => row[filter.field] === filter.value);
    if (filter.from) included = included.filter(row => row.date >= filter.from && row.date <= filter.to);
    if (options.search) included = included.filter(row => row.id.includes(options.search));
    included.sort((a,b) => (a[options.sort === 'id' ? 'id' : 'date'].localeCompare(b[options.sort === 'id' ? 'id' : 'date']) || a.id.localeCompare(b.id)) * (options.direction === 'asc' ? 1 : -1));
    return { items: included.slice((options.page - 1) * options.limit, options.page * options.limit),total: included.length };
  },
  exportReport: async (...args) => downloads.push(args)
} };
const Reports = require('../src/pages/Reports.jsx').default;
const data = { settings: { clinic: 'Synthetic Clinic' } };
function Harness() {
  const [reportType,setReportType] = React.useState('Appointments'), [from,setFrom] = React.useState('2026-01-01'), [to,setTo] = React.useState('2026-02-28');
  return React.createElement(Reports,{ reportType,setReportType,from,setFrom,to,setTo,data,patient: () => null,notify: () => {} });
}
const explorer = () => document.querySelector('.report-explorer');
async function count(value) { await waitFor(() => assert(within(explorer()).getByText(new RegExp(`^${value} matching records`)))); }
async function run() {
  render(React.createElement(Harness));
  await count(60);
  fireEvent.click(screen.getByRole('button',{ name: 'Cancelled: 30. Show matching records' }));
  await count(30);
  assert.deepEqual(calls.at(-1).options.filter,{ field: 'status',value: 'Cancelled' });
  assert.equal(calls.at(-1).from,'2026-01-01'); assert.equal(calls.at(-1).to,'2026-02-28');
  assert.equal(explorer().querySelectorAll('.report-screen-records tbody tr').length,25);
  fireEvent.click(within(explorer()).getByRole('button',{ name: 'Next' }));
  await waitFor(() => assert.equal(explorer().querySelectorAll('.report-screen-records tbody tr').length,5));
  assert.equal(calls.at(-1).options.page,2);
  fireEvent.click(within(explorer()).getByRole('button',{ name: /^Record ID/ }));
  await waitFor(() => assert.equal(calls.at(-1).options.sort,'id'));
  await count(30); assert.equal(calls.at(-1).options.page,1);
  fireEvent.change(within(explorer()).getByLabelText('Search operational fields'),{ target: { value: 'record-00' } });
  await count(1); assert.equal(calls.at(-1).options.search,'record-00');
  fireEvent.click(within(explorer()).getByRole('button',{ name: 'Export',exact: true }));
  await waitFor(() => assert.equal(downloads.length,1));
  assert.deepEqual(downloads[0].at(-1),{ mode: 'records',filter: { field: 'status',value: 'Cancelled' },search: 'record-00' });
  fireEvent.click(within(explorer()).getByRole('button',{ name: 'Back to Reports' })); await count(60);
  fireEvent.keyDown(screen.getByRole('button',{ name: '2026-01: 40 records. Show matching records' }),{ key: 'Enter' });
  await count(40); assert.deepEqual(calls.at(-1).options.filter,{ from: '2026-01-01',to: '2026-01-31' });
  fireEvent.change(screen.getByLabelText('From'),{ target: { value: '2026-02-01' } });
  await count(20); assert.deepEqual(calls.at(-1).options.filter,{}); assert.equal(calls.at(-1).from,'2026-02-01');
  failRecords = true;
  fireEvent.click(screen.getByRole('button',{ name: 'Completed: 10. Show matching records' }));
  await screen.findByText('Synthetic record error');
  assert.equal(within(explorer()).getByRole('button',{ name: 'Next' }).disabled,true);
  failRecords = false;
  fireEvent.click(screen.getByRole('button',{ name: 'Retry records' })); await count(10);
  fireEvent.click(screen.getByRole('button',{ name: 'Patient Analytics',exact: true }));
  await count(20); assert.equal(calls.at(-1).type,'Patients'); assert.deepEqual(calls.at(-1).options.filter,{});
  fireEvent.change(screen.getByLabelText('From'),{ target: { value: '2026-02-20' } });
  await count(0); assert.equal(within(explorer()).getByRole('button',{ name: 'Export',exact: true }).disabled,true);
  assert(screen.getByText('No data in this date range'));
  cleanup();
  console.log('PASS: KPI/chart keyboard drill-down, context preservation, pagination, sorting, search, filtered export, retry and empty data.');
}
run().catch(error => { console.error(error); process.exitCode = 1; cleanup(); });
