const BASE = '/api';

let csrfToken = '';

export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

// Refresh the CSRF token using the current authenticated session.
async function refreshCsrfToken() {
    try {
        const response = await fetch(`${BASE}/auth/me`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) return false;

        const data = await response.json();

        if (!data.csrfToken) return false;

        csrfToken = data.csrfToken;
        return true;
    } catch {
        return false;
    }
}

export async function request(
    path, {
        method = 'GET',
        body,
        signal,
        binary = false,
        csrfRetried = false
    } = {}
) {
    const headers = {};

    if (body !== undefined && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (!['GET', 'HEAD'].includes(method)) {
        headers['X-CSRF-Token'] = csrfToken;
    }

    let response;

    try {
        response = await fetch(`${BASE}${path}`, {
            method,
            headers,
            credentials: 'include',
            signal,
            body: body === undefined ?
                undefined : body instanceof FormData ?
                body : JSON.stringify(body)
        });
    } catch (error) {
        if (error.name === 'AbortError') {
            throw error;
        }

        throw new ApiError(
            'Cannot reach the clinic API. Check that the backend and MongoDB are running.',
            0
        );
    }

    if (!response.ok) {
        const jsonResponse = response.headers
            .get('content-type') ?.includes('application/json');

        const data = jsonResponse ?
            await response.json().catch(() => ({})) : {};

        const isCsrfError =
            response.status === 403 &&
            data.error ===
            'Request verification failed. Refresh and try again.';

        // Refresh and retry a failed mutation at most once.
        if (
            isCsrfError &&
            !csrfRetried &&
            !['GET', 'HEAD'].includes(method) &&
            !path.startsWith('/auth/')
        ) {
            const refreshed = await refreshCsrfToken();

            if (refreshed) {
                return request(path, {
                    method,
                    body,
                    signal,
                    binary,
                    csrfRetried: true
                });
            }
        }

        if (
            response.status === 401 &&
            !['/auth/me', '/auth/login'].includes(path)
        ) {
            window.dispatchEvent(
                new Event('careline:session-expired')
            );
        }

        const connectionError = !jsonResponse && [500, 502, 503, 504].includes(response.status) ?
            'Cannot reach the clinic API. Start the backend on port 5000 and verify its MongoDB connection.' :
            `Request failed (${response.status}).`;

        throw new ApiError(
            data.error || connectionError,
            response.status
        );
    }

    if (binary) {
        return response.blob();
    }

    const data = await response.json();

    if (data?.csrfToken) {
        csrfToken = data.csrfToken;
    }

    return data;
}

// Authentication
export const auth = {
    forgotPassword: email => request('/auth/forgot-password', { method: 'POST', body: { email } }),
    resetPassword: values => request('/auth/reset-password', { method: 'POST', body: values }),
    login: credentials =>
        request('/auth/login', {
            method: 'POST',
            body: credentials
        }),

    me: () => request('/auth/me'),

    logout: async() => {
        try {
            await request('/auth/logout', {
                method: 'POST',
                body: {}
            });
        } finally {
            csrfToken = '';
        }
    },

    updateProfile: values =>
        request('/auth/profile', {
            method: 'PATCH',
            body: values
        })
};

// Workspace
export const workspace = () => request('/workspace');

// Preferences
export const savePreferences = values =>
    request('/preferences', {
        method: 'PATCH',
        body: values
    });

// Notifications
export const markNotifications = id =>
    request(
        `/notifications/${encodeURIComponent(id)}/read`, {
            method: 'PATCH',
            body: {}
        }
    );

// Reports
export const reportTypeId = type =>
    ({
        Patients: 'patients',
        Consultations: 'consultations',
        Appointments: 'appointments',
        'Clinic Activity': 'activity'
    })[type];

export const getReport = (type, from, to, signal, options = {}) => {
    const reportType = reportTypeId(type);

    if (!reportType) {
        throw new ApiError('Invalid report type.', 400);
    }

    const params = new URLSearchParams({ from, to });
    for (const [key, value] of Object.entries(options)) params.set(key, key === 'filter' ? JSON.stringify(value) : String(value));

    return request(
        `/reports/${reportType}?${params}`, { signal }
    );
};

// File downloads
export async function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    try { anchor.click(); }
    finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

export const exportReport = async(type, from, to, format = 'csv', sorting, options = {}) => {
    if (!['csv', 'docx'].includes(format)) throw new ApiError('Invalid export format.', 400);
    const reportType = reportTypeId(type);

    if (!reportType) {
        throw new ApiError('Invalid report type.', 400);
    }

    const params = new URLSearchParams({
        from,
        to,
        format
    });
    if (sorting) { params.set('sort', sorting.key); params.set('direction', sorting.direction); }
    for (const [key, value] of Object.entries(options)) params.set(key, key === 'filter' ? JSON.stringify(value) : String(value));

    const blob = await request(
        `/reports/${reportType}?${params}`, { binary: true }
    );

    return saveBlob(blob, `${reportType}-report.${format}`);
};

// Documents
export const documents = {
    upload: (patientId, file, type = 'Uploaded document') => {
        const body = new FormData();

        body.append('patientId', patientId);
        body.append('type', type);
        body.append('file', file);

        return request('/documents', {
            method: 'POST',
            body
        });
    },

    preview: id =>
        request(
            `/documents/${encodeURIComponent(id)}/preview`, { binary: true }
        ),

    download: async document => {
        const blob = await request(
            `/documents/${encodeURIComponent(document.id)}/download`, { binary: true }
        );

        return saveBlob(blob, document.name);
    }
};

// Profile and system settings
export const profileApi = {
    system: () => request('/settings/system'),

    activity: () => request('/auth/activity'),

    revokeOthers: () =>
        request('/auth/revoke-others', {
            method: 'POST',
            body: {}
        }),

    uploadImage: (file, clinic = false) => {
        const body = new FormData();
        body.append('file', file);

        return request(
            clinic ? '/settings/logo' : '/auth/avatar', {
                method: 'POST',
                body
            }
        );
    },

    removeImage: (clinic = false) =>
        request(
            clinic ?
            '/settings/logo/remove' :
            '/auth/avatar/remove', {
                method: 'POST',
                body: {}
            }
        ),

    clinic: values =>
        request('/settings', {
            method: 'PATCH',
            body: values
        })
};
