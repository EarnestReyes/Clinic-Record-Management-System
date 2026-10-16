import React from "react";
import Brand from "./Brand.jsx";
import {
  Stethoscope,
  ChevronDown,
  Heart,
  ArrowRight,
  MoreHorizontal,
} from "lucide-react";
import { navigation } from "../../data/navigation.js";
import Avatar from "../common/Avatar.jsx";

export default function Sidebar({
  sidebar,
  setSidebar,
  data,
  user,
  pageName,
  selected,
  go,
  todays,
  setModal,
  setPanel,
  panel,
}) {
  // Safely handle data that may not have loaded yet.
  const settings = data?.settings ?? {};
  const permissions = data?.permissions ?? {};
  const specialties = data?.specialties ?? [];
  const currentUser = user ?? {};
  const appointments = Array.isArray(todays) ? todays : [];

  // Restrict protected menu items when permission data is unavailable.
  const canViewRecords = permissions.viewRecords === true;
  const canViewReports = permissions.viewReports === true;
  const canViewAuditLogs = permissions.viewAuditLogs === true;

  const visibleNavigation = (navigation ?? []).map((group) => ({
    ...group,
    items: (group.items ?? []).filter(([name]) => {
      if (
        ['User Management', 'Doctor Patient Directory'].includes(name) &&
        currentUser.role !== "Administrator"
      ) {
        return false;
      }

      if (name === "Medical Records" && !canViewRecords) {
        return false;
      }

      if (name === "Reports" && !canViewReports) {
        return false;
      }

      if (name === "Audit Logs" && !canViewAuditLogs) {
        return false;
      }

      return true;
    }),
  }));

  const specialtyLabel =
    specialties.find((specialty) => specialty.key === currentUser.specialty)
      ?.label;

  const userLabel =
    specialtyLabel ||
    (currentUser.role === "Clinic Staff"
      ? "Medical Personnel"
      : currentUser.role || "User");

  return (
    <>
      <div
        className={`sidebar-overlay ${sidebar ? "visible" : ""}`}
        onClick={() => setSidebar(false)}
      />

      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <Brand />

        <div className="workspace-label">
          <span className="clinic-mark">
            {settings.hasLogo ? (
              <img
                className="clinic-logo"
                src={`/api/settings/logo?v=${settings.logoVersion ?? 0}`}
                alt="Clinic logo"
              />
            ) : (
              <Stethoscope size={17} />
            )}
          </span>

          <div>
            <strong>{settings.clinic || "Clinic Workspace"}</strong>
            <small>Clinic workspace</small>
          </div>

          <ChevronDown size={14} />
        </div>

        <nav>
          {visibleNavigation.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>

              {group.items.map(([name, Icon]) => (
                <button
                  key={name}
                  title={name}
                  className={`nav-link ${
                    pageName === name ||
                    (selected && name === (pageName === "Archived Patient Profile" ? "Archived Patients" : "Patients"))
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    go(name.toLowerCase().replaceAll(" ", "-"))
                  }
                >
                  <Icon size={19} />

                  <span>{name === 'Patients' ? (permissions.intake ? 'Patient Intake' : currentUser.role === 'Clinic Staff' ? 'Assigned Patients' : name) : name}</span>

                  {name === "Appointments" && (
                    <span className="nav-count">
                      {
                        appointments.filter(
                          (appointment) =>
                            appointment.status === "Scheduled"
                        ).length
                      }
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="support-icon">
              <Heart size={18} />
            </span>

            <strong>A little help, anytime.</strong>

            <p>Make the most of your workspace.</p>

            <button onClick={() => setModal({ type: "help" })}>
              Help &amp; resources
              <ArrowRight size={14} />
            </button>
          </div>

          <button
            className="sidebar-user"
            onClick={() =>
              setPanel(panel === "user" ? "" : "user")
            }
          >
            <Avatar
              name={currentUser.name || "User"}
              src={
                currentUser.hasAvatar
                  ? `/api/auth/avatar?v=${currentUser.avatarVersion ?? 0}`
                  : undefined
              }
            />

            <div>
              <strong>{currentUser.name || "User"}</strong>
              <small>{userLabel}</small>
            </div>

            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
