import React, { useState } from 'react';
import Modal from '../common/Modal.jsx';
import PolicyDocument from './PolicyDocument.jsx';
import { POLICY_VERSION, TERMS_VERSION } from '../../../shared/policies.js';
import './privacy.css';
export { POLICY_VERSION } from '../../../shared/policies.js';
const resources = { privacy: 'Privacy Policy', terms: 'Terms & Conditions', cookies: 'Cookies & browser storage' };
export default function PrivacyResources({ cookieLabel = 'Cookies & browser storage' }) {
  const [open, setOpen] = useState(null);
  return <>
    <nav className="privacy-resource-links" aria-label="Privacy resources">
      {Object.entries(resources).map(([key, title]) => <button type="button" className="text-button" key={key} onClick={() => setOpen(key)}>{key === 'cookies' ? cookieLabel : title}</button>)}
    </nav>
    {open && <Modal title={resources[open]} wide onClose={() => setOpen(null)}>
      <article className="modal-body privacy-document">
        <p className="privacy-version">Version {open === 'terms' ? TERMS_VERSION : POLICY_VERSION}</p>
        <PolicyDocument kind={open} />
        <footer className="modal-footer"><button type="button" className="btn secondary" onClick={() => setOpen(null)}>Close</button></footer>
      </article>
    </Modal>}
  </>;
}
