#!/usr/bin/env python3

"""
프로젝트 트래커 데이터베이스 강제 초기화 스크립트
모든 테이블을 삭제하고 새로 생성합니다.
"""

import os
import sys
import sqlite3
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 현재 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base, SQLALCHEMY_DATABASE_URL
from models import ProjectDB, WeeklyReportDB


def clear_database():
    """데이터베이스 파일과 모든 테이블을 완전히 삭제합니다."""

    print("🗑️  기존 데이터베이스 초기화 중...")

    try:
        # 데이터베이스 파일 경로 추출
        db_path = SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "")

        # 연결 종료
        engine.dispose()

        # 데이터베이스 파일이 존재하면 삭제
        if os.path.exists(db_path):
            os.remove(db_path)
            print(f"✅ 기존 데이터베이스 파일 삭제됨: {db_path}")
        else:
            print(f"ℹ️  데이터베이스 파일이 존재하지 않음: {db_path}")

        # 디렉토리가 없으면 생성
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        print(f"✅ 데이터 디렉토리 확인/생성됨: {os.path.dirname(db_path)}")

        return True

    except Exception as e:
        print(f"❌ 데이터베이스 초기화 중 오류: {e}")
        return False


def create_tables_force():
    """모든 테이블을 강제로 생성합니다."""

    print("🔨 데이터베이스 테이블 생성 중...")

    try:
        # 새로운 엔진 생성
        new_engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

        # 모든 테이블 생성
        Base.metadata.create_all(bind=new_engine)

        # 테이블 생성 확인
        inspector = inspect(new_engine)
        tables = inspector.get_table_names()

        print(f"✅ 생성된 테이블: {tables}")

        if "projects" in tables and "weekly_reports" in tables:
            print("🎉 모든 테이블이 성공적으로 생성되었습니다!")

            # 각 테이블의 컬럼 정보 출력
            for table_name in tables:
                columns = inspector.get_columns(table_name)
                print(f"\n📋 테이블 '{table_name}' 구조:")
                for col in columns:
                    print(f"  - {col['name']}: {col['type']}")

            return True
        else:
            print(f"❌ 일부 테이블이 생성되지 않았습니다. 생성된 테이블: {tables}")
            return False

    except Exception as e:
        print(f"❌ 테이블 생성 중 오류: {e}")
        import traceback

        traceback.print_exc()
        return False


def insert_sample_data():
    """샘플 데이터를 삽입합니다."""

    print("📝 샘플 데이터 삽입 중...")

    try:
        from datetime import date, datetime

        new_engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=new_engine)

        db = SessionLocal()

        # 샘플 프로젝트 생성
        sample_projects = [
            ProjectDB(
                name="AI 챗봇 개발",
                description="고객 서비스용 AI 챗봇 시스템 개발",
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31),
                status="active",
                priority="high",
                manager="김개발",
                team_members="이AI, 박데이터, 최머신",
                budget=5000000.0,
                notes="중요한 프로젝트입니다.",
            ),
            ProjectDB(
                name="웹사이트 리뉴얼",
                description="회사 홈페이지 전면 개편",
                start_date=date(2024, 2, 1),
                end_date=date(2024, 8, 31),
                status="planning",
                priority="medium",
                manager="박웹",
                team_members="김프론트, 이백엔드",
                budget=3000000.0,
                notes="모던한 디자인으로 변경",
            ),
        ]

        for project in sample_projects:
            db.add(project)

        # 샘플 주차별 보고서 생성
        sample_reports = [
            WeeklyReportDB(
                project="AI 챗봇 개발",
                week="2024-W01",
                stage="설계",
                this_week_work="요구사항 분석 및 시스템 아키텍처 설계",
                next_week_plan="데이터베이스 스키마 설계",
                issues_risks="일정이 타이트함",
            ),
            WeeklyReportDB(
                project="AI 챗봇 개발",
                week="2024-W02",
                stage="개발",
                this_week_work="기본 모델 구현 및 테스트",
                next_week_plan="UI 개발 시작",
                issues_risks="없음",
            ),
        ]

        for report in sample_reports:
            db.add(report)

        db.commit()

        # 데이터 확인
        project_count = db.query(ProjectDB).count()
        report_count = db.query(WeeklyReportDB).count()

        print(f"✅ 샘플 프로젝트 {project_count}개 생성됨")
        print(f"✅ 샘플 보고서 {report_count}개 생성됨")

        db.close()
        return True

    except Exception as e:
        print(f"❌ 샘플 데이터 삽입 중 오류: {e}")
        import traceback

        traceback.print_exc()
        return False


def verify_database():
    """데이터베이스 상태를 최종 검증합니다."""

    print("🔍 데이터베이스 상태 최종 검증 중...")

    try:
        new_engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

        with new_engine.connect() as connection:
            # SQLite 버전 확인
            result = connection.execute(text("SELECT sqlite_version();"))
            version = result.fetchone()[0]
            print(f"📊 SQLite 버전: {version}")

            # 테이블 목록 확인
            result = connection.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
            tables = [row[0] for row in result]
            print(f"📋 현재 테이블: {tables}")

            # 각 테이블의 데이터 개수 확인
            for table in tables:
                if table != "sqlite_sequence":
                    result = connection.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = result.fetchone()[0]
                    print(f"📊 {table} 테이블: {count}개 레코드")

        return True

    except Exception as e:
        print(f"❌ 데이터베이스 검증 중 오류: {e}")
        return False


def main():
    """메인 초기화 프로세스"""

    print("=" * 60)
    print("🚀 프로젝트 트래커 데이터베이스 강제 초기화")
    print("=" * 60)

    success_steps = 0
    total_steps = 4

    # 1단계: 기존 데이터베이스 삭제
    if clear_database():
        success_steps += 1
        print(f"✅ 1단계 완료 ({success_steps}/{total_steps})")
    else:
        print("❌ 1단계 실패")
        return False

    print("\n" + "-" * 40)

    # 2단계: 테이블 생성
    if create_tables_force():
        success_steps += 1
        print(f"✅ 2단계 완료 ({success_steps}/{total_steps})")
    else:
        print("❌ 2단계 실패")
        return False

    print("\n" + "-" * 40)

    # 3단계: 샘플 데이터 삽입
    if insert_sample_data():
        success_steps += 1
        print(f"✅ 3단계 완료 ({success_steps}/{total_steps})")
    else:
        print("❌ 3단계 실패")
        return False

    print("\n" + "-" * 40)

    # 4단계: 최종 검증
    if verify_database():
        success_steps += 1
        print(f"✅ 4단계 완료 ({success_steps}/{total_steps})")
    else:
        print("❌ 4단계 실패")
        return False

    print("\n" + "=" * 60)
    print("🎉 데이터베이스 초기화가 성공적으로 완료되었습니다!")
    print("🚀 이제 시스템을 시작할 수 있습니다.")
    print("=" * 60)

    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
