// Only these explicitly disposable namespaces belong to this action.
// Authentication, preferences, draft records and other origin data are preserved.
export async function clearCarelineCache(browser = window) {
  let cleared = 0;
  for (const name of ['localStorage', 'sessionStorage']) {
    const storage = browser[name];
    if (!storage) continue;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(key => key?.startsWith('careline-cache:'));
    for (const key of keys) { storage.removeItem(key); cleared++; }
  }
  if (browser.caches) {
    const names = (await browser.caches.keys()).filter(name => /^careline-(?:cache|static)-/.test(name));
    for (const name of names) if (await browser.caches.delete(name)) cleared++;
  }
  return cleared;
}
