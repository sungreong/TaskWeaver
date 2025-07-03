from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# SQLite 데이터베이스 파일 경로 (Docker 볼륨 마운트 경로)
SQLALCHEMY_DATABASE_URL = "sqlite:///./data/project_tracker.db"

# SQLite 연결을 위한 엔진 생성
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

# 세션 로컬 클래스 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 베이스 클래스
Base = declarative_base()


# 데이터베이스 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 데이터베이스 테이블 생성
def create_tables():
    # 모델들을 import해서 메타데이터에 등록
    import models

    Base.metadata.create_all(bind=engine)
