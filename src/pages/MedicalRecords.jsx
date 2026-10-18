
import { displayIdentity } from "../../shared/displayIdentity.js";
import React from "react";
import useTableSort, { sortDate } from "../utils/useTableSort.jsx";
import { Search, ArrowRight } from "lucide-react";
import { dateLabel } from "../utils/helpers";
import Empty from "../components/common/Empty.jsx";
import ExportButton from "../components/common/ExportButton.jsx";

export default function MedicalRecords({
  query,
  setQuery,
  data,
  patient,
  go,
  personCell,
  setModal
}) {
  const { sort, header } = useTableSort("date", "desc");

  const recordType = record =>
    record.recordType ||
    data.specialties?.find(
      specialty => specialty.key === "general-practitioner"
    )?.recordType ||
    "General consultation";

  const recordDate = record =>
    record.date || record.createdAt || "";

  const appointmentReference = record => {
    const appointmentId =
      record.appointmentId?._id ||
      record.appointmentId?.id ||
      record.appointmentId;

    const appointment = (data.appointments || []).find(
      item =>
        String(item._id || item.id) === String(appointmentId)
    );

    return appointment?.displayReference || "—";
  };

  const rows = sort(
    data.consultations.filter(record =>
      `${record.id} ${displayIdentity(record)} ${record.diagnosis} ${
        patient(record.patientId)?.name || ""
      } ${record.appointmentId || ""}`
        .toLowerCase()
        .includes(query.toLowerCase())
    ),
    (record, key) => {
      if (key === "date") return sortDate(recordDate(record));
      if (key === "recordType") return recordType(record);
      if (key === "patient") return patient(record.patientId)?.name;
      if (key === "id") return displayIdentity(record);
      return record[key];
    }
  );

  const matchesQuery = record =>
    `${record.id} ${displayIdentity(record)} ${record.diagnosis} ${
      patient(record.patientId)?.name || ""
    } ${record.appointmentId || ""}`
      .toLowerCase()
      .includes(query.toLowerCase());

  return (
    <section className="card">
      <div className="list-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search medical records"
            placeholder="Search patient, diagnosis, or record ID..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>

        <ExportButton
          title="Medical records"
          type="consultations"
          records={rows}
          patient={patient}
          clinic={data.settings}
          label="Export records"
          subtitle={
            query
              ? `Search: ${query}`
              : "All authorized medical records"
          }
        />
      </div>

      <div
        className="table-scroll bounded-table"
        tabIndex={0}
        role="region"
        aria-label="Medical records table"
      >
        <table>
          <thead>
            <tr>
              {header("patient", "Patient")}
              {header("date", "Record created")}
              {header("recordType", "Record type")}
              {header("diagnosis", "Assessment / Diagnosis")}
              {header("staff", "Attending staff")}
              {header("id", "Record ID")}
              <th>Appointment</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {rows.map(record => (
              <tr key={record.id}>
                <td>
                  <button
                    className="unstyled"
                    onClick={() =>
                      go("patients/" + record.patientId)
                    }
                  >
                    {personCell(patient(record.patientId))}
                  </button>
                </td>

                <td>
                  {dateLabel(recordDate(record))}
                  <small className="cell-sub">
                    {record.type}
                  </small>

                  {record.appointmentDate && (
                    <small className="cell-sub">
                      Appointment date:{" "}
                      {dateLabel(record.appointmentDate)}
                    </small>
                  )}
                </td>

                <td>{recordType(record)}</td>

                <td>{record.diagnosis}</td>

                <td>{record.staff}</td>

                <td>
                  <span className="record-id">
                    {displayIdentity(record)}
                  </span>
                </td>

                <td>
                  {appointmentReference(record)}
                </td>

                <td>
                  <button
                    className="text-button"
                    onClick={() =>
                      setModal({
                        type: "record",
                        item: record
                      })
                    }
                  >
                    View <ArrowRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!data.consultations.some(matchesQuery) && <Empty />}
    </section>
  );
}
