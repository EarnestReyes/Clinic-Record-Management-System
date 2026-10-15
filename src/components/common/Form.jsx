import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import PasswordInput from "./PasswordInput.jsx";

export default function Form({
  fields,
  values = {},
  onSave,
  submit = "Save changes",
  onCancel
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formValues, setFormValues] = useState(values);

  const handleChange = (name, value) => {
    setFormValues(previous => {
      const next = { ...previous, [name]: value };
      fields.filter(field => field.dependsOn === name || (Array.isArray(field.dependsOn) && field.dependsOn.includes(name))).forEach(field => { next[field.name] = ''; });
      return next;
    });
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (saving) return;

        const submittedValues = Object.fromEntries(
          new FormData(e.currentTarget)
        );

        setSaving(true);
        setError("");

        try {
          if (await onSave(submittedValues) === false) {
            setError('Changes were not saved. Review the error notification and try again.');
          }
        } catch (error) {
          setError(error.message || "Unable to save changes.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="form-grid">
        {fields
          .filter((field) => {
            if (field.name === "specialty" && fields.some(item => item.name === 'role')) {
              return formValues.role === "Clinic Staff";
            }
            return true;
          })
          .map((f) => {
            const Field = f.render ? 'div' : 'label';
            return <Field
              key={f.name}
              className={f.wide ? "span-2" : ""}
            >
              {f.label}
              {f.required && (
                <span className="required"> *</span>
              )}

              {f.render ? f.render(formValues, handleChange) : f.options ? (
                <select
                  name={f.name}
                  value={
                    (f.dependsOn && !f.options.some(option => (option.value ?? option) === formValues[f.name]) ? '' : formValues[f.name]) ??
                    f.options[0]?.value ??
                    f.options[0] ??
                    ""
                  }
                  required={f.required}
                  onChange={(e) =>
                    handleChange(f.name, e.target.value)
                  }
                >
                  {(f.optionsFor ? f.optionsFor(formValues) : f.options).map((option) => (
                    <option
                      key={option.value ?? option}
                      value={option.value ?? option}
                      disabled={option.disabled}
                    >
                      {option.label ?? option}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.name}
                  defaultValue={values[f.name] || ""}
                  rows={3}
                  required={f.required}
                />
              ) : f.type === "password" ? (
                <PasswordInput
                  name={f.name}
                  defaultValue={values[f.name] ?? ""}
                  required={f.required}
                  placeholder={f.placeholder}
                />
              ) : (
                <input
                  name={f.name}
                  type={f.type || "text"}
                  value={formValues[f.name] ?? ""}
                  onChange={e => handleChange(f.name, e.target.value)}
                  required={f.required}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  placeholder={f.placeholder}
                />
              )}
            </Field>;
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
