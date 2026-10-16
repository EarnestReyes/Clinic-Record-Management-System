import React, { useRef, useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import { wordDocument, wordMime } from '../../../shared/wordDocument.js';
import { exportTable } from '../../../shared/exportTables.js';
import { saveBlob } from '../../services/api.js';
import { exportCSV } from '../../utils/helpers.js';

export default function ExportButton({ title, type, records, patient, clinic, subtitle, disabled = false, onExport, label = 'Export', recordCount = records?.length, formats = ['docx', 'csv'] }) {
  const [format, setFormat] = useState(formats[0]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const inFlight = useRef(false);
  const unavailable = disabled || recordCount === 0;
  const handleExport = async () => {
    if (inFlight.current || unavailable) return;
    inFlight.current = true;
    setBusy(true); setError(''); setSuccess('');
    try {
      if (onExport) await onExport(format);
      else {
        const table = exportTable(type, records, patient);
        const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (format === 'docx') await saveBlob(new Blob([wordDocument({ title, clinic, subtitle, ...table })], { type: wordMime }), filename + '.docx');
        else exportCSV(filename, table.rows.map(row => Object.fromEntries(table.columns.map(column => [column.label, row[column.key]]))), table.columns.map(column => column.label));
      }
      setSuccess('Download started.');
    } catch (failure) { setError(failure.message || 'Export failed. Please try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <div className="export-control" role="group" aria-label={`${title} export`} aria-busy={busy}>
    <div className="export-actions">
      <select aria-label={`${title} export format`} value={format} disabled={busy || unavailable} onChange={e => { setFormat(e.target.value); setError(''); setSuccess(''); }}>
        {formats.map(value => <option key={value} value={value}>{value === 'docx' ? 'Word (.docx)' : 'CSV (.csv)'}</option>)}
      </select>
      <button type="button" className="btn secondary" disabled={busy || unavailable} onClick={handleExport}>
        <ArrowDownToLine size={16} />{busy ? 'Exporting…' : label}
      </button>
    </div>
    <div className="export-feedback">
      {error ? <small className="form-error" role="alert">{error}</small>
        : <small role="status" aria-live="polite">{busy ? 'Preparing download…' : recordCount === 0 ? 'No records available to export.' : success}</small>}
    </div>
  </div>;
}
