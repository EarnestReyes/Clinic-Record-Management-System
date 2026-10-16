import React, { useState } from 'react';

export function sortRows(rows, sorting, value = (row, key) => row[key]) {
  return rows.map((row, index) => ({ row, index })).sort((a, b) => {
    const normalize = raw => typeof raw === 'number' ? (Number.isFinite(raw) ? raw : null)
      : raw == null ? null : String(raw).trim().toLowerCase();
    const av = normalize(value(a.row, sorting.key)), bv = normalize(value(b.row, sorting.key));
    const missing = v => v == null || v === '';
    const result = missing(av) ? (missing(bv) ? 0 : 1) : missing(bv) ? -1
      : (typeof av === 'number' && typeof bv === 'number' ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true })) * (sorting.direction === 'asc' ? 1 : -1);
    return result || a.index - b.index;
  }).map(item => item.row);
}

export const sortDate = value => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

export default function useTableSort(key, direction = 'asc') {
  const [sorting, setSorting] = useState({ key, direction });
  const toggle = key => setSorting(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }));
  const header = (key, label) => <th aria-sort={sorting.key === key ? (sorting.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button type="button" className="table-sort" onClick={() => toggle(key)}>
      {label}<span aria-hidden="true">{sorting.key === key ? sorting.direction === 'asc' ? ' ↑' : ' ↓' : ' ↕'}</span>
    </button>
  </th>;
  return { sorting, setSorting, header, sort: (rows, value) => sortRows(rows, sorting, value) };
}
