// Fragments are never sent to the server. Strip the secret before App initializes its route.
let initialToken = '';
let recoveryKind = 'reset';
if (typeof window !== 'undefined' && ['#reset-password=', '#setup-password='].some(prefix => window.location.hash.startsWith(prefix))) {
  recoveryKind = window.location.hash.startsWith('#setup-password=') ? 'setup' : 'reset';
  initialToken = window.location.hash.slice(window.location.hash.indexOf('=') + 1);
  window.history.replaceState(null, '', window.location.pathname + window.location.search + '#login');
}
export const getResetToken = () => initialToken;
export const getRecoveryKind = () => recoveryKind;
export const forgetResetToken = () => { initialToken = ''; recoveryKind = 'reset'; };
