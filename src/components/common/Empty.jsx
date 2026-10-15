import React from "react";
import { Search } from "lucide-react";
export default function Empty({
  title = 'No records found',
  text = 'Try adjusting your search or add a new record.'
}) {
  return <div className="empty">
    <Search size={30} />
    <h3>
      {title}
    </h3>
    <p>
      {text}
    </p>
  </div>;
}
