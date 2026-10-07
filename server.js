const { nextStart } = require('next/dist/cli/next-start');

const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';

process.title = 'printflow';

nextStart(
  {
    port,
    hostname,
  },
  __dirname
).catch((err) => {
  console.error('Fatal Next.js startup error:', err);
  process.exit(1);
});
