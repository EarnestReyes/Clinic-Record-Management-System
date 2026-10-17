import React from 'react';
import { PRIVACY_POLICY, TERMS_SECTIONS } from '../../../shared/policies.js';
import { COOKIE_SECTIONS } from './cookieInformation.js';

export default function PolicyDocument({ kind }) {
  if (kind === 'privacy') return <div className="policy-text" lang="en">{PRIVACY_POLICY.split(/\n\s*\n/).map((block, index) => {
    if (block.startsWith('- ')) return <ul key={index}>{block.split('\n').map((line, item) => <li key={item}>{line.slice(2)}</li>)}</ul>;
    if (!block.includes('\n') && block.length < 90 && !block.includes(':') && !block.endsWith('.')) return <h3 key={index}>{block}</h3>;
    return <p key={index}>{block}</p>;
  })}</div>;
  return <>{(kind === 'terms' ? TERMS_SECTIONS : COOKIE_SECTIONS).map(([title, text]) => <section key={title}><h3>{title}</h3><p>{text}</p></section>)}</>;
}
