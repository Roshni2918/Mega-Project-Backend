import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // The Flask backend lives inside this folder too (backend/.venv,
      // app.db, ml_artifacts, model_store). Its files must not trigger a
      // full page reload of the front end in the middle of a session.
      ignored: ["**/backend/**"],
    },
  },
});
