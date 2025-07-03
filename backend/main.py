import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from database import engine, Base

# 🎉 설정 분리: 하드코딩 제거!
from config import settings, validate_settings

from routers import tasks, summary, export, projects, detailed_tasks

# 모델들을 import해야 Base.metadata에 등록됨
from models import ProjectDB, WeeklyReportDB, DetailedTaskDB

# 🔧 동적 로깅 설정 (환경 변수 기반)
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    filename=settings.LOG_FILE if settings.LOG_FILE else None,
)
logger = logging.getLogger(__name__)

# 설정 검증 및 출력
logger.info(f"🚀 Project Tracker API 시작")
logger.info(f"🔧 현재 설정:\n{settings}")
config_issues = validate_settings()
if config_issues:
    logger.warning(f"⚠️ 설정 문제점: {config_issues}")


def ensure_database_initialized():
    """데이터베이스가 초기화되었는지 확인하고 필요시 생성"""
    try:
        # 테이블 존재 여부 확인
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        required_tables = ["projects", "weekly_reports", "detailed_tasks", "weekly_report_detailed_tasks"]
        missing_tables = [table for table in required_tables if table not in existing_tables]

        if missing_tables:
            logger.warning(f"누락된 테이블: {missing_tables}")
            logger.info("데이터베이스 테이블을 생성합니다...")

            # 테이블 생성
            Base.metadata.create_all(bind=engine)

            # 다시 확인
            existing_tables = inspector.get_table_names()
            logger.info(f"생성된 테이블: {existing_tables}")
        else:
            logger.info(f"모든 테이블이 존재합니다: {existing_tables}")

    except Exception as e:
        logger.error(f"데이터베이스 초기화 확인 중 오류: {e}")
        # 그래도 테이블 생성 시도
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("강제로 테이블을 생성했습니다.")
        except Exception as create_error:
            logger.error(f"테이블 생성 실패: {create_error}")


# 데이터베이스 초기화 확인
ensure_database_initialized()

# FastAPI 애플리케이션 생성
app = FastAPI(
    title="Weekly Project Tracker API",
    description="주차별 프로젝트 관리를 위한 API",
    version="1.0.0",
    debug=settings.DEBUG,  # 환경 변수 기반 디버그 모드
)

# 🌐 동적 CORS 설정 (환경 변수 기반)
logger.info(f"🌐 CORS Origins: {settings.cors_origins_list}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # 환경 변수에서 가져옴
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(projects.router)
app.include_router(tasks.router)  # /weekly-reports
app.include_router(detailed_tasks.router)  # /detailed-tasks
app.include_router(summary.router)  # /summary
app.include_router(export.router)  # /export


@app.get("/")
def read_root():
    return {
        "message": "Weekly Project Tracker API",
        "version": "1.0.0",
        "environment": "development" if settings.is_development else "production",
        "docs": "/docs",
        "features": ["프로젝트 관리", "주차별 보고서 관리", "통계 및 요약", "CSV 내보내기"],
    }


@app.get("/health")
def health_check():
    """서버 상태 확인"""
    return {
        "status": "healthy",
        "environment": "development" if settings.is_development else "production",
        "database": "connected",
        "cors_origins": len(settings.cors_origins_list),
    }
