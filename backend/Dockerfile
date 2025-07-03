FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 패키지 설치
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# SQLite 데이터베이스 디렉토리 생성
RUN mkdir -p /app/data

# 시작 스크립트 실행 권한 부여
RUN chmod +x startup.sh

# 포트 노출
EXPOSE 8000

# 시작 스크립트를 통해 애플리케이션 실행
CMD ["./startup.sh"] 