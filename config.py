import os
from dotenv import load_dotenv

# Load .env file from the current directory
load_dotenv()

class Config:
    PORT = int(os.getenv("PORT", 5000))
    JWT_SECRET = os.getenv("JWT_SECRET", "injection_molding_super_secret_key_2026")
    
    # Cloud or Local MySQL Database Configuration
    DATABASE_URL = os.getenv("DATABASE_URL")
    MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
    MYSQL_USER = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "password")
    MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "injection_molding_db")

    @classmethod
    def get_sqlalchemy_uri(cls):
        if cls.DATABASE_URL:
            # Handle possible postgres/mysql prefixes
            uri = cls.DATABASE_URL
            if uri.startswith("mysql://"):
                uri = uri.replace("mysql://", "mysql+pymysql://", 1)
            return uri
        return f"mysql+pymysql://{cls.MYSQL_USER}:{cls.MYSQL_PASSWORD}@{cls.MYSQL_HOST}:{cls.MYSQL_PORT}/{cls.MYSQL_DATABASE}?charset=utf8mb4"
