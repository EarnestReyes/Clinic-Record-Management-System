
import React, { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import PasswordInput from "./PasswordInput.jsx";

function buildInitialValues(fields = [], values = {}) {
  const initial = {};

  fields.forEach((field) => {
    if (field.name) {
      initial[field.name] = field.defaultValue ?? "";
    }
  });

  return {
    ...initial,
    ...values,
  };
}

function getResetKey(fields, values) {
  return JSON.stringify({
    fields: fields.map((field) => ({
      name: field.name,
      defaultValue: field.defaultValue ?? "",
    })),
    values,
  });
}

export default function Form({
  fields = [],
  values = {},
  onSave,
  submit = "Save changes",
  onCancel,
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formValues, setFormValues] = useState(() =>
    buildInitialValues(fields, values)
  );

  const resetKey = getResetKey(fields, values);

  useEffect(() => {
    setFormValues(buildInitialValues(fields, values));
    setError("");
  }, [resetKey]); // Reset only when the actual initial data changes.

  const handleChange = (name, value) => {
    setFormValues((previous) => {
      const next = {
        ...previous,
        [name]: value,
      };

      fields
        .filter(
          (field) =>
            field.dependsOn === name ||
            (Array.isArray(field.dependsOn) &&
              field.dependsOn.includes(name))
        )
        .forEach((field) => {
          next[field.name] = "";
        });

      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    const submittedValues = {
      ...formValues,
      ...Object.fromEntries(new FormData(event.currentTarget)),
    };

    setSaving(true);
    setError("");

    try {
      if (typeof onSave !== "function") {
        throw new Error("The form save handler is not configured.");
      }

      if ((await onSave(submittedValues)) === false) {
        setError(
          "Changes were not saved. Review the error notification and try again."
        );
      }
    } catch (err) {
      setError(err?.message || "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        {fields
          .filter((field) => {
            if (
              field.name === "specialty" &&
              fields.some((item) => item.name === "role")
            ) {
              return formValues.role === "Clinic Staff";
            }

            return true;
          })
          .map((field) => {
            const Field = field.render ? "div" : "label";

            const availableOptions = field.optionsFor
              ? field.optionsFor(formValues)
              : field.options;

            const normalizedOptions = (availableOptions || []).map(
              (option) => ({
                value: String(option?.value ?? option),
                label: String(option?.label ?? option),
                disabled: Boolean(option?.disabled),
              })
            );

            const currentValue = String(formValues[field.name] ?? "");

            const hasCurrentOption = normalizedOptions.some(
              (option) => option.value === currentValue
            );

            // Never display a different option from the stored form value.
            const selectValue = hasCurrentOption ? currentValue : "";

            return (
              <Field
                key={field.name}
                className={field.wide ? "span-2" : ""}
              >
                {field.label}

                {field.required && (
                  <span className="required"> *</span>
                )}

                {field.render ? (
                  field.render(formValues, handleChange)
                ) : field.options || field.optionsFor ? (
                  <select
                    name={field.name}
                    value={selectValue}
                    required={field.required}
                    onChange={(event) =>
                      handleChange(field.name, event.target.value)
                    }
                  >
                    <option value="">
                      {field.placeholder ||
                        `Select ${String(field.label || field.name).toLowerCase()}`}
                    </option>

                    {normalizedOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    name={field.name}
                    value={formValues[field.name] ?? ""}
                    placeholder={field.placeholder}
                    rows={3}
                    required={field.required}
                    onChange={(event) =>
                      handleChange(field.name, event.target.value)
                    }
                  />
                ) : field.type === "password" ? (
                  <PasswordInput
                    name={field.name}
                    defaultValue={formValues[field.name] ?? ""}
                    required={field.required}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <input
                    name={field.name}
                    type={field.type || "text"}
                    value={formValues[field.name] ?? ""}
                    onChange={(event) =>
                      handleChange(field.name, event.target.value)
                    }
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    placeholder={field.placeholder}
                  />
                )}
              </Field>
            );
          })}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <footer className="modal-footer">
        <button
          type="button"
          className="btn secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          className="btn primary"
          type="submit"
          disabled={saving}
        >
          {saving ? "Saving..." : submit}
          <ChevronRight size={16} />
        </button>
      </footer>
    </form>
  );
}
