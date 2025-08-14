// Bootstrap file for Render: delegates to backend ESM server
(async () => {
  try {
    await import('../backend/src/server.js');
  } catch (e) {
    console.error('Failed to start backend server from root bootstrap:', e);
    process.exit(1);
  }
})();
