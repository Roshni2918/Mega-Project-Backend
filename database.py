import pymysql
import bcrypt
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from config import Config
from models import Base, User, Analysis, PredictionLog, DraftAnalysis

_engine = None
_SessionLocal = None

def get_session():
    global _SessionLocal
    if _SessionLocal is None:
        init_db()
    return _SessionLocal()

def init_db():
    global _engine, _SessionLocal

    # 1. Ensure MySQL database exists (when using local/direct credentials)
    if not Config.DATABASE_URL:
        try:
            conn = pymysql.connect(
                host=Config.MYSQL_HOST,
                user=Config.MYSQL_USER,
                password=Config.MYSQL_PASSWORD,
                port=Config.MYSQL_PORT,
                charset="utf8mb4"
            )
            with conn.cursor() as cur:
                cur.execute(
                    f"CREATE DATABASE IF NOT EXISTS `{Config.MYSQL_DATABASE}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
                )
            conn.close()
            print(f"[DB] Ensured database '{Config.MYSQL_DATABASE}' exists.")
        except Exception as e:
            print(f"[DB] Note: Auto-create DB check skipped: {e}")

    # 2. Connect engine
    db_uri = Config.get_sqlalchemy_uri()
    print(f"[DB] Connecting to MySQL via SQLAlchemy...")
    _engine = create_engine(
        db_uri,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=False
    )
    _SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=_engine))

    # 3. Create tables
    Base.metadata.create_all(bind=_engine)
    print("[DB] Tables created or verified.")

    # 4. Seed initial default users
    seed_users()

def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def check_pw(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def seed_users():
    session = get_session()
    try:
        if session.query(User).count() == 0:
            print("[DB] Seeding default demo users...")
            defaults = [
                ("Admin User", "admin@demo.com", "Admin@123", "Admin"),
                ("Process Engineer", "engineer@demo.com", "Engineer@123", "Process Engineer"),
                ("Research Student", "student@demo.com", "Student@123", "Researcher"),
            ]
            for name, email, pw, role in defaults:
                u = User(
                    name=name,
                    email=email.lower().strip(),
                    password_hash=hash_pw(pw),
                    role=role
                )
                session.add(u)
            session.commit()
            print("[DB] Default users seeded successfully.")
    except Exception as e:
        session.rollback()
        print(f"[DB] Error seeding users: {e}")
    finally:
        session.close()
