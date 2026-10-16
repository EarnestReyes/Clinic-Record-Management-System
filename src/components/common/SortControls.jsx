import React from 'react';

export default function SortControls({ table, options, label }) {
  return <div className="toolbar-filters">
    <label>{label}{' '}<select aria-label={label} value={table.sorting.key}
      onChange={event => table.setSorting(previous => ({ ...previous, key: event.target.value }))}>
      {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select></label>
    <button type="button" className="table-sort" aria-label={`${label}: ${table.sorting.direction === 'asc' ? 'ascending' : 'descending'}`}
      onClick={() => table.setSorting(previous => ({ ...previous, direction: previous.direction === 'asc' ? 'desc' : 'asc' }))}>
      {table.sorting.direction === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
    </button>
  </div>;
}
