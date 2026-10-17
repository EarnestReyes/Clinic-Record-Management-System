import React from 'react';
import { ShieldCheck, Upload, Palette, Mail } from 'lucide-react';
import Card from '../common/Card.jsx';
import { PRIVACY_POLICY } from '../../../shared/policies.js';
import './SettingsDetails.css';

const contact = PRIVACY_POLICY.match(/^Email: ([^\s@]+@[^\s@]+\.[^\s@]+)$/m)?.[1];
export default function PrivacySettingsDetails({ onAppearance }) {
  return <>
    <Card className="settings-details-card" title="Permissions and preferences" subtitle="Understand what your browser shares and personalize your workspace">
      <div className="settings-detail-list">
        <div className="settings-detail-item"><ShieldCheck size={20} aria-hidden="true" /><div><h4>Browser permissions</h4><p>Careline does not request camera, microphone, location or browser notification access. Updates appear inside your workspace. Browser settings control any restrictions; Careline cannot override those settings.</p></div></div>
        <div className="settings-detail-item"><Upload size={20} aria-hidden="true" /><div><h4>File selection</h4><p>Select only files authorized for clinic use. Canceling the file picker shares nothing. If selection is blocked, review your device or browser settings and try again.</p></div></div>
        <div className="settings-detail-item"><Palette size={20} aria-hidden="true" /><div><h4>Appearance preferences</h4><p>Choose your theme and interface density. No optional tracking cookies are implemented.</p><button type="button" className="btn secondary" onClick={onAppearance}>Manage appearance preferences</button></div></div>
      </div>
    </Card>
    <Card className="settings-details-card" title="Patient consent and privacy assistance" subtitle="Keep patient choices separate from staff account access">
      <div className="settings-detail-list">
        <section className="settings-detail-item"><div><h4>Patient Consent</h4><p>Careline does not currently record purpose-specific patient consent. Staff acknowledgment, Terms acceptance, sign-in and document uploads do not replace patient consent. Follow the clinic’s approved process and applicable lawful basis.</p></div></section>
        <section className="settings-detail-item"><div><h4>Privacy Rights and Requests</h4><p>For access, correction, an objection or another privacy request, contact the clinic’s authorized privacy office. Requests may require identity verification and are subject to applicable recordkeeping duties. This page does not submit requests or delete records.</p></div></section>
        <section className="settings-detail-item"><Mail size={20} aria-hidden="true" /><div><h4>Contact and Assistance</h4><p>Use the contact published in the clinic’s Privacy Policy. Do not include patient records, passwords or sensitive medical details in a general email.</p>{contact ? <a className="settings-contact-link" href={`mailto:${contact}`}>Email the Privacy and Data Protection Office<span>{contact}</span></a> : <p>Ask your clinic administrator for the verified privacy contact.</p>}<p className="settings-detail-note">Opens your email app; no request is submitted by Careline.</p></div></section>
      </div>
    </Card>
  </>;
}
