#!/usr/bin/env python3

"""
데이터베이스 테이블을 생성하는 스크립트
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 현재 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base
from models import ProjectDB, WeeklyReportDB


def create_tables():
    """모든 테이블을 생성합니다."""

    print("데이터베이스 테이블 생성을 시작합니다...")

    try:
        # 기존 테이블 삭제 (필요한 경우)
        print("기존 테이블을 확인하고 있습니다...")

        # 모든 테이블 생성
        Base.metadata.create_all(bind=engine)

        # 테이블 생성 확인
        with engine.connect() as connection:
            # SQLite에서 테이블 목록 조회
            result = connection.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
            tables = [row[0] for row in result]

            print(f"생성된 테이블: {tables}")

            if "projects" in tables and "weekly_reports" in tables:
                print("✅ 모든 테이블이 성공적으로 생성되었습니다!")
                return True
            else:
                print("❌ 일부 테이블이 생성되지 않았습니다.")
                return False

    except Exception as e:
        print(f"❌ 테이블 생성 중 오류 발생: {e}")
        return False


def check_database():
    """데이터베이스 상태를 확인합니다."""

    print("데이터베이스 상태를 확인합니다...")

    try:
        with engine.connect() as connection:
            # SQLite 버전 확인
            result = connection.execute(text("SELECT sqlite_version();"))
            version = result.fetchone()[0]
            print(f"SQLite 버전: {version}")

            # 테이블 목록 확인
            result = connection.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
            tables = [row[0] for row in result]
            print(f"현재 테이블: {tables}")

            # 각 테이블의 스키마 확인
            for table in tables:
                if table != "sqlite_sequence":  # 시스템 테이블 제외
                    result = connection.execute(text(f"PRAGMA table_info({table});"))
                    columns = result.fetchall()
                    print(f"\n테이블 '{table}' 구조:")
                    for col in columns:
                        print(f"  - {col[1]} ({col[2]})")

    except Exception as e:
        print(f"❌ 데이터베이스 확인 중 오류 발생: {e}")


if __name__ == "__main__":
    print("=" * 50)
    print("프로젝트 트래커 데이터베이스 초기화")
    print("=" * 50)

    # 데이터베이스 상태 확인
    check_database()

    print("\n" + "=" * 30)

    # 테이블 생성
    success = create_tables()

    print("\n" + "=" * 30)

    # 최종 상태 확인
    if success:
        check_database()
        print("\n🎉 데이터베이스 초기화가 완료되었습니다!")
    else:
        print("\n💥 데이터베이스 초기화에 실패했습니다.")
