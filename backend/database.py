from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# 🎉 설정 분리: 하드코딩 제거!
from config import settings

# SQLite 데이터베이스 설정 (환경 변수에서 가져옴)
SQLALCHEMY_DATABASE_URL = settings.effective_database_url

print(f"📍 데이터베이스 연결: {SQLALCHEMY_DATABASE_URL}")

# SQLite 연결을 위한 엔진 생성
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)

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
    """테이블 생성 및 초기 설정"""
    print("🔧 데이터베이스 테이블 확인/생성 중...")

    # 모델들을 import해서 메타데이터에 등록
    import models

    Base.metadata.create_all(bind=engine)
    print("✅ 데이터베이스 테이블 준비 완료")
