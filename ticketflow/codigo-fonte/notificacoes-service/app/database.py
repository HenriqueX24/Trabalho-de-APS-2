"""Conexão com o banco SQLite próprio do serviço (um banco por serviço)."""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/notificacoes.db")

if DATABASE_URL.startswith("sqlite:///"):
    caminho = DATABASE_URL.removeprefix("sqlite:///")
    pasta = os.path.dirname(caminho)
    if pasta:
        os.makedirs(pasta, exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
