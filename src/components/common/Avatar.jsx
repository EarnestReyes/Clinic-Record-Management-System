import React from "react";
import { initials } from "../../utils/helpers.js";
export default function Avatar({
  name,
  size = '',
  index = 0
}) {
  return <span className={`avatar ${size} tone-${index % 5}`}>
    {initials(name)}
  </span>;
}
