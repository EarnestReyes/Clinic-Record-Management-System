import { displayIdentity } from '../../shared/displayIdentity.js';
import React, { useEffect, useState } from "react";
import { request } from '../services/api.js';
import useTableSort from "../utils/useTableSort.jsx";
import Card from "../components/common/Card.jsx";
import Avatar from "../components/common/Avatar.jsx";
import Badge from "../components/common/Badge.jsx";
import { Pencil } from "lucide-react";
import Empty from "../components/common/Empty.jsx";

export default function UserManagement({
  user,
  data,
  setModal,
  commit
}) {
  const table = useTableSort('name');
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [resending, setResending] = useState(null), [invitationNotice, setInvitationNotice] = useState('');
  async function resendInvitation(member) {
    if (resending) return;
    setResending(member.id); setInvitationNotice('');
    try {
      const result = await request(`/users/${encodeURIComponent(member.id)}/resend-invitation`, { method: 'POST', body: {} });
      setInvitationNotice(result.welcomeEmailStatus === 'accepted' ? 'The email provider accepted the invitation. Inbox delivery is not confirmed; check spam or junk.' : 'Invitation delivery failed. The account is preserved; check backend email diagnostics before retrying.');
    } catch (error) { setInvitationNotice(error.message); }
    finally { setResending(null); }
  }
  const [syncedUsers, setSyncedUsers] = useState(null), [syncError, setSyncError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (user?.role !== 'Administrator') return;
    let active = true, inFlight = false, controller;
    setSyncedUsers(null);
    const refresh = async () => {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true; controller = new AbortController();
      try {
        const result = await request('/users', { signal: controller.signal });
        if (!Array.isArray(result)) throw new Error('The team list could not refresh.');
        if (active) { setSyncedUsers(result); setSyncError(''); }
      } catch (error) { if (active && error.name !== 'AbortError') setSyncError(error.message); }
      finally { inFlight = false; }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; controller?.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [user?.role, data?.users, retry]);

  // Safely handle missing or incorrectly shaped workspace data.
  const baselineUsers = Array.isArray(data?.users) ? data.users : [];
  const photos = new Map((syncedUsers || []).map(member => [member.id, member]));
  const users = baselineUsers.map(member => {
    const photo = photos.get(member.id);
    return photo ? { ...member, hasAvatar: photo.hasAvatar, avatarVersion: photo.avatarVersion, pendingPasswordSetup: photo.pendingPasswordSetup } : member;
  });
  const specialties = Array.isArray(data?.specialties)
    ? data.specialties
    : [];

  const specialtyLabel = (key) =>
    specialties.find((s) => s.key === key)?.label;

  const effectiveSpecialty = (u) =>
    u.permissions?.specialty || u.specialty || "";
  const statusLabel = u => !u.active ? 'Inactive' : u.pendingPasswordSetup ? 'Pending password setup' : 'Active';

  const activeCount = users.filter((u) => u.active).length;

  const shown = users.filter(
    (u) =>
      specialtyFilter === "all" ||
      effectiveSpecialty(u) === specialtyFilter
  );

  if (user?.role !== "Administrator") {
    return (
      <Empty
        title="Administrator access required"
        text="Your clinic staff account does not have access to user management."
      />
    );
  }

  return (
    <Card
      title="Your care team"
      subtitle={`${activeCount} active team members`}
    >
      <div className="list-toolbar">
        {invitationNotice && <p role="status">{invitationNotice}</p>}
        {syncError && <div role="alert"><span>{syncError}</span><button type="button" className="text-button" onClick={() => setRetry(value => value + 1)}>Retry team refresh</button></div>}
        <select
          aria-label="Filter by specialty"
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
        >
          <option value="all">All specialties</option>

          {specialties.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {users.length === 0 ? (
        <Empty
          title="No team members found"
          text={
            Array.isArray(data?.users)
              ? "No personnel accounts are registered yet."
              : "The personnel list has not loaded correctly. Check the workspace API response."
          }
        />
      ) : shown.length === 0 ? (
        <Empty
          title="No matching personnel"
          text="Try selecting another professional specialty."
        />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {table.header('name', 'Team member')}
                {table.header('role', 'Access role')}
                {table.header('specialty', 'Profession / Field of Expertise')}
                {table.header('active', 'Status')}
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {table.sort(shown, (u, key) => key === 'specialty' ? specialtyLabel(effectiveSpecialty(u)) || 'None' : key === 'active' ? statusLabel(u) : key === 'role' ? (u.role === 'Clinic Staff' ? 'Medical Personnel' : u.role) : u[key]).map((u, i) => {
                const specialty = effectiveSpecialty(u);

                return (
                  <tr key={u.id}>
                    <td>
                      <div className="person">
                        <Avatar name={u.name} index={i} src={u.hasAvatar ? `/api/users/${encodeURIComponent(u.id)}/avatar?v=${u.avatarVersion || 0}` : undefined} />
                        <div>
                          <strong>
                            {u.name}
                            {u.id === user.id ? " (you)" : ""}
                          </strong>

                          <small>
                            {u.email}<span className="cell-sub">{displayIdentity(u)}</span>
                            {u.pendingEmail && (
                              <span className="pending-email">
                                Requested: {u.pendingEmail}
                              </span>
                            )}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <Badge>
                        {u.role === "Clinic Staff"
                          ? "Medical Personnel"
                          : u.role}
                      </Badge>
                    </td>

                    <td>
                      {specialtyLabel(specialty) || "None"}

                      {!specialty && u.role === "Clinic Staff" && (
                        <small className="cell-sub">
                          Specialty not set
                        </small>
                      )}
                    </td>

                    <td>
                      <Badge>
                        {statusLabel(u)}
                      </Badge>
                    </td>

                    <td>
                      <div className="row">
                        {u.active && specialties.some(item => item.key === specialty && item.kind === 'clinical') && (
                          <button className="btn secondary small" onClick={() => setModal({ type: 'availability', item: u })}>Availability</button>
                        )}
                        <button
                          className="btn secondary small"
                          onClick={() =>
                            setModal({
                              type: "user",
                              item: u
                            })
                          }
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        {u.active && u.pendingPasswordSetup === true && <button type="button" className="text-button" disabled={resending !== null} onClick={() => resendInvitation(u)}>{resending === u.id ? 'Sending invitation…' : 'Resend Invitation'}</button>}
                        {u.pendingEmail && (
                          <button
                            className="text-button"
                            onClick={() =>
                              setModal({
                                type: "user",
                                item: {
                                  ...u,
                                  email: u.pendingEmail
                                }
                              })
                            }
                          >
                            Review email request
                          </button>
                        )}

                        {u.id !== user.id && (
                          <button
                            className={`text-button ${
                              u.active ? "danger-text" : ""
                            }`}
                            onClick={() =>
                              setModal({
                                type: "confirm",
                                title: `${
                                  u.active ? "Deactivate" : "Activate"
                                } ${u.name}?`,
                                text: u.active
                                  ? "This user will no longer be able to sign in."
                                  : "This user will regain access to the clinic workspace.",
                                action: () =>
                                  commit(
                                    "users",
                                    baselineUsers.map((x) =>
                                      x.id === u.id
                                        ? {
                                            ...x,
                                            active: !x.active
                                          }
                                        : x
                                    ),
                                    u.active
                                      ? "User deactivated"
                                      : "User activated",
                                    u.name
                                  )
                              })
                            }
                          >
                            {u.active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
