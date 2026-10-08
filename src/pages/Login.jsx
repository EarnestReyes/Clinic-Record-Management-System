import React from "react";
import Brand from "../components/layout/Brand.jsx";
import { Heart, Activity, ShieldCheck, Sun, Moon, Stethoscope } from "lucide-react";
import Avatar from "../components/common/Avatar.jsx";
import LoginForm from "../components/auth/LoginForm.jsx";
export default function Login({ dark, setDark, onLogin, connectionError }) {
  return <div className="login-page">
    <div className="login-story">
      <Brand />
      <div className="story-main">
        <span className="story-tag"><span className="live-dot" />BETTER CARE STARTS HERE</span>
        <h1>A healthier way<br />to run your clinic.</h1>
        <p>Less paperwork. More patient care.<br />One thoughtful workspace for everything that matters.</p>
        <div className="story-visual">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="heart-center">
            <Heart size={67} strokeWidth={1.4} />
            <Activity size={90} className="heart-pulse" />
          </div>
          <div className="floating-note note-one">
            <span className="stat-icon teal">
              <ShieldCheck size={22} />
            </span>
            <div>
              <strong>Care, connected.</strong>
              <small>Every record. One place.</small>
            </div>
          </div>
          <div className="floating-note note-two">
            <div className="avatar-stack">
              {['Sarah Mitchell', 'James Wilson', 'Emma Thompson'].map((n, i) => <Avatar key={n} name={n} index={i} />)}
            </div>
            <div>
              <strong>Built around people</strong>
              <small>Your team, in sync.</small>
            </div>
          </div>
        </div>
      </div>
      <div className="story-footer"><ShieldCheck size={16} /> A dedicated space for your clinic’s everyday care.</div>
    </div>
    <div className="login-form-side">
      <button className="login-theme icon-button" onClick={() => setDark(!dark)} aria-label="Toggle appearance">
        {dark ? <Sun /> : <Moon />}
      </button>
      <div className="login-box">
        <span className="welcome-icon">
          <Stethoscope size={28} />
        </span>
        <h2>Welcome back</h2>
        <p>Sign in to your Careline workspace.</p>
        <LoginForm onLogin={onLogin} connectionError={connectionError} />
        <div className="login-security"><ShieldCheck size={14} /> Secure clinic workspace · Records stored in MongoDB</div>
      </div>
      <p className="login-copyright">© 2026 Careline. Thoughtfully built for better care.</p>
    </div>
  </div>;
}
