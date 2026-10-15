import React from "react";
import { initials } from "../../utils/helpers.js";
export default function Avatar({
  name,
  src,
  size = '',
  index = 0
}) {
  return <span className={`avatar ${size} tone-${index % 5}`}>
    {src ? <img src={src} alt="" /> : initials(name)}
  </span>;
}
