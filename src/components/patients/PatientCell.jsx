
import React from 'react';
import Avatar from '../common/Avatar.jsx';

export default function PatientCell({ p, data }) {
    const patientName = p?.name || 'Unknown patient';
    const patientId = p?.id || '';

    const patientIndex = patientId
        ? (data?.patients || []).findIndex(
            patient => patient.id === patientId
        )
        : -1;

    return (
        <div className="person">
            <Avatar
                name={patientName}
                index={patientIndex}
            />

            <div>
                <strong>{patientName}</strong>

                <small>
                    {patientId}
                    {p?.status === 'Archived' && ' · Archived'}
                </small>
            </div>
        </div>
    );
}
