import React from "react";
import Badge from "../common/Badge.jsx";
import { download } from "../../utils/helpers";
import { ArrowDownToLine } from "lucide-react";
export default function DocumentPreview({
  modal,
  notify
}) {
  return <div className="modal-body">
    <div className="row-between">
      <h3>
        {modal.item.name}
      </h3>
      <Badge>
        {modal.item.status}
      </Badge>
    </div>
    <pre className="document-preview">
      {modal.item.content}
    </pre>
    <button className="btn primary" onClick={() => {
      download(modal.item.name.replace(/\.pdf$/, '.txt'), modal.item.content);
      notify('Document downloaded');
    }}><ArrowDownToLine size={16} />Download text copy</button>
  </div>;
}
