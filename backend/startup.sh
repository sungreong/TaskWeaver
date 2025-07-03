#!/bin/bash

echo "🚀 프로젝트 트래커 백엔드 시작 중..."

# 환경변수 기반 데이터베이스 초기화 제어
if [ "${INIT_DB}" = "true" ]; then
    echo "📊 데이터베이스 초기화 중... (INIT_DB=true)"
    python init_database.py
    
    if [ $? -eq 0 ]; then
        echo "✅ 데이터베이스 초기화 완료"
    else
        echo "❌ 데이터베이스 초기화 실패"
        exit 1
    fi
else
    echo "⏭️ 데이터베이스 초기화 스킵 (INIT_DB=${INIT_DB:-false})"
    echo "💡 DB 초기화가 필요하면 docker-compose.yml에서 INIT_DB=true로 설정하세요"
fi

# 애플리케이션 시작
echo "🌐 FastAPI 서버 시작 중..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload 