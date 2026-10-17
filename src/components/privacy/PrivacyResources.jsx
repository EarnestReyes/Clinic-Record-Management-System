import React, { useState } from 'react';
import Modal from '../common/Modal.jsx';
import './privacy.css';

export const POLICY_VERSION = '2026-10-17';
const privacy = [
  //['Controller and contact', 'Careline is the clinic record management workspace. [Clinic review required: insert the legal name and address of the personal information controller, privacy officer, and verified privacy contact.] Until those details are confirmed, ask your clinic administrator for the authorized privacy contact. Do not send patient information to an unverified address.'],
  ['Information processed', 'Patient records may include names, birth dates, contact details, addresses, emergency contacts, allergies, conditions, intake notes, appointments, consultations, vital signs, and uploaded documents. Staff information includes account identity, contact details, role, specialty, profile image, preferences, password hashes, session records, and activity logs. Health information is sensitive personal information.'],
  ['Purposes and legal bases', 'The workspace supports patient intake, scheduling, treatment documentation, staff administration, and security. The clinic must confirm the applicable basis for each activity under RA 10173, including the additional conditions for sensitive information. Medical treatment and legal obligations may permit processing where their statutory conditions are satisfied; consent is not the basis for every activity. Optional purposes that rely on consent require a separate, specific choice. Reading this notice, signing in, and staff acceptance of terms do not establish patient consent. [Clinic review required: approve a purpose and legal-basis register.]'],
  ['Recipients and providers', 'Access is restricted by account role and patient or record assignment. The deployment uses Vercel for the frontend, Render for the API, and MongoDB Atlas for record storage. Password recovery can use configured Gmail SMTP. Google Fonts is requested for interface fonts and receives connection metadata such as the IP address. [Clinic review required: confirm enabled providers, authorized disclosures, processor agreements, and any additional recipients.]'],
  ['Hosting and transfers', 'Hosting, database, email, and font providers may process information outside the Philippines. [Clinic review required: confirm actual regions, international transfers, contractual safeguards, and provider responsibilities.] Do not assume a provider name establishes a particular storage location.'],
  ['Retention and deletion', 'Archiving preserves records; it does not erase them. The existing retention setting records an administrative preference and does not automatically delete patient history. [Clinic review required: approve retention schedules for medical records, accounts, documents, sessions, logs, and backups; legal holds; and secure disposal procedures.] No patient or account deletion is offered here.'],
  ['Security safeguards', 'The application uses HttpOnly session cookies, server-side session validation, CSRF checks for authenticated changes, restricted origins, rate limiting, and server-enforced access controls. Uploaded documents are served through authenticated endpoints. These measures reduce risk; they are not a certification or a guarantee. Staff should use unique passwords, keep devices secure, and sign out on shared devices.'],
  ['Your privacy rights', 'Subject to applicable conditions and exceptions, rights include being informed, access, correction, objection, erasure or blocking, data portability, and seeking damages. You may raise a complaint with the National Privacy Commission. Consent, where used, may be withdrawn for the relevant purpose; this does not necessarily end processing supported by another lawful basis.'],
  ['Requests and assistance', 'Ask the clinic administrator for the authorized privacy officer or request channel. State the type of request and a safe way to contact you; avoid sending medical documents through general chat or email. The clinic should verify identity and authority using proportionate checks and explain the outcome and any applicable limits. [Clinic review required: publish the verified channel, identity-verification procedure, response process, and escalation route.] This workspace does not submit privacy requests.'],
  ['Policy updates', 'This is a draft for review by the clinic’s authorized representative or privacy officer, not a claim of legal compliance. The version shown identifies this wording only; viewing it does not record acceptance. [Clinic review required: approve the effective date, publication process, and notification of material changes.]']
];
const terms = [
  ['Authorized clinic use', 'Use Careline only for assigned clinic duties and within the access granted to your individual account. Access to a record does not authorize unrelated use or disclosure.'],
  ['Account responsibilities', 'Keep your credentials private, use a unique password, and sign out on shared devices. Do not share accounts or allow another person to work under your identity. Ask the administrator to provision individual accounts and correct inappropriate access.'],
  ['Patient records and confidentiality', 'Enter accurate, relevant information and follow the clinic’s correction procedures. View, upload, download, print, or disclose records only for authorized purposes. Protect exported files and printed records under clinic policy. Do not place unnecessary health information in support messages.'],
  ['Acceptable use', 'Do not bypass access controls, browse records without a work-related purpose, upload malicious files, misrepresent your identity, or disrupt service. Follow the clinic’s approved procedures for sensitive documents and devices.'],
  ['Report suspected unauthorized access', 'Promptly contact the clinic administrator or authorized privacy officer if you suspect an exposed account, misplaced record, or unauthorized access. Use a verified channel and share only the details needed to investigate; never send passwords or session tokens.'],
  ['Suspension and termination', 'Authorized administrators can manage account access. [Clinic review required: confirm the organizational grounds, authority, review process, and staff offboarding procedures for suspension or termination.] Ending access does not itself delete patient records or override retention duties.'],
  ['Organizational policies and review', '[Clinic review required: identify applicable confidentiality, acceptable-use, record-management, incident-reporting, and employment policies; confirm the legal entity and effective date.] These draft terms require authorized review. No new acceptance contract is recorded here. Staff terms and privacy acknowledgment do not substitute for purpose-specific patient consent.']
];
const cookies = [
  ['Strictly necessary session cookie', 'careline_session keeps you signed in and supports session security. It is HttpOnly, scoped to /api, and configured for an eight-hour lifetime. Production uses Secure and SameSite=None; browser requests go through the site’s /api proxy. Signing out clears the cookie and invalidates that session. Blocking it may prevent sign-in. Cookie information is separate from authentication and patient consent.'],
  ['Appearance and local storage', 'careline-theme remembers the light or dark appearance selected on this browser. Account appearance, density, and in-app notification preferences are saved with your account. Change them in Appearance & Preferences or Notifications. Browser settings can clear local storage; doing so also removes the remembered appearance.'],
  ['Optional cookies', 'Careline currently implements no optional analytics or marketing cookies. There are no optional cookie choices to accept, reject, or withdraw, so no consent banner is shown. Reporting charts summarize clinic records; they are not visitor tracking. If optional tracking is introduced, it must be reviewed and gated by any required consent before loading, with versioned choices and equally accessible withdrawal.'],
  ['Browser controls', 'Your browser controls cookies and site permissions. This application cannot override a browser denial. The current workspace does not request notification, microphone, camera, or location permission. In-app notifications do not require browser notification permission. File selection shares only the file you choose; canceling the picker leaves the record unchanged.']
];
const resources = { privacy: { title: 'Privacy Notice', sections: privacy }, terms: { title: 'Terms of Use', sections: terms }, cookies: { title: 'Cookies & browser storage', sections: cookies } };

export default function PrivacyResources() {
  const [open, setOpen] = useState(null);
  const resource = resources[open];
  return <>
    <nav className="privacy-resource-links" aria-label="Privacy resources">
      {Object.entries(resources).map(([key, value]) => <button type="button" className="text-button" key={key} onClick={() => setOpen(key)}>{value.title}</button>)}
    </nav>
    {resource && <Modal title={resource.title} wide onClose={() => setOpen(null)}>
      <article className="modal-body privacy-document">
        <p className="privacy-version">Version {POLICY_VERSION}{open !== 'cookies' && ' '}</p>
        {resource.sections.map(([title, text]) => <section key={title}><h3>{title}</h3><p>{text}</p></section>)}
        {open === 'privacy' && <p>Reference: <a href="https://privacy.gov.ph/data-privacy-act-/" target="_blank" rel="noreferrer">Data Privacy Act of 2012</a> and <a href="https://privacy.gov.ph/wp-content/uploads/2023/11/NPC-Circular-No.-2023-04_Guidelines-on-Consent_07Nov2023.pdf" target="_blank" rel="noreferrer">NPC guidelines on consent</a>.</p>}
        <footer className="modal-footer"><button type="button" className="btn secondary" onClick={() => setOpen(null)}>Close</button></footer>
      </article>
    </Modal>}
  </>;
}
