# One-off migration: copy the SQLite development data (app.db) into MySQL.
# Keeps the original row ids, so saved accounts, history and the trained
# models in model_store/<user_id>/ all stay valid after the switch.
#
# Run from the backend folder:
#   .venv\Scripts\python.exe scripts\migrate_sqlite_to_mysql.py
#
# Reads DATABASE_URL from backend/.env (the target database).
# Deliberately uses only Flask + SQLAlchemy (no ML imports) so it starts
# fast and does not load the model.
import os
import sqlite3
import sys
from datetime import datetime

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND_DIR)

from flask import Flask  # noqa: E402
from sqlalchemy import text  # noqa: E402

from config import Config  # noqa: E402
from models import db  # noqa: E402

SQLITE_FILE = os.path.join(BACKEND_DIR, "app.db")
TABLES = ("users", "models", "analyses")


def to_mysql_value(column, value):
    """SQLite may hold '2026-10-19 11:36:36+00:00' (old rows); MySQL DATETIME
    wants plain 'YYYY-MM-DD HH:MM:SS'. Everything else passes through."""
    if value is None or not column.endswith("_at") or not isinstance(value, str):
        return value
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return value
    return dt.strftime("%Y-%m-%d %H:%M:%S.%f") if dt.microsecond else dt.strftime("%Y-%m-%d %H:%M:%S")


def main():
    if not os.path.exists(SQLITE_FILE):
        print("No app.db found - nothing to migrate.")
        return
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    with app.app_context():
        db.create_all()  # make sure the MySQL tables exist
        con = sqlite3.connect(SQLITE_FILE)
        con.row_factory = sqlite3.Row
        copied = 0
        with db.engine.begin() as conn:
            for table in TABLES:
                existing = {row[0] for row in conn.execute(text(f"SELECT id FROM `{table}`"))}
                rows = con.execute(f"SELECT * FROM `{table}`").fetchall()
                for row in rows:
                    if row["id"] in existing:
                        continue
                    cols = list(row.keys())
                    params = {c: to_mysql_value(c, row[c]) for c in cols}
                    sql = (
                        f"INSERT INTO `{table}` ({', '.join('`' + c + '`' for c in cols)}) "
                        f"VALUES ({', '.join(':' + c for c in cols)})"
                    )
                    conn.execute(text(sql), params)
                    copied += 1
                print(f"{table:10s} {len(rows)} row(s) in SQLite")
        con.close()
        print(f"Done: {copied} row(s) copied to MySQL.")


if __name__ == "__main__":
    main()
