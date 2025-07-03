#!/bin/bash
set -e  # 에러 발생 시 즉시 종료

echo "🚀 Project Tracker 백엔드 시작 중..."

# 환경 변수 기본값 설정
ENVIRONMENT=${ENVIRONMENT:-development}
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}
WORKERS=${WORKERS:-4}
LOG_LEVEL=${LOG_LEVEL:-info}

echo "📊 환경: $ENVIRONMENT"
echo "🔗 서버: $HOST:$PORT"

# 설정 검증
echo "🔧 설정 검증 중..."
python -c "from config import settings, validate_settings; print(settings); issues = validate_settings(); print('⚠️ 문제점:', issues) if issues else print('✅ 설정 유효')"

# 필수 디렉토리 생성
mkdir -p ./data
mkdir -p ./uploads
mkdir -p ./logs

# 권한 설정 (Docker에서 중요)
chmod 755 ./data ./uploads ./logs

# 데이터베이스 초기화 (앱 시작 전에 실행)
echo "🗄️ 데이터베이스 초기화 중..."
python -c "
from database import create_tables, engine
from sqlalchemy import inspect
try:
    create_tables()
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f'✅ 테이블 확인: {tables}')
except Exception as e:
    print(f'❌ 데이터베이스 초기화 실패: {e}')
    exit(1)
"

# 환경별 서버 실행
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🏭 프로덕션 모드: Gunicorn 서버 시작"
    exec gunicorn main:app \
        --workers $WORKERS \
        --worker-class uvicorn.workers.UvicornWorker \
        --bind $HOST:$PORT \
        --log-level $LOG_LEVEL \
        --access-logfile - \
        --error-logfile - \
        --worker-tmp-dir /dev/shm \
        --timeout 120 \
        --keep-alive 5 \
        --max-requests 1000 \
        --max-requests-jitter 100 \
        --preload
        
elif [ "$ENVIRONMENT" = "testing" ]; then
    echo "🧪 테스트 모드: 최소 설정으로 실행"
    exec uvicorn main:app \
        --host $HOST \
        --port $PORT \
        --log-level error \
        --no-server-header
        
else
    echo "🔧 개발 모드: Uvicorn 개발 서버 시작"
    exec uvicorn main:app \
        --host $HOST \
        --port $PORT \
        --reload \
        --log-level debug \
        --reload-dir /app
fi 