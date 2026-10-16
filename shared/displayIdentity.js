// Presentation only. Always use record.id for routing, references and authorization.
export const displayIdentity = record => record?.displayReference || record?.id || '';
