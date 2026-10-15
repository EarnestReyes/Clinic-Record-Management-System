export default {
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:5000' },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: { '/api': 'http://127.0.0.1:5000' },
  },
  esbuild: {
    jsx: 'automatic',
  },
};
