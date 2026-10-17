// Fragments are never sent to the server. Strip the secret before App initializes its route.
let initialToken = '';
export const isForgotPasswordRoute = () => typeof window !== 'undefined' && window.location.hash === '#forgot-password';
if (typeof window !== 'undefined' && window.location.hash.startsWith('#reset-password=')) {
  initialToken = window.location.hash.slice('#reset-password='.length);
  window.history.replaceState(null, '', window.location.pathname + window.location.search + '#login');
}
export const getResetToken = () => initialToken;
export const forgetResetToken = () => { initialToken = ''; };
