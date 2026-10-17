import { POLICY_VERSION, TERMS_VERSION } from '../../shared/policies.js';
import { ApiError } from '../middleware/errors.js';

export function policyStatus(user) {
  const accepted = user?.policyAcknowledgments?.find(row => row.userId === user.id && row.policyVersion === POLICY_VERSION && row.termsVersion === TERMS_VERSION && row.acceptedAt);
  return { policyVersion: POLICY_VERSION, termsVersion: TERMS_VERSION, required: !accepted, acceptedAt: accepted?.acceptedAt || null };
}

export function requirePolicyAcknowledgment(req, res, next) {
  if (policyStatus(req.user).required) return next(new ApiError(428, 'Please acknowledge the current Privacy Policy and accept the Terms & Conditions before accessing the workspace.'));
  next();
}
