import app from './app.js';

const port = app.get('port');
const server = app.listen(port, () => {
  console.log(`Folio is running on http://localhost:${port}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
