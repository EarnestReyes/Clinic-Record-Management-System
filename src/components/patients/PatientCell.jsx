import React from "react";
import Avatar from "../common/Avatar.jsx";
export default function PatientCell({
  p,
  data
}) {
  return <div className="person">
    <Avatar name={p?.name} index={data.patients.findIndex(x => x.id === p?.id)} />
    <div>
      <strong>
        {p?.name || 'Unknown patient'}
      </strong>
      <small>
        {p?.id}
      </small>
    </div>
  </div>;
}
