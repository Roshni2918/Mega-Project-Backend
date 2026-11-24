# Injection Molding Quality Predictor - Backend API & Database

Flask + SQLAlchemy + MySQL + Scikit-Learn/SHAP backend for the Injection Molding Quality Predictor project.

## Architecture
- **Frontend**: React + Vite (runs on `http://localhost:5173`)
- **Backend API**: Flask + Flask-CORS (runs on `http://localhost:5000`)
- **ML Pipeline**: `ml_final/ml_pipeline.py` (Random Forest, XGBoost, CatBoost, LightGBM, SHAP Explainability)
- **Database**: MySQL (Local or Cloud) storing Users, Analyses, and Prediction logs

## Database Configuration (Local or Cloud MySQL)
Configuration is set in `backend/.env`.

### 1. Local MySQL (Currently active)
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=injection_molding_db
```

### 2. Cloud MySQL (Aiven / Railway / TiDB Cloud / AWS RDS / GCP Cloud SQL)
To switch to a Cloud database, simply uncomment and provide your Cloud MySQL connection URL:
```env
DATABASE_URL=mysql+pymysql://<username>:<password>@<cloud-host>:<port>/<dbname>?ssl_mode=REQUIRED
```
The backend will automatically create all tables (`users`, `analyses`, `predictions`) and seed default demo accounts on first run.

## API Endpoints
- `GET  /api/health` - Health check & model status
- `POST /api/auth/login` - User login with JWT authentication
- `POST /api/train` - Train and benchmark 7 ML models on uploaded dataset
- `POST /api/predict` - Real-time ML quality prediction for molding cycle
- `POST /api/predict_batch` - Batch quality prediction for multiple cycles
- `POST /api/explain` - SHAP TreeExplainer feature influence analysis
- `POST /api/recommend` - Parameter optimization recommendations to reach Target quality
- `GET  /api/history` - Retrieve saved analyses from MySQL
- `POST /api/history` - Save analysis snapshot into MySQL
- `DELETE /api/history/<id>` - Delete an analysis from MySQL

## How to Run
Run from command line:
```bash
python app.py
```
Or double-click `run_backend.bat` in the project root.
