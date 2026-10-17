import React, { useState } from 'react';
import { Upload, FileText, Eye, ArrowDownToLine, RotateCcw, Archive, Search } from 'lucide-react';
import Card from '../common/Card.jsx';
import Badge from '../common/Badge.jsx';
import SortControls from '../common/SortControls.jsx';
import useTableSort, { sortDate } from '../../utils/useTableSort.jsx';
import { dateLabel } from '../../utils/helpers';
import { documents } from '../../services/api.js';
import './PatientDocuments.css';

export default function PatientDocuments({ selected, data, setModal, notify, commit }) {
  const sort = useTableSort('date', 'desc');
  const [status, setStatus] = useState('Active'), [query, setQuery] = useState('');
  if (!data.permissions.viewRecords) return null;
  const rows = data.documents.filter(row => row.patientId === selected.id);
  const statusRows = rows.filter(row => row.status === status);
  const shown = sort.sort(statusRows.filter(row => `${row.name} ${row.type} ${row.date}`.toLowerCase().includes(query.trim().toLowerCase())),
    (row, key) => key === 'date' ? sortDate(row.date) : row[key]);
  const canUpload = selected.status === 'Active';
  const upload = () => setModal({ type: 'upload', patientId: selected.id });
  const reset = () => { setQuery(''); setStatus(rows.some(row => row.status === 'Active') ? 'Active' : 'Archived'); };
  return <Card className="patient-documents" title="Patient documents" subtitle="Private patient documents, stored securely in your clinic database"
    action={canUpload && <button type="button" className="btn primary" onClick={upload}><Upload size={16} />Upload document</button>}>
    <div className="patient-document-toolbar">
      <div className="tabs" role="group" aria-label="Document status filter">{['Active', 'Archived'].map(value =>
        <button key={value} type="button" aria-pressed={status === value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{value} ({rows.filter(row => row.status === value).length})</button>)}</div>
      <div className="patient-document-controls">
        <label className="patient-document-search"><Search size={16} aria-hidden="true" /><span className="document-sr-only">Search patient documents</span><input type="search" placeholder="Search name, type or date" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <SortControls table={sort} label="Sort documents" options={ [['date', 'Date'], ['name', 'Name'], ['type', 'Type'], ['status', 'Status']] } />
      </div>
      <p className="patient-document-count" role="status">{shown.length} of {statusRows.length} {status.toLowerCase()} document{statusRows.length === 1 ? '' : 's'}</p>
    </div>
    {shown.length ? <div className="document-grid">{shown.map(row => <article className="document-card" key={row.id}>
      <div className="document-card-top"><span className="document-icon"><FileText size={22} aria-hidden="true" /></span><Badge>{row.status}</Badge></div>
      <h3>{row.name}</h3><p>{row.type} · {dateLabel(row.date)}</p>
      <div className="document-actions">
        <button type="button" className="text-button" onClick={() => setModal({ type: 'document', item: row })}><Eye size={16} />Preview</button>
        <button type="button" className="icon-button" aria-label={`Download ${row.name}`} title="Download document" onClick={async () => { try { await documents.download(row); notify('Document downloaded'); } catch (error) { notify(error.message); } }}><ArrowDownToLine size={16} /></button>
        {canUpload && <button type="button" className="icon-button" aria-label={`${row.status === 'Archived' ? 'Restore' : 'Archive'} ${row.name}`} title={row.status === 'Archived' ? 'Restore document' : 'Archive document'} onClick={() => setModal({
          type: 'confirm', title: row.status === 'Archived' ? 'Restore document?' : 'Archive document?',
          text: row.name + ' will be preserved in this patient’s document history.',
          action: () => commit('documents', data.documents.map(item => item.id === row.id ? { ...item, status: row.status === 'Active' ? 'Archived' : 'Active' } : item),
            'Document ' + (row.status === 'Active' ? 'archived' : 'restored'), selected.name + ' · ' + row.name)
        })}>{row.status === 'Archived' ? <RotateCcw size={16} /> : <Archive size={16} />}</button>}
      </div>
    </article>)}</div> : <div className="patient-document-empty">
      <span className="patient-document-empty-icon"><FileText size={25} aria-hidden="true" /></span>
      <h4>{rows.length ? 'No matching documents' : 'No documents yet'}</h4>
      <p>{rows.length ? 'Try another search or switch document status.' : 'Add a document to keep this patient’s supporting records together.'}</p>
      {rows.length ? <button type="button" className="btn secondary" onClick={reset}>Reset filters</button> : canUpload && <button type="button" className="btn secondary" onClick={upload}><Upload size={16} />Upload document</button>}
    </div>}
  </Card>;
}
