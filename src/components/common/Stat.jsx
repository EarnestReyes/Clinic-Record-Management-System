import React from "react";
import { ArrowUpRight } from "lucide-react";
export default function Stat({
  icon: Icon,
  title,
  value,
  change,
  color = 'teal',
  note,
  neutral = false
}) {
  return <div className="stat">
    <div className="stat-top">
      <span>
        {title}
      </span>
      <span className={`stat-icon ${color}`}>
        <Icon size={19} />
      </span>
    </div>
    <div className="stat-value">
      {value}
      {!neutral && <span className="sparkline">▁▂▁▃▂▄▃▅</span>}
    </div>
    <div className="stat-note">
      <span>
        {!neutral && <ArrowUpRight size={13} />}
        {change}
      </span>
      {note || 'from last month'}
    </div>
  </div>;
}
