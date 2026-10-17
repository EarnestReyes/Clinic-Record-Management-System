import { auth, workspace, ApiError } from './api.js';

// A successful credential check is not proof that the browser retained its cookie.
export async function signInWorkspace(credentials) {
  await auth.login(credentials);
  let session;
  try {
    session = await auth.me();
    if (!session?.user?.id || !session.csrfToken) throw new ApiError('Careline returned incomplete session information. Please contact your clinic administrator.', 502, 'invalid_response');
  }
  catch (error) {
    const message = error.status === 401
      ? 'Your credentials were accepted, but your session could not be verified. Try signing in again. If this continues, open Careline in Safari or your usual browser and contact your clinic administrator.'
      : `Your credentials were accepted, but session verification failed. ${error.message}`;
    throw new ApiError(message, error.status, 'session_verification_failed');
  }
  try { return { user: session.user, data: await workspace() }; }
  catch (error) {
    throw new ApiError(error.status === 401
      ? 'Your session ended while opening the workspace. Please sign in again.'
      : `Your session was verified, but the workspace could not load. ${error.message}`, error.status, 'workspace_load_failed');
  }
}
