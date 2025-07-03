#!/usr/bin/env python3
"""
환경 설정 관리 모듈
pydantic-settings를 사용하여 .env 파일에서 설정을 읽어옵니다.

12-Factor App 원칙을 따라 설정과 코드를 분리합니다.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os


class Settings(BaseSettings):
    """애플리케이션 설정 클래스"""

    # 🔗 데이터베이스 설정
    DATABASE_URL: str = "sqlite:///./data/project_tracker.db"

    # 🌐 CORS 설정 (콤마로 구분된 문자열을 List로 변환)
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # 🚀 서버 설정
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    RELOAD: bool = False  # 개발 중에만 True

    # 📁 파일 업로드 설정
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIR: str = "./uploads"

    # 🔐 보안 설정
    SECRET_KEY: Optional[str] = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # 📝 로그 설정
    LOG_LEVEL: str = "INFO"
    LOG_FILE: Optional[str] = None

    # 🧪 테스트 환경 설정
    TESTING: bool = False
    TEST_DATABASE_URL: Optional[str] = None

    # 🏭 프로덕션 설정
    WORKERS: int = 4  # Gunicorn worker 수

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="allow"  # 추가 환경 변수 허용
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """CORS origins를 리스트로 변환"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        """개발 환경 여부"""
        return self.DEBUG or self.RELOAD

    @property
    def effective_database_url(self) -> str:
        """실제 사용할 데이터베이스 URL (테스트 환경 고려)"""
        if self.TESTING and self.TEST_DATABASE_URL:
            return self.TEST_DATABASE_URL
        return self.DATABASE_URL

    def __str__(self) -> str:
        """설정 요약 출력 (민감한 정보 제외)"""
        return f"""
🔧 Project Tracker 설정
├── 환경: {'개발' if self.is_development else '프로덕션'}
├── 데이터베이스: {self.effective_database_url}
├── 서버: {self.HOST}:{self.PORT}
├── CORS Origins: {len(self.cors_origins_list)}개
├── 로그 레벨: {self.LOG_LEVEL}
└── Workers: {self.WORKERS}개
        """.strip()


# 전역 설정 인스턴스
settings = Settings()


# 설정 검증 함수
def validate_settings():
    """설정 유효성 검사"""
    issues = []

    # 필수 디렉토리 확인
    db_dir = os.path.dirname(settings.effective_database_url.replace("sqlite:///", ""))
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
        except Exception as e:
            issues.append(f"데이터베이스 디렉토리 생성 실패: {e}")

    # 업로드 디렉토리 확인
    if not os.path.exists(settings.UPLOAD_DIR):
        try:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        except Exception as e:
            issues.append(f"업로드 디렉토리 생성 실패: {e}")

    # 프로덕션 환경 보안 검사
    if not settings.is_development:
        if not settings.SECRET_KEY:
            issues.append("프로덕션 환경에서는 SECRET_KEY가 필요합니다")

        if settings.DEBUG:
            issues.append("프로덕션 환경에서 DEBUG=True는 보안상 위험합니다")

    # CORS 설정 검사
    if len(settings.cors_origins_list) == 0:
        issues.append("CORS_ORIGINS가 설정되지 않았습니다")

    return issues


# 환경별 설정 프리셋
class DevelopmentSettings(Settings):
    """개발 환경 설정"""

    DEBUG: bool = True
    RELOAD: bool = True
    LOG_LEVEL: str = "DEBUG"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001"


class ProductionSettings(Settings):
    """프로덕션 환경 설정"""

    DEBUG: bool = False
    RELOAD: bool = False
    LOG_LEVEL: str = "WARNING"
    WORKERS: int = 8


class TestingSettings(Settings):
    """테스트 환경 설정"""

    TESTING: bool = True
    TEST_DATABASE_URL: str = "sqlite:///./test.db"
    LOG_LEVEL: str = "ERROR"


# 환경에 따른 설정 팩토리
def get_settings() -> Settings:
    """환경 변수에 따른 적절한 설정 반환"""
    env = os.getenv("ENVIRONMENT", "development").lower()

    if env == "production":
        return ProductionSettings()
    elif env == "testing":
        return TestingSettings()
    else:
        return DevelopmentSettings()


if __name__ == "__main__":
    # 설정 검증 및 출력
    print(settings)
    issues = validate_settings()
    if issues:
        print("\n⚠️  설정 문제점:")
        for issue in issues:
            print(f"   - {issue}")
    else:
        print("\n✅ 모든 설정이 유효합니다.")
