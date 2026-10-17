
import { auth, workspace, ApiError } from './api.js';
import { POLICY_VERSION, TERMS_VERSION } from '../../shared/policies.js';

export function currentPolicyStatus(status) {
  if (
    !status ||
    typeof status.required !== 'boolean' ||
    status.policyVersion !== POLICY_VERSION ||
    status.termsVersion !== TERMS_VERSION
  ) {
    throw new ApiError(
      'The current policies could not be verified. Reload Careline to get the latest version before continuing.',
      409,
      'policy_version_mismatch'
    );
  }

  return status;
}

// Verify that the browser retained the authenticated session.
export async function signInWorkspace(credentials) {
  await auth.login(credentials);

  let session;

  try {
    session = await auth.me();

    if (!session?.user?.id || !session.csrfToken) {
      throw new ApiError(
        'Careline returned incomplete session information. Please contact your clinic administrator.',
        502,
        'invalid_response'
      );
    }
  } catch (error) {
    const message =
      error.status === 401
        ? 'Your credentials were accepted, but your session could not be verified. Try signing in again.'
        : `Your credentials were accepted, but session verification failed. ${error.message}`;

    throw new ApiError(
      message,
      error.status,
      'session_verification_failed'
    );
  }

  const policyStatus = currentPolicyStatus(session.policyStatus);

  // Show acknowledgment flow before loading the workspace.
  if (policyStatus.required) {
    return {
      user: session.user,
      policyStatus,
      data: null
    };
  }

  try {
    const data = await workspace();

    return {
      user: session.user,
      policyStatus,
      data
    };
  } catch (error) {
    // The backend requires policy acknowledgment.
    if (error.status === 428) {
      const refreshedSession = await auth.me();

      if (!refreshedSession?.user?.id || !refreshedSession.csrfToken) {
        throw new ApiError(
          'Session verification failed. Please sign in again.',
          401,
          'session_verification_failed'
        );
      }

      const refreshedPolicyStatus = currentPolicyStatus(
        refreshedSession.policyStatus
      );

      if (refreshedPolicyStatus.required) {
        return {
          user: refreshedSession.user,
          policyStatus: refreshedPolicyStatus,
          data: null
        };
      }

      throw new ApiError(
        'The backend requires policy acknowledgment, but the session reports that it is complete. Please contact your clinic administrator.',
        409,
        'policy_state_inconsistent'
      );
    }

    throw new ApiError(
      error.status === 401
        ? 'Your session ended while opening the workspace. Please sign in again.'
        : `Your session was verified, but the workspace could not load. ${error.message}`,
      error.status,
      'workspace_load_failed'
    );
  }
}
