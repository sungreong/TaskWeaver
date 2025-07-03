import logging
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, distinct, func, inspect
from sqlalchemy.exc import OperationalError
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import json
import csv
import io
import pandas as pd

from database import get_db, engine, Base
from models import (
    ProjectDB,
    WeeklyReportDB,
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectDetail,
    ProjectStats,
    ProjectStatus,
    ProjectPriority,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


def ensure_tables_exist():
    """테이블이 존재하는지 확인하고 없으면 생성"""
    try:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        if "projects" not in existing_tables or "weekly_reports" not in existing_tables:
            logger.warning("프로젝트 테이블이 존재하지 않습니다. 테이블을 생성합니다.")
            Base.metadata.create_all(bind=engine)
            logger.info("테이블이 생성되었습니다.")
    except Exception as e:
        logger.error(f"테이블 확인/생성 중 오류: {e}")


def safe_db_operation(operation, db: Session, *args, **kwargs):
    """안전한 데이터베이스 작업 수행"""
    try:
        return operation(db, *args, **kwargs)
    except OperationalError as e:
        if "no such table" in str(e):
            logger.warning("테이블이 존재하지 않습니다. 테이블을 생성합니다.")
            ensure_tables_exist()
            # 재시도
            return operation(db, *args, **kwargs)
        else:
            raise e


@router.post("/", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """새 프로젝트를 생성합니다."""

    # 중복 체크
    existing_project = db.query(ProjectDB).filter(ProjectDB.name == project.name).first()
    if existing_project:
        raise HTTPException(status_code=400, detail="이미 존재하는 프로젝트명입니다.")

    # 날짜 변환 (문자열과 date 객체 모두 처리)
    start_date = None
    end_date = None

    if project.start_date:
        if isinstance(project.start_date, str):
            try:
                start_date = datetime.strptime(project.start_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="시작일 형식이 올바르지 않습니다. (YYYY-MM-DD)")
        elif hasattr(project.start_date, "year"):  # date 객체인 경우
            start_date = project.start_date
        else:
            raise HTTPException(status_code=400, detail="시작일 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    if project.end_date:
        if isinstance(project.end_date, str):
            try:
                end_date = datetime.strptime(project.end_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="종료일 형식이 올바르지 않습니다. (YYYY-MM-DD)")
        elif hasattr(project.end_date, "year"):  # date 객체인 경우
            end_date = project.end_date
        else:
            raise HTTPException(status_code=400, detail="종료일 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    # 날짜 유효성 검사
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="시작일이 종료일보다 늦을 수 없습니다.")

    # 프로젝트 생성
    db_project = ProjectDB(
        name=project.name,
        description=project.description,
        start_date=start_date,
        end_date=end_date,
        status=project.status,
        priority=project.priority,
        manager=project.manager,
        team_members=project.team_members,
        budget=project.budget,
        notes=project.notes,
    )

    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    return db_project


@router.get("/", response_model=List[ProjectResponse])
def get_projects(
    status: Optional[ProjectStatus] = Query(None, description="상태별 필터"),
    priority: Optional[ProjectPriority] = Query(None, description="우선순위별 필터"),
    manager: Optional[str] = Query(None, description="매니저별 필터"),
    db: Session = Depends(get_db),
):
    """프로젝트 목록을 조회합니다."""

    def _get_projects_operation(db_session):
        query = db_session.query(ProjectDB)

        # 필터 적용
        if status:
            query = query.filter(ProjectDB.status == status)
        if priority:
            query = query.filter(ProjectDB.priority == priority)
        if manager:
            query = query.filter(ProjectDB.manager.ilike(f"%{manager}%"))

        return query.order_by(desc(ProjectDB.updated_at)).all()

    return safe_db_operation(_get_projects_operation, db)


@router.get("/names", response_model=List[str])
def get_project_names(db: Session = Depends(get_db)):
    """프로젝트명 목록을 조회합니다. (select box용)"""

    def _get_project_names_operation(db_session):
        projects = db_session.query(ProjectDB.name).order_by(ProjectDB.name).all()
        return [project[0] for project in projects]

    return safe_db_operation(_get_project_names_operation, db)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """특정 프로젝트의 상세 정보를 조회합니다."""

    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    # 프로젝트 통계 계산
    reports = db.query(WeeklyReportDB).filter(WeeklyReportDB.project == project.name).all()

    if reports:
        total_weeks = len(set(report.week for report in reports))
        latest_week = max(report.week for report in reports)
        total_reports = len(reports)
        current_issues = len([r for r in reports if r.issues_risks and r.issues_risks.strip()])
        stages = list(set(report.stage for report in reports))

        # 완료율 계산
        completed_reports = len(
            [
                r
                for r in reports
                if not r.next_week_plan
                or any(keyword in r.next_week_plan.lower() for keyword in ["완료", "종료", "마무리", "끝", "완성"])
            ]
        )
        completion_rate = (completed_reports / len(reports)) * 100 if reports else 0

        stats = ProjectStats(
            total_weeks=total_weeks,
            latest_week=latest_week,
            total_reports=total_reports,
            current_issues=current_issues,
            completion_rate=round(completion_rate, 1),
            stages=stages,
        )
    else:
        stats = ProjectStats(
            total_weeks=0, latest_week=None, total_reports=0, current_issues=0, completion_rate=0.0, stages=[]
        )

    # ProjectDetail 응답 생성 (Pydantic serializer가 날짜 변환 처리)
    project_detail = ProjectDetail(
        id=project.id,
        name=project.name,
        description=project.description,
        start_date=project.start_date,  # Pydantic이 자동으로 문자열로 변환
        end_date=project.end_date,  # Pydantic이 자동으로 문자열로 변환
        status=project.status,
        priority=project.priority,
        manager=project.manager,
        team_members=project.team_members,
        budget=project.budget,
        notes=project.notes,
        created_at=project.created_at,
        updated_at=project.updated_at,
        stats=stats,
    )

    return project_detail


@router.get("/name/{project_name}", response_model=ProjectDetail)
def get_project_by_name(project_name: str, db: Session = Depends(get_db)):
    """프로젝트명으로 프로젝트 상세 정보를 조회합니다."""

    project = db.query(ProjectDB).filter(ProjectDB.name == project_name).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    return get_project(project.id, db)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, project_update: ProjectUpdate, db: Session = Depends(get_db)):
    """프로젝트 정보를 수정합니다."""

    db_project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    # 프로젝트명 중복 체크 (변경하는 경우에만)
    if project_update.name and project_update.name != db_project.name:
        existing_project = db.query(ProjectDB).filter(ProjectDB.name == project_update.name).first()
        if existing_project:
            raise HTTPException(status_code=400, detail="이미 존재하는 프로젝트명입니다.")

    # 업데이트할 필드들
    update_data = project_update.model_dump(exclude_unset=True)

    # 날짜 변환 (문자열과 date 객체 모두 처리)
    if "start_date" in update_data and update_data["start_date"]:
        if isinstance(update_data["start_date"], str):
            try:
                update_data["start_date"] = datetime.strptime(update_data["start_date"], "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="시작일 형식이 올바르지 않습니다. (YYYY-MM-DD)")
        elif not hasattr(update_data["start_date"], "year"):  # date 객체가 아닌 경우
            raise HTTPException(status_code=400, detail="시작일 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    if "end_date" in update_data and update_data["end_date"]:
        if isinstance(update_data["end_date"], str):
            try:
                update_data["end_date"] = datetime.strptime(update_data["end_date"], "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="종료일 형식이 올바르지 않습니다. (YYYY-MM-DD)")
        elif not hasattr(update_data["end_date"], "year"):  # date 객체가 아닌 경우
            raise HTTPException(status_code=400, detail="종료일 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    # 날짜 유효성 검사
    start_date = update_data.get("start_date", db_project.start_date)
    end_date = update_data.get("end_date", db_project.end_date)

    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="시작일이 종료일보다 늦을 수 없습니다.")

    # 프로젝트명이 변경되는 경우 관련 주차별 보고서의 프로젝트명도 업데이트
    if "name" in update_data and update_data["name"] != db_project.name:
        db.query(WeeklyReportDB).filter(WeeklyReportDB.project == db_project.name).update(
            {"project": update_data["name"]}
        )

    # 필드 업데이트
    for field, value in update_data.items():
        setattr(db_project, field, value)

    db_project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_project)

    return db_project


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """프로젝트를 삭제합니다."""

    db_project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    # 관련 주차별 보고서가 있는지 확인
    reports_count = db.query(WeeklyReportDB).filter(WeeklyReportDB.project == db_project.name).count()
    if reports_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"이 프로젝트에 {reports_count}개의 주차별 보고서가 있습니다. 먼저 보고서를 삭제해주세요.",
        )

    db.delete(db_project)
    db.commit()

    return {"message": "프로젝트가 성공적으로 삭제되었습니다."}


@router.get("/stats/overview")
def get_projects_overview(db: Session = Depends(get_db)):
    """프로젝트 전체 개요 통계를 조회합니다."""

    total_projects = db.query(ProjectDB).count()
    active_projects = db.query(ProjectDB).filter(ProjectDB.status == ProjectStatus.IN_PROGRESS).count()
    completed_projects = db.query(ProjectDB).filter(ProjectDB.status == ProjectStatus.COMPLETED).count()

    # 상태별 통계
    status_stats = {}
    for status in ProjectStatus:
        count = db.query(ProjectDB).filter(ProjectDB.status == status).count()
        status_stats[status.value] = count

    # 우선순위별 통계
    priority_stats = {}
    for priority in ProjectPriority:
        count = db.query(ProjectDB).filter(ProjectDB.priority == priority).count()
        priority_stats[priority.value] = count

    # 최근 업데이트된 프로젝트들
    recent_projects = db.query(ProjectDB).order_by(desc(ProjectDB.updated_at)).limit(5).all()
    recent_list = [
        {"name": p.name, "status": p.status.value, "updated_at": p.updated_at.strftime("%Y-%m-%d %H:%M")}
        for p in recent_projects
    ]

    return {
        "total_projects": total_projects,
        "active_projects": active_projects,
        "completed_projects": completed_projects,
        "status_distribution": status_stats,
        "priority_distribution": priority_stats,
        "recent_updates": recent_list,
    }


@router.post("/upload/validate")
async def validate_upload_data(file: UploadFile = File(...)):
    """업로드된 파일의 데이터를 검증합니다."""

    try:
        contents = await file.read()

        # 파일 형식별 파싱
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
        elif file.filename.endswith(".json"):
            data = json.loads(contents.decode("utf-8"))
            if isinstance(data, list):
                df = pd.DataFrame(data)
            else:
                raise HTTPException(status_code=400, detail="JSON 파일은 배열 형태여야 합니다.")
        else:
            raise HTTPException(
                status_code=400, detail="지원하지 않는 파일 형식입니다. CSV 또는 JSON 파일만 지원합니다."
            )

        # 필수 컬럼 체크
        required_columns = ["name", "description", "status", "priority", "manager"]
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            return {
                "success": False,
                "error": f"필수 컬럼이 누락되었습니다: {', '.join(missing_columns)}",
                "required_columns": required_columns,
                "found_columns": list(df.columns),
            }

        # 데이터 검증
        validation_errors = []
        valid_rows = []

        for idx, row in df.iterrows():
            row_errors = []

            # 프로젝트명 검증
            if pd.isna(row["name"]) or str(row["name"]).strip() == "":
                row_errors.append("프로젝트명이 비어있습니다")

            # 상태 검증
            if "status" in row and not pd.isna(row["status"]):
                valid_statuses = ["planning", "active", "on_hold", "completed", "cancelled"]
                if str(row["status"]).lower() not in valid_statuses:
                    row_errors.append(
                        f"유효하지 않은 상태값: {row['status']} (가능한 값: {', '.join(valid_statuses)})"
                    )

            # 우선순위 검증
            if "priority" in row and not pd.isna(row["priority"]):
                valid_priorities = ["low", "medium", "high", "critical"]
                if str(row["priority"]).lower() not in valid_priorities:
                    row_errors.append(
                        f"유효하지 않은 우선순위: {row['priority']} (가능한 값: {', '.join(valid_priorities)})"
                    )

            # 날짜 검증
            for date_col in ["start_date", "end_date"]:
                if date_col in row and not pd.isna(row[date_col]):
                    try:
                        datetime.strptime(str(row[date_col]), "%Y-%m-%d")
                    except ValueError:
                        row_errors.append(f"{date_col} 형식이 올바르지 않습니다 (YYYY-MM-DD 형식 필요)")

            # 예산 검증
            if "budget" in row and not pd.isna(row["budget"]):
                try:
                    float(row["budget"])
                except ValueError:
                    row_errors.append("예산은 숫자여야 합니다")

            if row_errors:
                validation_errors.append(
                    {"row": idx + 2, "errors": row_errors, "data": row.to_dict()}  # Excel 행 번호 (헤더 포함)
                )
            else:
                valid_rows.append(row.to_dict())

        return {
            "success": len(validation_errors) == 0,
            "total_rows": len(df),
            "valid_rows": len(valid_rows),
            "invalid_rows": len(validation_errors),
            "errors": validation_errors,
            "preview_data": valid_rows[:5],  # 첫 5개 행 미리보기
            "columns": list(df.columns),
        }

    except Exception as e:
        return {"success": False, "error": f"파일 처리 중 오류가 발생했습니다: {str(e)}"}


@router.post("/upload/import")
async def import_projects(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """검증된 프로젝트 데이터를 실제로 등록합니다."""

    try:
        contents = await file.read()

        # 파일 형식별 파싱
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
        elif file.filename.endswith(".json"):
            data = json.loads(contents.decode("utf-8"))
            df = pd.DataFrame(data)
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다.")

        created_projects = []
        errors = []

        for idx, row in df.iterrows():
            try:
                # 중복 체크
                existing_project = db.query(ProjectDB).filter(ProjectDB.name == str(row["name"]).strip()).first()
                if existing_project:
                    errors.append({"row": idx + 2, "error": f"프로젝트 '{row['name']}'는 이미 존재합니다"})
                    continue

                # 날짜 변환
                start_date = None
                end_date = None

                if "start_date" in row and not pd.isna(row["start_date"]):
                    start_date = datetime.strptime(str(row["start_date"]), "%Y-%m-%d").date()

                if "end_date" in row and not pd.isna(row["end_date"]):
                    end_date = datetime.strptime(str(row["end_date"]), "%Y-%m-%d").date()

                # 프로젝트 생성
                project = ProjectDB(
                    name=str(row["name"]).strip(),
                    description=str(row.get("description", "")),
                    start_date=start_date,
                    end_date=end_date,
                    status=str(row.get("status", "planning")).lower(),
                    priority=str(row.get("priority", "medium")).lower(),
                    manager=str(row.get("manager", "")),
                    team_members=str(row.get("team_members", "")),
                    budget=float(row["budget"]) if "budget" in row and not pd.isna(row["budget"]) else None,
                    notes=str(row.get("notes", "")),
                )

                db.add(project)
                created_projects.append(project.name)

            except Exception as e:
                errors.append({"row": idx + 2, "error": str(e)})

        if created_projects:
            db.commit()

        return {
            "success": True,
            "created_count": len(created_projects),
            "error_count": len(errors),
            "created_projects": created_projects,
            "errors": errors,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"데이터 등록 중 오류가 발생했습니다: {str(e)}")


@router.get("/template/download")
def download_template(format: str = Query("csv", description="다운로드 형식 (csv 또는 json)")):
    """프로젝트 데이터 입력 템플릿을 다운로드합니다."""

    template_data = [
        {
            "name": "샘플 프로젝트 1",
            "description": "프로젝트 설명을 입력하세요",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "status": "planning",
            "priority": "high",
            "manager": "홍길동",
            "team_members": "김철수, 이영희",
            "budget": 1000000,
            "notes": "추가 메모사항",
        },
        {
            "name": "샘플 프로젝트 2",
            "description": "또 다른 프로젝트 설명",
            "start_date": "2024-02-01",
            "end_date": "2024-11-30",
            "status": "active",
            "priority": "medium",
            "manager": "김영수",
            "team_members": "박민수, 최은정",
            "budget": 2000000,
            "notes": "중요한 프로젝트",
        },
    ]

    if format.lower() == "csv":
        df = pd.DataFrame(template_data)
        csv_output = df.to_csv(index=False, encoding="utf-8-sig")
        return Response(
            content=csv_output,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=project_template.csv"},
        )
    elif format.lower() == "json":
        json_output = json.dumps(template_data, ensure_ascii=False, indent=2)
        return Response(
            content=json_output,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=project_template.json"},
        )
    else:
        raise HTTPException(status_code=400, detail="지원하지 않는 형식입니다. 'csv' 또는 'json'만 가능합니다.")


@router.get("/upload/guide")
def get_upload_guide():
    """파일 업로드 가이드 정보를 반환합니다."""

    return {
        "supported_formats": ["CSV", "JSON"],
        "required_columns": [
            {"name": "name", "description": "프로젝트명 (필수)", "example": "신규 프로젝트"},
            {"name": "description", "description": "프로젝트 설명 (필수)", "example": "프로젝트에 대한 설명"},
            {
                "name": "status",
                "description": "프로젝트 상태 (필수)",
                "example": "planning",
                "options": ["planning", "active", "on_hold", "completed", "cancelled"],
            },
            {
                "name": "priority",
                "description": "우선순위 (필수)",
                "example": "high",
                "options": ["low", "medium", "high", "critical"],
            },
            {"name": "manager", "description": "담당자 (필수)", "example": "홍길동"},
        ],
        "optional_columns": [
            {"name": "start_date", "description": "시작일", "format": "YYYY-MM-DD", "example": "2024-01-01"},
            {"name": "end_date", "description": "종료일", "format": "YYYY-MM-DD", "example": "2024-12-31"},
            {"name": "team_members", "description": "팀원", "example": "김철수, 이영희"},
            {"name": "budget", "description": "예산", "format": "숫자", "example": "1000000"},
            {"name": "notes", "description": "메모", "example": "추가 정보"},
        ],
        "file_size_limit": "10MB",
        "encoding": "UTF-8",
        "tips": [
            "CSV 파일은 UTF-8 인코딩으로 저장해주세요",
            "날짜는 YYYY-MM-DD 형식으로 입력해주세요",
            "JSON 파일은 배열 형태로 작성해주세요",
            "프로젝트명은 중복될 수 없습니다",
        ],
    }
