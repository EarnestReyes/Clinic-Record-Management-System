export class ApiError extends Error { constructor(status, message, { expose = false } = {}) { super(message); this.status = status; this.expose = expose; } }
export const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || 500, message = status < 500 || (err instanceof ApiError && err.expose) ? err.message : 'The request could not be completed. Please try again.';
  if (err.code === 11000) { status = 409; message = err.keyPattern?.slots ? `This ${err.keyPattern.patientId ? 'patient' : 'doctor'} already has an overlapping appointment. Refresh availability and choose another time.` : 'A record with these unique details already exists.'; }
  if (['ValidationError', 'CastError', 'StrictModeError'].includes(err.name)) { status = 400; message = 'Invalid record fields. Check the submitted values.'; }
  if (err.name === 'VersionError') { status = 409; message = 'This record changed. Refresh before saving again.'; }
  if (err.name === 'MulterError') { status = 400; message = req.imageUpload ? 'Image upload rejected. Use one PNG or JPEG under 2 MB.' : 'Upload rejected. Use one supported file under 5 MB.'; }
  if (err.type === 'entity.too.large') { status = 413; message = 'Request is too large.'; }
  if (err instanceof SyntaxError && 'body' in err) { status = 400; message = 'Invalid JSON request.'; }
  // Never log request bodies, credentials, MongoDB URIs, or medical record contents.
  res.status(status).json({ error: message });
}
