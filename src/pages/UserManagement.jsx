import React, { useState } from "react";
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

  // Safely handle missing or incorrectly shaped workspace data.
  const users = Array.isArray(data?.users) ? data.users : [];
  const specialties = Array.isArray(data?.specialties)
    ? data.specialties
    : [];

  const specialtyLabel = (key) =>
    specialties.find((s) => s.key === key)?.label;

  const effectiveSpecialty = (u) =>
    u.permissions?.specialty || u.specialty || "";

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
              {table.sort(shown, (u, key) => key === 'specialty' ? specialtyLabel(effectiveSpecialty(u)) || 'None' : key === 'active' ? (u.active ? 'Active' : 'Inactive') : key === 'role' ? (u.role === 'Clinic Staff' ? 'Medical Personnel' : u.role) : u[key]).map((u, i) => {
                const specialty = effectiveSpecialty(u);

                return (
                  <tr key={u.id}>
                    <td>
                      <div className="person">
                        <Avatar name={u.name} index={i} />
                        <div>
                          <strong>
                            {u.name}
                            {u.id === user.id ? " (you)" : ""}
                          </strong>

                          <small>
                            {u.email}
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
                        {u.active ? "Active" : "Inactive"}
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
                                    users.map((x) =>
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
