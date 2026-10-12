import React from "react";
export default function Badge({
  children
}) {
  return <span className={`badge ${String(children).toLowerCase().replaceAll(' ', '-')}`}>
    {children}
  </span>;
}
