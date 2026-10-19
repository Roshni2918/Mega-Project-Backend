# Backend — Injection Molding Quality Predictor

Flask REST API for the React front end in the parent folder. Built exactly
following the "Backend Requirements" document (Steps 1–5 and 7–8).

## What it does

| Step | Route(s) | Page |
| --- | --- | --- |
| 1 | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | Register, Login |
| 2 | default ML model loaded once at start (+ SHAP warm-up) | all prediction pages |
| 3 | `POST /api/predict`, `/api/predict_batch`, `/api/explain`, `/api/recommend` | Prediction, Batch, Explanation, Recommendations, What-if |
| 4 | `POST /api/train`, `GET /api/train/status`, `POST /api/datasets/validate` | Train models, Upload |
| 5 | `GET/POST/DELETE /api/history`, `GET/DELETE /api/history/<id>` | History, Export report |
| — | `GET /api/health` | testing |

Every route except health/register/login needs the header
`Authorization: Bearer <token>` (the token comes from login). A missing or
expired token returns `401 {"error": "..."}` and the front end logs the user out.

## Setup (once)

```bash
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt   # or requirements-core.txt
copy .env.example .env                                        # then edit it
```

## Run

```bash
.venv\Scripts\python.exe app.py        # http://localhost:5000
```

On the first start the default model is trained once from
`data/sample_dataset.csv` and saved to `ml_artifacts/` (the notebook's job).
Later starts just load it (a few seconds) and warm up the SHAP explainer.
Measured on the 600-row sample dataset: training all 7 models takes about
40 s, a prediction about 3 ms, an explanation about 300 ms after warm-up.

Then point the front end at it: copy `.env.example` to `.env` in the front end
folder (`VITE_API_URL=http://localhost:5000`) and restart `npm run dev`.

## Database (MySQL)

The backend runs on MySQL. The connection is one line in `backend/.env`
(git-ignored - it contains the real password, never commit it):

```
DATABASE_URL=mysql+pymysql://imq_app:<password>@localhost:3306/injection_quality
```

On a new machine, create the database and a dedicated user first:

```sql
CREATE DATABASE injection_quality CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'imq_app'@'localhost' IDENTIFIED BY '<choose-a-password>';
GRANT ALL PRIVILEGES ON injection_quality.* TO 'imq_app'@'localhost';
```

Tables (created automatically on the first start): `users`, `models`
(one row per trained model), `analyses` (history, max 25 rows per user).

No MySQL available? Delete the `DATABASE_URL` line from `.env` and the
backend falls back to a SQLite file (`backend/app.db`) - same code, no setup.

Data from the old SQLite development database can be copied once
(row ids are kept, so accounts, history and `model_store/<user_id>/`
folders all stay valid):

```
.venv\Scripts\python.exe scripts\migrate_sqlite_to_mysql.py
```

## Files

```
app.py            app, CORS, error format, loads the default model at start
config.py         settings from environment variables (never commit secrets)
models.py         users, models, analyses tables
auth_utils.py     JWT helpers + @token_required
routes/auth.py    register / login / me            (Step 1)
routes/ml.py      predict / explain / recommend / train  (Steps 3-4)
routes/history.py history CRUD                     (Step 5)
ml/ml_pipeline.py ALL machine learning functions   (Steps 2-4)
                  Verbatim copy of the team's D:\ml_final\ml_pipeline.py -
                  the single source of truth shared with the notebook.
                  To update: copy the new file over this one.
ml/bridge.py      Flask-facing glue only (HTTP row checks, 13-feature
                  explanation list, startup helpers) - no ML logic here
model_store/      <user_id>/<model_id>/ saved user models (Step 4)
ml_artifacts/     the default model (Step 2)
data/             sample_dataset.csv used for the default model
tests/            pytest suite (Step 7)
scripts/          smoke_ml.py, api_walkthrough.ps1, migrate_sqlite_to_mysql.py
                  (developer tools)
```

## Tests

```bash
.venv\Scripts\python.exe -m pytest tests -v
```

15 tests: auth (register/login/token), prediction, explain/recommend,
training with valid and invalid uploads from `test-data/`, history isolation
(user A cannot see user B's rows), error format.

## Security notes (Step 7)

- passwords are bcrypt hashes (never plain text)
- JWT tokens expire after `TOKEN_MINUTES` (120 = 2 h, same as the front end)
- CORS only allows the front end address (`CORS_ORIGIN`)
- all input is validated on the server, even when the front end checked it
- one error format everywhere: `{"error": "message"}`
- errors are logged, passwords and tokens never are
