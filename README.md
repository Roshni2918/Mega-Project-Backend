# Injection Molding Quality Predictor (Front End)

React + Vite + Tailwind CSS front end for the final year project.

## Run
```
npm install
npm run dev
```
Open the link shown in the terminal (usually http://localhost:5173).

## Login (dummy users, for testing)
admin@demo.com / Admin@123
engineer@demo.com / Engineer@123
student@demo.com / Student@123

You can also create your own account with **Create account** on the login page.
In demo mode the new account is saved in this browser only (plain text password, testing only).

The session ends automatically after 2 hours (change with VITE_SESSION_MINUTES).
With the backend running (see below) the login uses hashed passwords and a token instead of localStorage.

## What is inside
- Dashboard: summary cards, continue your analysis, recent analyses
- Analysis (9 steps): upload, dataset details, preprocessing, train models (with confusion matrix and per-class results), prediction, explanation (XAI), recommendations, what-if simulator, export report
- Batch prediction: upload many cycles, predict all, download CSV
- History: saved analyses per user, search, filter, download the PDF report again, delete
- PDF report with charts, confusion matrix, tables; CSV of recommendations
- Dark mode, toast messages, loading placeholders, help icons (?), error screen, 404 screen

## Test datasets
See `test-data/README.txt` (3 files should pass, 5 should be rejected).

## Demo mode vs backend
By default the app runs in demo mode (no backend needed):
- Upload checks, details and preprocessing run for real in the browser.
- Model comparison shows the real numbers from the sample dataset.
- The confusion matrix, prediction, explanation, recommendations, what-if and batch results use a simple in-browser model.
- Login, logout and **Create account** work in the browser (accounts are kept in localStorage).

With the Flask backend running, the same pages use the real machine learning:
- `.env` in this folder sets `VITE_API_URL=http://localhost:5000` (delete the file to return to demo mode, then restart `npm run dev`).
- **Create account** and Login go to `/api/auth/*` (bcrypt passwords, JWT for 2 hours). Every API call sends `Authorization: Bearer <token>`; when the token expires the app logs the user out with a message.
- **Train models** trains all 7 models on the server (about 45 s for 600 rows) and saves one model per user.
- Prediction, explanation (SHAP values), recommendations, what-if and batch prediction call `/api/predict`, `/api/explain`, `/api/recommend` and `/api/predict_batch`.
- **History** is stored in MySQL (max 25 analyses per user, users cannot see each other's entries, and the PDF can be downloaded again from the list).

Start both servers (backend first — details in `backend/README.md`):
```
cd backend
.venv\Scripts\python.exe app.py      # http://localhost:5000
```
```
npm run dev                          # http://localhost:5173
```

## Edit expected columns, units and ranges
`src/schema.js`  (check the unit text against your dataset documentation)

## Not included yet (needs backend or a router)
- Separate web addresses for each step (needs React Router)
- Admin page to manage users
