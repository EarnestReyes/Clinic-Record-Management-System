import React from "react";
import { Stethoscope } from "lucide-react";
import { dateLabel } from "../../utils/helpers";
import ArrowUpRightIcon from "../common/ArrowUpRightIcon.jsx";
import Empty from "../common/Empty.jsx";
export default function VisitTimeline({
  records,
  setModal
}) {
  return records.length ? <div className="timeline">
    {records.map(r => <div className="timeline-item" key={r.id}>
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
