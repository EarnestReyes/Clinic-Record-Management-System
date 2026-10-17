import React, { useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import PolicyDocument from './PolicyDocument.jsx';
import { POLICY_VERSION, TERMS_VERSION } from '../../../shared/policies.js';
import './privacy.css';

export default function PolicyAcknowledgment({ onAccept, onDecline }) {
  const [privacy, setPrivacy] = useState(false), [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const working = useRef(false);
  async function run(action, kind) {
    if (working.current) return;
    working.current = true; setBusy(kind); setError('');
    try { await action(); }
    catch (failure) { setError(failure.message || 'Unable to complete this request. Please try again.'); }
    finally { working.current = false; setBusy(''); }
  }
  return <div className="policy-acknowledgment">
    <Modal title="Privacy & Terms" wide dismissible={false}>
      <div className="modal-body privacy-document">
        <span className="policy-ack-icon"><ShieldCheck size={28} aria-hidden="true" /></span>
        <p className="policy-ack-intro">Before entering your clinic workspace, review how information is handled and the responsibilities of authorized users.</p>
        <p>This is a staff privacy acknowledgment and Terms acceptance. It is not patient consent or blanket permission to process sensitive health information.</p>
        <details open><summary>Privacy Policy <span>{POLICY_VERSION}</span></summary><PolicyDocument kind="privacy" /></details>
        <details><summary>Terms & Conditions <span>{TERMS_VERSION}</span></summary><PolicyDocument kind="terms" /></details>
        <details><summary>Necessary authentication cookies</summary><PolicyDocument kind="cookies" /></details>
        <p>Authentication and security cookies are necessary for sign-in. There are no optional analytics or tracking cookies to accept here.</p>
        <div className="policy-ack-choices">
          <label><input type="checkbox" checked={privacy} disabled={!!busy} onChange={event => setPrivacy(event.target.checked)} /><span>I acknowledge that I have read the Privacy Policy.</span></label>
          <label><input type="checkbox" checked={terms} disabled={!!busy} onChange={event => setTerms(event.target.checked)} /><span>I accept the Terms & Conditions.</span></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="modal-footer policy-ack-actions">
          <button type="button" className="btn secondary" disabled={!!busy} onClick={() => run(onDecline, 'decline')}>{busy === 'decline' ? 'Signing out…' : 'Decline & Sign Out'}</button>
          <button type="button" className="btn primary" disabled={!privacy || !terms || !!busy} onClick={() => run(onAccept, 'accept')}>{busy === 'accept' ? 'Saving acknowledgment…' : 'Agree & Continue'}</button>
        </footer>
      </div>
    </Modal>
  </div>;
}
