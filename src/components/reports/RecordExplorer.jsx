import React, { useEffect, useRef, useState } from 'react';
import Card from '../common/Card.jsx';
import ExportButton from '../common/ExportButton.jsx';
import ReportTable from './ReportTable.jsx';
import useTableSort from '../../utils/useTableSort.jsx';
import { getReport, exportReport } from '../../services/api.js';

export default function RecordExplorer({ reportType, from, to, selection, onBack, notify }) {
  const table = useTableSort('date', 'desc');
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0 }), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const heading = useRef(null);
  const filter = selection?.filter || {};
  const encodedFilter = JSON.stringify(filter);
  const { key: sort, direction } = table.sorting;
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { if (selection) heading.current?.focus(); }, [selection]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    getReport(reportType, from, to, controller.signal, { mode: 'records', filter: JSON.parse(encodedFilter), search: query, page, limit: 25, sort, direction }).then(value => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(value.items) || !Number.isInteger(value.total)) throw new Error('Record results are incomplete. Please retry.');
      if (page > 1 && (page - 1) * 25 >= value.total) { setPage(Math.max(1, Math.ceil(value.total / 25))); return; }
      setResult(value); setLoading(false);
    }).catch(failure => { if (!controller.signal.aborted) { setError(failure.message); setLoading(false); } });
    return () => controller.abort();
  }, [reportType, from, to, encodedFilter, query, page, sort, direction, retry]);
  const pending = loading || search !== query;
  const sortingTable = { ...table, header: (key, label) => <th aria-sort={sort === key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" className="table-sort" onClick={() => { table.setSorting({ key, direction: sort === key && direction === 'asc' ? 'desc' : 'asc' }); setPage(1); }}>{label}{sort === key ? direction === 'asc' ? ' ↑' : ' ↓' : ''}</button></th> };
  return <Card className="report-explorer" title="Record Explorer" subtitle={selection?.label || `All ${reportType.toLowerCase()} in this report`}>
    <div className="report-explorer-controls">
      <h4 ref={heading} tabIndex={-1}>{selection?.label || 'Matching records'}</h4>
      {selection && <button type="button" className="btn secondary" onClick={onBack}>Back to Reports</button>}
      <p className="report-scope-note">{reportType} | {from} to {to}{filter.from ? ` | Selected period: ${filter.from} to ${filter.to}` : ''}{filter.field ? ` | ${filter.field}: ${filter.value ?? 'Other categories (combined)'}` : ''}{query ? ` | Search: ${query}` : ''}</p>
      <label>Search operational fields<input type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} placeholder="Record ID, patient ID, staff or category" /></label>
      <ExportButton title={`${reportType} matching records`} recordCount={result.total} disabled={pending || !!error} onExport={async format => { await exportReport(reportType, from, to, format, table.sorting, { mode: 'records', filter, search: query }); notify?.('Filtered report exported'); }} />
      <p role="status" aria-live="polite">{pending ? 'Loading matching records...' : error ? 'Results unavailable' : `${result.total} matching records | ${result.total ? (page - 1) * 25 + 1 : 0}-${Math.min(page * 25, result.total)} shown`}</p>
      <p className="report-scope-note">Operational fields only. Search and sorting apply to the complete matching dataset. Exports include all matches, up to 10,000 records.</p>
    </div>
    {error ? <div className="report-state" role="alert"><p>{error}</p><button type="button" className="btn secondary" onClick={() => setRetry(value => value + 1)}>Retry records</button></div> : !pending && <ReportTable rows={result.items} patient={() => null} sortingTable={sortingTable} reportType={reportType} serverSide />}
    <div className="report-explorer-pagination" aria-label="Record pages"><button type="button" className="btn secondary" disabled={pending || !!error || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(result.total / 25))}</span><button type="button" className="btn secondary" disabled={pending || !!error || page * 25 >= result.total} onClick={() => setPage(value => value + 1)}>Next</button></div>
    <p className="report-print-page-note">Printed records are limited to the displayed page ({result.items.length} of {result.total} matches). Use Export for the full filtered result.</p>
  </Card>;
}
