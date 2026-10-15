import React from "react";
import Form from "../common/Form.jsx";

export default function UserForm({
  modal,
  user,
  setModal,
  data,
  notify,
  commit
}) {
  // System access role.
  const roleOptions =
    modal.item?.id === user.id
      ? [{ value: "Administrator", label: "Administrator" }]
      : [
          { value: "Clinic Staff", label: "Medical Personnel" },
          { value: "Administrator", label: "Administrator" }
        ];

  // Load specialties from the backend.
  const specialties = Array.isArray(data?.specialties)
    ? data.specialties
    : [];

  const specialtyOptions = specialties.map((s) => ({
    value: s.key,
    label: s.label
  }));

  // Support existing accounts with specialties in either location.
  let currentSpecialty =
    modal.item?.specialty ||
    modal.item?.permissions?.specialty ||
    "";

  if (
    modal.item &&
    !currentSpecialty &&
    modal.item.role === "Clinic Staff"
  ) {
    currentSpecialty = "general-practitioner";
  }

  return (
    <Form
      fields={[
        {
          name: "name",
          label: "Full name",
          required: true
        },
        {
          name: "email",
          label: "Email",
          type: "email",
          required: true
        },
        {
          name: "role",
          label: "System access role",
          options: roleOptions,
          required: true
        },
        {
          name: "specialty",
          label: "Professional specialty",
          options: specialtyOptions,
          required: true
        },
        {
          name: "password",
          label: modal.item
            ? "New password (optional)"
            : "Password (12+ characters)",
          type: "password",
          required: !modal.item
        }
      ]}
      values={{
        ...(modal.item || {}),
        role: modal.item?.role || "Clinic Staff",
        specialty: currentSpecialty,
        password: ""
      }}
      onCancel={() => setModal(null)}
      onSave={(v) => {
        const existingUsers = Array.isArray(data?.users)
          ? data.users
          : [];

        if (
          existingUsers.some(
            (u) =>
              u.id !== modal.item?.id &&
              u.email?.toLowerCase() === v.email?.trim().toLowerCase()
          )
        ) {
          return notify("This email address is already in use");
        }

        // Require specialty only for Medical Personnel.
        if (v.role === "Clinic Staff" && !v.specialty) {
          throw new Error(
            "Choose a professional specialty for medical personnel."
          );
        }

        // Clear specialty when the account is an Administrator.
        const specialty =
          v.role === "Clinic Staff" ? v.specialty : "";

        const updatedUser = {
          ...v,
          email: v.email.trim(),
          specialty,
          id: modal.item?.id || "U-" + Date.now(),
          active: modal.item?.active ?? true,
          password: v.password || modal.item?.password
        };

        const updatedUsers = modal.item
          ? existingUsers.map((x) =>
              x.id === updatedUser.id ? updatedUser : x
            )
          : [...existingUsers, updatedUser];

        return commit(
          "users",
          updatedUsers,
          modal.item ? "User edited" : "User created",
          updatedUser.name
        );
      }}
    />
  );
}