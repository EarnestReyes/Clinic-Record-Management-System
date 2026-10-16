import React from "react";
import useTableSort, { sortDate } from "../../utils/useTableSort.jsx";
import SortControls from "../common/SortControls.jsx";
import { Stethoscope } from "lucide-react";
import { dateLabel } from "../../utils/helpers";
import ArrowUpRightIcon from "../common/ArrowUpRightIcon.jsx";
import Empty from "../common/Empty.jsx";
export default function VisitTimeline({
  records,
  setModal
}) {
  const table = useTableSort('date', 'desc');
  const rows = table.sort(records, (r, key) => key === 'date' ? sortDate(r.date) : r[key]);
  return records.length ? <div className="timeline">
    <SortControls table={table} label="Sort consultation history" options={[['date', 'Visit date'], ['type', 'Type'], ['staff', 'Attending staff'], ['id', 'Record ID']]} />
    {rows.map(r => <div className="timeline-item" key={r.id}>
      <span className="timeline-icon">
        <Stethoscope size={17} />
      </span>
      <div className="timeline-content">
        <div className="row-between">
          <div>
            <strong>
              {r.type}
            </strong>
            <span className="muted"> · {dateLabel(r.date)}</span>
          </div>
          <button className="text-button" onClick={() => setModal({
            type: 'record',
            item: r
          })}>View record<ArrowUpRightIcon /></button>
        </div>
        <p>
          {r.diagnosis}
        </p>
        <small>
          {r.staff}{' '}
          <span>· {r.id}</span>
        </small>
      </div>
    </div>)}
  </div> : <Empty title="No consultation history" />;
}
