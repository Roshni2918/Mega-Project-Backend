@echo off
rem Installs the optional heavy ML libraries one by one so a network drop on
rem one package does not stop the others. The backend works without them
rem (ml_pipeline.py falls back to pure scikit-learn models).
cd /d %~dp0
set PY=.venv\Scripts\python.exe
echo === xgboost ===
%PY% -m pip install --retries 20 --timeout 120 xgboost
echo === lightgbm ===
%PY% -m pip install --retries 20 --timeout 120 lightgbm
echo === catboost ===
%PY% -m pip install --retries 20 --timeout 120 catboost
echo === shap ===
%PY% -m pip install --retries 20 --timeout 120 shap
echo === check ===
%PY% -c "import importlib.util as u; mods=['xgboost','lightgbm','catboost','shap']; print({m: bool(u.find_spec(m)) for m in mods})"
