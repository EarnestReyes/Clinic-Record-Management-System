import React from "react";
export default function Card({
  title,
  subtitle,
  action,
  children,
  className = ''
}) {
  return <section className={`card ${className}`}>
    <div className="card-heading">
      <div>
        <h3>
          {title}
        </h3>
        {subtitle && <p>
          {subtitle}
        </p>}
      </div>
      {action}
    </div>
    {children}
  </section>;
}
