import app from './app.js';
import { loadEnv } from './config/env.js';
loadEnv();
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
