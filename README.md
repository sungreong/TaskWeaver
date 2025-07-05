# Project Tracker

주차별 프로젝트 진행 상황을 효율적으로 관리하고 추적하기 위한 React + FastAPI 기반의 웹 애플리케이션입니다.

## 🎯 주요 기능

-   **프로젝트 관리**: 프로젝트 생성, 조회, 수정, 삭제. 상태, 우선순위, 담당자, 예산 등 상세 정보 관리. CSV/JSON 파일을 통한 일괄 등록 및 내보내기 지원.
-   **주간 보고서 관리**: 프로젝트별 주간 보고서(이번 주 한 일, 다음 주 계획, 이슈/리스크) 작성, 조회, 수정, 삭제. 마크다운(Markdown) 문법 지원.
-   **상세 업무 관리**: 프로젝트 내 세부 업무 항목(단계, 담당자, 현재 상태, 진행률, 예정/실제 완료일) 등록, 조회, 수정, 삭제. 주간 보고서와 연동 가능. Excel/CSV 파일을 통한 일괄 등록 및 내보내기 지원.
-   **종합 대시보드**: 프로젝트, 주간 보고서, 상세 업무 데이터를 통합한 현황 및 통계 요약 시각화.
-   **프로젝트 타임라인**: 프로젝트 생성부터 주간 보고서, 상세 업무 활동까지 시간 순서대로 시각화.
-   **CSV 내보내기**: 주간 보고서, 프로젝트 요약, 상세 업무 데이터를 CSV 파일로 내보내기.
-   **데이터 영속성**: SQLite 데이터베이스를 사용하여 로컬에 데이터를 저장합니다.

## 🛠 기술 스택

-   **Backend**: FastAPI, SQLAlchemy (ORM), SQLite (Database), Pydantic (Data Validation), Pandas (Data Processing), Gunicorn (Production WSGI Server).
-   **Frontend**: React, TailwindCSS (Styling), Axios (HTTP Client), React Markdown (Markdown Rendering), Frappe Gantt (Gantt Chart Visualization, 예정).
-   **Infrastructure**: Docker, Docker Compose.

## 🚀 시작하기

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd ProjectTracker
```

### 2. Docker Compose로 실행
```bash
# 전체 애플리케이션 빌드 및 백그라운드에서 실행
docker-compose up -d --build
```

### 3. 애플리케이션 접속
-   **프론트엔드**: http://localhost:3000
-   **백엔드 API**: http://localhost:8000
-   **API 문서 (Swagger UI)**: http://localhost:8000/docs

### 4. 종료
```bash
docker-compose down
```

## 📁 프로젝트 구조

```
ProjectTracker/
├── backend/                 # FastAPI 백엔드 애플리케이션
│   ├── config.py           # 환경 설정
│   ├── database.py         # 데이터베이스 연결 및 세션 관리
│   ├── models.py           # SQLAlchemy ORM 모델 및 Pydantic 스키마
│   ├── routers/            # API 엔드포인트 (프로젝트, 주간 보고서, 상세 업무, 요약, 내보내기)
│   │   ├── projects.py
│   │   ├── tasks.py        # 주간 보고서 관련
│   │   ├── detailed_tasks.py # 상세 업무 관련
│   │   ├── summary.py
│   │   └── export.py
│   ├── services/           # 비즈니스 로직 (현재는 라우터에 통합)
│   ├── main.py             # FastAPI 메인 애플리케이션
│   ├── requirements.txt    # Python 의존성
│   ├── Dockerfile         # 백엔드 Docker 설정
│   └── startup.sh         # 백엔드 시작 스크립트
├── frontend/               # React 프론트엔드 애플리케이션
│   ├── public/             # 정적 파일
│   ├── src/
│   │   ├── components/     # 재사용 가능한 React 컴포넌트
│   │   ├── services/       # API 통신 로직
│   │   ├── App.jsx         # 메인 애플리케이션 컴포넌트
│   │   └── index.tsx       # 애플리케이션 진입점
│   ├── package.json        # Node.js 의존성
│   ├── Dockerfile         # 프론트엔드 Docker 설정
│   └── tailwind.config.js  # TailwindCSS 설정
├── data/                   # SQLite 데이터베이스 파일 및 업로드 파일 저장 (Docker 볼륨)
├── docker-compose.yml      # Docker Compose 설정 파일
└── README.md              # 프로젝트 문서
```

## 🔧 개발 환경 설정

### 백엔드 개발 (로컬)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 프론트엔드 개발 (로컬)
```bash
cd frontend
npm install
npm start # 또는 npm run dev (package.json에 따라 다름)
```

## 📊 API 엔드포인트

주요 API 엔드포인트는 다음과 같습니다. 전체 API 문서는 애플리케이션 실행 후 `http://localhost:8000/docs`에서 확인할 수 있습니다.

-   **프로젝트 관리**: `/projects`
    -   `POST /projects`: 새 프로젝트 생성
    -   `GET /projects`: 모든 프로젝트 조회 (필터링 지원)
    -   `GET /projects/{project_id}`: 특정 프로젝트 상세 조회
    -   `PUT /projects/{project_id}`: 프로젝트 수정
    -   `DELETE /projects/{project_id}`: 프로젝트 삭제
    -   `POST /projects/upload/validate`: 프로젝트 파일 업로드 검증
    -   `POST /projects/upload/import`: 프로젝트 데이터 일괄 등록
-   **주간 보고서 관리**: `/weekly-reports`
    -   `POST /weekly-reports`: 새 주간 보고서 생성
    -   `GET /weekly-reports`: 모든 주간 보고서 조회 (필터링 지원)
    -   `PUT /weekly-reports/{report_id}`: 주간 보고서 수정
    -   `DELETE /weekly-reports/{report_id}`: 주간 보고서 삭제
-   **상세 업무 관리**: `/detailed-tasks`
    -   `POST /detailed-tasks`: 새 상세 업무 생성
    -   `GET /detailed-tasks`: 모든 상세 업무 조회 (필터링 지원)
    -   `PUT /detailed-tasks/{task_id}`: 상세 업무 수정
    -   `DELETE /detailed-tasks/{task_id}`: 상세 업무 삭제
    -   `POST /detailed-tasks/weekly-reports/{report_id}/link`: 주간 보고서에 상세 업무 연결
    -   `POST /detailed-tasks/upload/validate`: 상세 업무 파일 업로드 검증
    -   `POST /detailed-tasks/upload/import`: 상세 업무 데이터 일괄 등록
-   **요약 및 통계**: `/summary`
    -   `GET /summary/enhanced-dashboard`: 종합 대시보드 정보
    -   `GET /summary/project/{project_name}/enhanced`: 프로젝트별 상세 요약
    -   `GET /summary/assignee/{assignee_name}`: 담당자별 업무 요약
    -   `GET /summary/project/{project_name}/timeline`: 프로젝트 타임라인
-   **데이터 내보내기**: `/export`
    -   `GET /export/weekly-reports.csv`: 주간 보고서 CSV 내보내기
    -   `GET /export/detailed-tasks.csv`: 상세 업무 CSV 내보내기
    -   `GET /export/project-summary.csv`: 프로젝트 요약 CSV 내보내기

## 💾 데이터베이스

-   **유형**: SQLite
-   **파일 경로**: `./data/project_tracker.db`
-   **볼륨 마운트**: Docker Compose를 통해 호스트의 `./data` 디렉토리와 컨테이너의 `/app/data` 디렉토리가 연결되어 데이터가 영속적으로 저장됩니다.
-   **자동 초기화**: 애플리케이션 시작 시 필요한 테이블이 자동으로 생성됩니다.

## 📋 데이터 구조 예시

### 프로젝트 (Project)
```json
{
  "id": 1,
  "name": "AI 챗봇 개발",
  "description": "고객 서비스용 AI 챗봇 시스템 개발",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "status": "active",
  "priority": "high",
  "manager": "김개발",
  "team_members": "이AI, 박데이터, 최머신",
  "budget": 5000000.0,
  "notes": "중요한 프로젝트입니다.",
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-01T00:00:00"
}
```

### 주간 보고서 (Weekly Report)
```json
{
  "id": 1,
  "project": "AI 챗봇 개발",
  "week": "2024-W01",
  "stage": "설계",
  "this_week_work": "요구사항 분석 및 시스템 아키텍처 설계",
  "next_week_plan": "데이터베이스 스키마 설계",
  "issues_risks": "일정이 타이트함",
  "created_at": "2024-01-08T00:00:00",
  "updated_at": "2024-01-08T00:00:00"
}
```

### 상세 업무 (Detailed Task)
```json
{
  "id": 1,
  "project": "AI 챗봇 개발",
  "stage": "요구사항분석",
  "task_item": "사용자 스토리 작성",
  "assignee": "김개발",
  "current_status": "in_progress",
  "has_risk": false,
  "description": "주요 기능에 대한 사용자 스토리 작성",
  "planned_end_date": "2024-12-31",
  "actual_end_date": null,
  "progress_rate": 50.0,
  "created_at": "2024-01-15T00:00:00",
  "updated_at": "2024-01-15T00:00:00"
}
```

## 🔄 개발 로드맵

-   [x] 백엔드 API 구현 (프로젝트, 주간 보고서, 상세 업무, 요약, 내보내기)
-   [x] Docker 환경 구성
-   [x] 프론트엔드 컴포넌트 구현 (폼, 목록, 관리자, 시트, 뷰어, 타임라인)
-   [x] 종합 대시보드 및 분석 기능
-   [x] 마크다운 지원
-   [x] 파일 업로드/가져오기 및 CSV 내보내기
-   [ ] 간트 차트 시각화
-   [ ] 사용자 인증 및 권한 관리
-   [ ] 실시간 업데이트 및 알림 기능

## 🤝 기여하기

이 프로젝트에 기여하고 싶으시다면 언제든지 환영합니다! 다음 단계를 따르세요:

1.  프로젝트를 포크(Fork)합니다.
2.  새 기능 브랜치를 생성합니다 (`git checkout -b feature/your-feature-name`).
3.  변경 사항을 커밋합니다 (`git commit -m 'Add some feature'`).
4.  브랜치에 푸시합니다 (`git push origin feature/your-feature-name`).
5.  풀 리퀘스트(Pull Request)를 생성합니다.

## 📝 라이선스

이 프로젝트는 Apache 2.0 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하십시오.