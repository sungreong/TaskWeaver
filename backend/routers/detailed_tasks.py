from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, desc
from typing import List, Optional
import pandas as pd
import io
import json
from datetime import datetime, date
from database import get_db
from models import (
    DetailedTaskDB,
    DetailedTaskResponse,
    DetailedTaskCreate,
    DetailedTaskUpdate,
    DetailedTaskFilter,
    WeeklyReportDB,
    WeeklyReportDetailedTasksUpdate,
    TaskStatus,
    weekly_report_detailed_tasks,
    ProjectDB,
)

router = APIRouter(prefix="/detailed-tasks", tags=["detailed-tasks"])


def get_project_by_name(db: Session, project_name: str) -> ProjectDB:
    """프로젝트명으로 프로젝트 객체를 조회합니다."""
    project = db.query(ProjectDB).filter(ProjectDB.name == project_name).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"프로젝트 '{project_name}'를 찾을 수 없습니다.")
    return project


def get_project_id_by_name(db: Session, project_name: str) -> int:
    """프로젝트명으로 프로젝트 ID를 조회합니다."""
    project = get_project_by_name(db, project_name)
    return project.id


# 상세 업무 생성
@router.post("/", response_model=DetailedTaskResponse)
def create_detailed_task(task: DetailedTaskCreate, db: Session = Depends(get_db)):
    """새로운 상세 업무를 생성합니다."""

    # 프로젝트명을 project_id로 변환
    project_id = get_project_id_by_name(db, task.project)

    # 동일한 프로젝트-업무항목 조합이 이미 존재하는지 확인
    existing_task = (
        db.query(DetailedTaskDB)
        .filter(DetailedTaskDB.project_id == project_id)
        .filter(DetailedTaskDB.task_item == task.task_item)
        .first()
    )

    if existing_task:
        raise HTTPException(status_code=400, detail="동일한 프로젝트에 같은 업무 항목이 이미 존재합니다.")

    # 날짜 변환
    planned_end_date = None
    actual_end_date = None

    if task.planned_end_date:
        if isinstance(task.planned_end_date, str):
            try:
                planned_end_date = datetime.strptime(task.planned_end_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="종료예정일 형식이 올바르지 않습니다. (YYYY-MM-DD)")
        else:
            planned_end_date = task.planned_end_date

    if task.actual_end_date:
        if isinstance(task.actual_end_date, str):
            try:
                actual_end_date = datetime.strptime(task.actual_end_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="실제완료일 형식이 올바르지 않습니다. (YYYY-MM-DD)")
        else:
            actual_end_date = task.actual_end_date

    # ✨ project_id를 사용하여 DB 객체 생성
    db_task = DetailedTaskDB(
        project_id=project_id,  # ✨ Integer FK 사용
        stage=task.stage,
        task_item=task.task_item,
        assignee=task.assignee,
        current_status=task.current_status,
        has_risk=task.has_risk,
        description=task.description,
        planned_end_date=planned_end_date,
        actual_end_date=actual_end_date,
        progress_rate=task.progress_rate,
    )

    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # ✨ relationship을 통해 project 정보를 로드하고 수동으로 응답 구성
    db.refresh(db_task)  # relationship 로드를 위해 refresh

    # project 이름을 가져오기 위해 relationship 사용
    project_name = db_task.project_obj.name if db_task.project_obj else task.project

    # 수동으로 응답 객체 구성
    response_data = {
        "id": db_task.id,
        "project": project_name,
        "stage": db_task.stage,
        "task_item": db_task.task_item,
        "assignee": db_task.assignee,
        "current_status": db_task.current_status,
        "has_risk": db_task.has_risk,
        "description": db_task.description,
        "planned_end_date": db_task.planned_end_date,
        "actual_end_date": db_task.actual_end_date,
        "progress_rate": db_task.progress_rate,
        "created_at": db_task.created_at,
        "updated_at": db_task.updated_at,
    }

    return DetailedTaskResponse(**response_data)


# 상세 업무 목록 조회 (필터링 포함)
@router.get("/", response_model=List[dict])
def get_detailed_tasks(
    project: Optional[str] = None,
    stage: Optional[str] = None,
    assignee: Optional[str] = None,
    current_status: Optional[TaskStatus] = None,
    has_risk: Optional[bool] = None,
    planned_start_date: Optional[str] = None,
    planned_end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """상세 업무 목록을 조회합니다. (필터링 지원)"""

    # 기본 쿼리 (✨ relationship으로 project 정보도 함께 로드)
    query = db.query(DetailedTaskDB).options(joinedload(DetailedTaskDB.project_obj))

    # ✨ 프로젝트 필터링 (프로젝트명으로)
    if project:
        project_obj = db.query(ProjectDB).filter(ProjectDB.name == project).first()
        if project_obj:
            query = query.filter(DetailedTaskDB.project_id == project_obj.id)
        else:
            # 존재하지 않는 프로젝트면 빈 결과 반환
            return []

    # 기타 필터링
    if stage:
        query = query.filter(DetailedTaskDB.stage == stage)
    if assignee:
        query = query.filter(DetailedTaskDB.assignee == assignee)
    if current_status:
        query = query.filter(DetailedTaskDB.current_status == current_status)
    if has_risk is not None:
        query = query.filter(DetailedTaskDB.has_risk == has_risk)
    if planned_start_date:
        try:
            start_date = datetime.strptime(planned_start_date, "%Y-%m-%d").date()
            query = query.filter(DetailedTaskDB.planned_end_date >= start_date)
        except ValueError:
            pass
    if planned_end_date:
        try:
            end_date = datetime.strptime(planned_end_date, "%Y-%m-%d").date()
            query = query.filter(DetailedTaskDB.planned_end_date <= end_date)
        except ValueError:
            pass

    # 정렬 및 페이징
    query = query.order_by(desc(DetailedTaskDB.updated_at))
    tasks = query.offset(offset).limit(limit).all()

    # ✨ 주간 보고서 연결 정보도 포함 (relationship 활용)
    result = []
    for task in tasks:
        # ✨ relationship으로 연결된 주간 보고서 정보 조회
        linked_reports = [
            {"id": report.id, "week": report.week, "stage": report.stage} for report in task.weekly_reports
        ]

        task_dict = {
            "id": task.id,
            "project": task.project_obj.name,
            "stage": task.stage,
            "task_item": task.task_item,
            "assignee": task.assignee,
            "current_status": task.current_status.value,
            "has_risk": task.has_risk,
            "description": task.description,
            "planned_end_date": task.planned_end_date.strftime("%Y-%m-%d") if task.planned_end_date else None,
            "actual_end_date": task.actual_end_date.strftime("%Y-%m-%d") if task.actual_end_date else None,
            "progress_rate": task.progress_rate,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None,
            "linked_weekly_reports": linked_reports,
        }
        result.append(task_dict)

    return result


@router.get("/by-project/{project_name}", response_model=List[DetailedTaskResponse])
def get_detailed_tasks_by_project(project_name: str, db: Session = Depends(get_db)):
    """특정 프로젝트의 모든 상세 업무를 조회합니다."""

    # ✨ 프로젝트명을 project_id로 변환
    project = get_project_by_name(db, project_name)

    # ✨ relationship으로 간단하게 조회 (eager loading)
    tasks = (
        db.query(DetailedTaskDB)
        .options(joinedload(DetailedTaskDB.project_obj))
        .filter(DetailedTaskDB.project_id == project.id)
        .all()
    )

    # ✨ 수동으로 응답 객체들 구성
    result = []
    for task in tasks:
        response_data = {
            "id": task.id,
            "project": task.project_obj.name,
            "stage": task.stage,
            "task_item": task.task_item,
            "assignee": task.assignee,
            "current_status": task.current_status,
            "has_risk": task.has_risk,
            "description": task.description,
            "planned_end_date": task.planned_end_date,
            "actual_end_date": task.actual_end_date,
            "progress_rate": task.progress_rate,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
        }
        result.append(DetailedTaskResponse(**response_data))

    return result


@router.get("/by-project-stage/{project_name}")
def get_detailed_tasks_by_project_and_stage(
    project_name: str, stage: Optional[str] = None, db: Session = Depends(get_db)
):
    """프로젝트별, 단계별 상세 업무를 조회합니다."""

    # ✨ 프로젝트명을 project_id로 변환
    project = get_project_by_name(db, project_name)

    # ✨ relationship 기반 쿼리
    query = db.query(DetailedTaskDB).filter(DetailedTaskDB.project_id == project.id)

    if stage:
        query = query.filter(DetailedTaskDB.stage == stage)

    tasks = query.order_by(DetailedTaskDB.stage, DetailedTaskDB.task_item).all()

    # 단계별 그룹핑
    grouped_tasks = {}
    for task in tasks:
        task_stage = task.stage or "기타"
        if task_stage not in grouped_tasks:
            grouped_tasks[task_stage] = []

        grouped_tasks[task_stage].append(
            {
                "id": task.id,
                "task_item": task.task_item,
                "assignee": task.assignee,
                "current_status": task.current_status.value,
                "progress_rate": task.progress_rate,
                "has_risk": task.has_risk,
                "planned_end_date": task.planned_end_date.strftime("%Y-%m-%d") if task.planned_end_date else None,
            }
        )

    return {
        "project": project_name,
        "total_tasks": len(tasks),
        "stages": grouped_tasks,
    }


# 특정 상세 업무 조회
@router.get("/{task_id}", response_model=DetailedTaskResponse)
def get_detailed_task(task_id: int, db: Session = Depends(get_db)):
    """상세 업무 정보를 조회합니다."""
    task = (
        db.query(DetailedTaskDB)
        .options(joinedload(DetailedTaskDB.project_obj))
        .filter(DetailedTaskDB.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="상세 업무를 찾을 수 없습니다.")

    # ✨ 수동으로 응답 객체 구성 (project 필드 포함)
    response_data = {
        "id": task.id,
        "project": task.project_obj.name,
        "stage": task.stage,
        "task_item": task.task_item,
        "assignee": task.assignee,
        "current_status": task.current_status,
        "has_risk": task.has_risk,
        "description": task.description,
        "planned_end_date": task.planned_end_date,
        "actual_end_date": task.actual_end_date,
        "progress_rate": task.progress_rate,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }

    return DetailedTaskResponse(**response_data)


# 상세 업무 수정
@router.put("/{task_id}", response_model=DetailedTaskResponse)
def update_detailed_task(task_id: int, task_update: DetailedTaskUpdate, db: Session = Depends(get_db)):
    """상세 업무 정보를 수정합니다."""

    db_task = db.query(DetailedTaskDB).filter(DetailedTaskDB.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="상세 업무를 찾을 수 없습니다.")

    # 업데이트할 필드들
    update_data = task_update.model_dump(exclude_unset=True)

    # ✨ 프로젝트 변경 시 project_id 업데이트
    if "project" in update_data and update_data["project"]:
        project_id = get_project_id_by_name(db, update_data["project"])
        update_data["project_id"] = project_id
        # project 필드는 제거 (DB에는 project_id만 저장)
        del update_data["project"]

    # 날짜 변환
    for date_field in ["planned_end_date", "actual_end_date"]:
        if date_field in update_data and update_data[date_field]:
            if isinstance(update_data[date_field], str):
                try:
                    update_data[date_field] = datetime.strptime(update_data[date_field], "%Y-%m-%d").date()
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"{date_field} 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    # 중복 체크 (프로젝트나 업무항목이 변경되는 경우)
    if "project_id" in update_data or "task_item" in update_data:
        project_id = update_data.get("project_id", db_task.project_id)
        task_item = update_data.get("task_item", db_task.task_item)

        existing_task = (
            db.query(DetailedTaskDB)
            .filter(DetailedTaskDB.project_id == project_id)
            .filter(DetailedTaskDB.task_item == task_item)
            .filter(DetailedTaskDB.id != task_id)  # 현재 업무는 제외
            .first()
        )

        if existing_task:
            raise HTTPException(status_code=400, detail="동일한 프로젝트에 같은 업무 항목이 이미 존재합니다.")

    # 필드 업데이트
    for field, value in update_data.items():
        setattr(db_task, field, value)

    db_task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_task)

    # ✨ relationship을 통해 project 정보를 로드하고 수동으로 응답 구성
    # project_obj가 로드되지 않았다면 다시 로드
    if not db_task.project_obj:
        db_task = (
            db.query(DetailedTaskDB)
            .options(joinedload(DetailedTaskDB.project_obj))
            .filter(DetailedTaskDB.id == task_id)
            .first()
        )

    response_data = {
        "id": db_task.id,
        "project": db_task.project_obj.name,
        "stage": db_task.stage,
        "task_item": db_task.task_item,
        "assignee": db_task.assignee,
        "current_status": db_task.current_status,
        "has_risk": db_task.has_risk,
        "description": db_task.description,
        "planned_end_date": db_task.planned_end_date,
        "actual_end_date": db_task.actual_end_date,
        "progress_rate": db_task.progress_rate,
        "created_at": db_task.created_at,
        "updated_at": db_task.updated_at,
    }

    return DetailedTaskResponse(**response_data)


# 상세 업무 삭제
@router.delete("/{task_id}")
def delete_detailed_task(task_id: int, db: Session = Depends(get_db)):
    """상세 업무를 삭제합니다."""

    db_task = db.query(DetailedTaskDB).filter(DetailedTaskDB.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="상세 업무를 찾을 수 없습니다.")

    # ✨ Many-to-Many 관계는 SQLAlchemy가 자동으로 정리
    # cascade 설정에 의해 관련 연결들이 자동으로 정리됨

    task_item = db_task.task_item
    project_name = db_task.project_obj.name  # property로 프로젝트명 반환

    db.delete(db_task)
    db.commit()

    return {"message": f"상세 업무 '{task_item}' (프로젝트: {project_name})가 성공적으로 삭제되었습니다."}


# 주간 보고서에 상세 업무 연결
@router.post("/weekly-reports/{report_id}/link")
def link_detailed_tasks_to_weekly_report(
    report_id: int, task_links: WeeklyReportDetailedTasksUpdate, db: Session = Depends(get_db)
):
    """주간 보고서에 상세 업무들을 연결합니다."""
    try:
        # 입력 데이터 로깅
        print(f"🔗 주간 보고서 {report_id}에 상세 업무 연결 요청")
        print(f"📋 요청된 상세 업무 IDs: {task_links.detailed_task_ids}")

        # 주간 보고서 존재 확인 (project 정보와 함께 로드)
        weekly_report = (
            db.query(WeeklyReportDB)
            .options(joinedload(WeeklyReportDB.project_obj))
            .filter(WeeklyReportDB.id == report_id)
            .first()
        )
        if not weekly_report:
            print(f"❌ 주간 보고서 {report_id}를 찾을 수 없음")
            raise HTTPException(status_code=404, detail="주간 보고서를 찾을 수 없습니다.")

        print(f"✅ 주간 보고서 발견: {weekly_report.project_obj.name} - {weekly_report.week}")

        # 상세 업무들 존재 확인 (빈 목록이 아닌 경우에만)
        if task_links.detailed_task_ids:
            detailed_tasks = db.query(DetailedTaskDB).filter(DetailedTaskDB.id.in_(task_links.detailed_task_ids)).all()
            found_ids = {task.id for task in detailed_tasks}
            requested_ids = set(task_links.detailed_task_ids)

            print(f"🔍 요청된 ID 개수: {len(requested_ids)}")
            print(f"✅ 발견된 ID 개수: {len(found_ids)}")

            if len(detailed_tasks) != len(task_links.detailed_task_ids):
                missing_ids = requested_ids - found_ids
                print(f"❌ 누락된 상세 업무 IDs: {missing_ids}")
                raise HTTPException(status_code=404, detail=f"다음 상세 업무 ID들을 찾을 수 없습니다: {missing_ids}")
        else:
            detailed_tasks = []
            print("🔄 빈 목록으로 모든 연결 해제")

        # ✨ SQLAlchemy relationship을 사용한 연결 관리
        old_count = len(weekly_report.detailed_tasks)

        # 기존 연결 해제
        weekly_report.detailed_tasks.clear()

        # 새로운 연결 설정
        weekly_report.detailed_tasks.extend(detailed_tasks)

        db.commit()

        print(f"✅ 연결 업데이트 완료: {old_count} → {len(detailed_tasks)}개")

        return {
            "message": f"주간 보고서 {report_id}에 {len(detailed_tasks)}개의 상세 업무가 연결되었습니다.",
            "linked_task_ids": task_links.detailed_task_ids,
            "previous_count": old_count,
            "current_count": len(detailed_tasks),
        }

    except HTTPException:
        # HTTP 예외는 다시 던짐
        raise
    except Exception as e:
        print(f"💥 예상치 못한 오류: {str(e)}")
        print(f"📋 요청 데이터: {task_links}")
        print(f"🔍 오류 타입: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=f"상세 업무 연결 중 서버 오류가 발생했습니다: {str(e)}")


# 주간 보고서의 연결된 상세 업무 조회
@router.get("/weekly-reports/{report_id}/tasks", response_model=List[DetailedTaskResponse])
def get_linked_detailed_tasks(report_id: int, db: Session = Depends(get_db)):
    """주간 보고서에 연결된 상세 업무 목록을 조회합니다."""
    weekly_report = db.query(WeeklyReportDB).filter(WeeklyReportDB.id == report_id).first()
    if not weekly_report:
        raise HTTPException(status_code=404, detail="주간 보고서를 찾을 수 없습니다.")

    # ✨ SQLAlchemy relationship을 사용한 조회 (eager loading)
    tasks = (
        db.query(DetailedTaskDB)
        .options(joinedload(DetailedTaskDB.project_obj))
        .filter(DetailedTaskDB.id.in_([task.id for task in weekly_report.detailed_tasks]))
        .all()
    )

    # ✨ 수동으로 응답 객체들 구성
    result = []
    for task in tasks:
        response_data = {
            "id": task.id,
            "project": task.project_obj.name,
            "stage": task.stage,
            "task_item": task.task_item,
            "assignee": task.assignee,
            "current_status": task.current_status,
            "has_risk": task.has_risk,
            "description": task.description,
            "planned_end_date": task.planned_end_date,
            "actual_end_date": task.actual_end_date,
            "progress_rate": task.progress_rate,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
        }
        result.append(DetailedTaskResponse(**response_data))

    return result


# 상세 업무와 연결된 주간 보고서 조회
@router.get("/{task_id}/weekly-reports")
def get_task_weekly_reports(task_id: int, db: Session = Depends(get_db)):
    """상세 업무와 연결된 주간 보고서 목록을 조회합니다."""

    # 상세 업무 조회 (relationship과 함께)
    task = (
        db.query(DetailedTaskDB)
        .options(joinedload(DetailedTaskDB.weekly_reports).joinedload(WeeklyReportDB.project_obj))
        .filter(DetailedTaskDB.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="상세 업무를 찾을 수 없습니다.")

    # ✨ SQLAlchemy relationship을 사용한 연결된 주간 보고서 조회
    result = []
    for report in task.weekly_reports:
        result.append(
            {
                "id": report.id,
                "project": report.project_obj.name,  # relationship을 통한 프로젝트명 반환
                "week": report.week,
                "stage": report.stage,
                "created_at": report.created_at.isoformat() if report.created_at else None,
                "updated_at": report.updated_at.isoformat() if report.updated_at else None,
            }
        )

    return result


# 프로젝트별 상세 업무 통계
@router.get("/statistics/{project_name}")
def get_project_task_statistics(project_name: str, db: Session = Depends(get_db)):
    """프로젝트별 상세 업무 통계를 조회합니다."""

    # 프로젝트 확인
    project = get_project_by_name(db, project_name)

    # 해당 프로젝트의 모든 업무 조회
    tasks = db.query(DetailedTaskDB).filter(DetailedTaskDB.project_id == project.id).all()

    if not tasks:
        return {
            "project": project_name,
            "total_tasks": 0,
            "status_breakdown": {},
            "average_progress": 0.0,
            "risk_count": 0,
        }

    # 상태별 집계
    status_breakdown = {}
    total_progress = 0
    risk_count = 0

    for task in tasks:
        # 상태별 집계
        status = task.current_status.value
        status_breakdown[status] = status_breakdown.get(status, 0) + 1

        # 진행률 합계
        total_progress += task.progress_rate or 0

        # 리스크 카운트
        if task.has_risk:
            risk_count += 1

    return {
        "project": project_name,
        "total_tasks": len(tasks),
        "status_breakdown": status_breakdown,
        "average_progress": round(total_progress / len(tasks), 2),
        "risk_count": risk_count,
    }


# 파일 업로드 검증
@router.post("/upload/validate")
def validate_detailed_tasks_file(file: UploadFile = File(...)):
    """상세 업무 파일 업로드 전 검증을 수행합니다."""
    try:
        # 파일 형식 검증
        if not file.filename.endswith((".csv", ".xlsx", ".xls")):
            raise HTTPException(
                status_code=400, detail="지원되지 않는 파일 형식입니다. CSV 또는 Excel 파일만 업로드 가능합니다."
            )

        # 파일 크기 검증 (10MB 제한)
        file.file.seek(0, 2)  # 파일 끝으로 이동
        file_size = file.file.tell()  # 현재 위치 (파일 크기)
        file.file.seek(0)  # 파일 시작으로 다시 이동

        if file_size > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(
                status_code=400, detail="파일 크기가 너무 큽니다. 10MB 이하의 파일만 업로드 가능합니다."
            )

        # 파일 내용 읽기
        contents = file.file.read()
        file.file.seek(0)  # 파일 포인터 리셋

        # DataFrame으로 변환
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        # 필수 컬럼 검증
        required_columns = ["project", "stage", "task_item"]
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            raise HTTPException(status_code=400, detail=f"필수 컬럼이 누락되었습니다: {', '.join(missing_columns)}")

        # 빈 행 제거
        df = df.dropna(subset=required_columns)

        if len(df) == 0:
            raise HTTPException(
                status_code=400,
                detail="유효한 데이터가 없습니다. 필수 필드(project, stage, task_item)를 확인해주세요.",
            )

        # 중복 데이터 확인
        duplicate_tasks = df[df.duplicated(subset=["project", "task_item"], keep=False)]

        return {
            "success": True,
            "message": "파일 검증이 완료되었습니다.",
            "data": {
                "total_rows": len(df),
                "valid_rows": len(df),
                "duplicate_count": len(duplicate_tasks),
                "columns": list(df.columns),
                "sample_data": df.head(3).to_dict("records") if len(df) > 0 else [],
            },
        }

    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")
    except pd.errors.ParserError:
        raise HTTPException(status_code=400, detail="파일 형식이 올바르지 않습니다.")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400, detail="파일 인코딩이 올바르지 않습니다. UTF-8 또는 Excel 형식을 사용해주세요."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 처리 중 오류가 발생했습니다: {str(e)}")


# 파일 업로드 및 일괄 등록
@router.post("/upload/import")
def import_detailed_tasks_from_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """상세 업무를 파일에서 일괄 등록합니다."""
    try:
        # 파일 내용 읽기
        contents = file.file.read()

        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        # 필수 컬럼 확인
        required_columns = ["project", "stage", "task_item"]
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            raise HTTPException(status_code=400, detail=f"필수 컬럼이 누락되었습니다: {', '.join(missing_columns)}")

        # 빈 행 제거
        df = df.dropna(subset=required_columns)

        successful_imports = 0
        failed_imports = []

        for index, row in df.iterrows():
            try:
                # 기본값 설정
                task_data = {
                    "project": str(row["project"]).strip(),
                    "stage": str(row["stage"]).strip(),
                    "task_item": str(row["task_item"]).strip(),
                    "assignee": str(row.get("assignee", "")).strip(),
                    "current_status": str(row.get("current_status", "not_started")).strip(),
                    "has_risk": bool(row.get("has_risk", False)),
                    "description": str(row.get("description", "")).strip(),
                    "planned_end_date": None,
                    "actual_end_date": None,
                    "progress_rate": int(row.get("progress_rate", 0)) if pd.notna(row.get("progress_rate")) else 0,
                }

                # 프로젝트 ID 변환
                try:
                    project_id = get_project_id_by_name(db, task_data["project"])
                except HTTPException:
                    failed_imports.append(
                        {
                            "row": index + 2,
                            "project": task_data["project"],
                            "task_item": task_data["task_item"],
                            "reason": "프로젝트를 찾을 수 없음",
                        }
                    )
                    continue

                # 날짜 처리
                for date_field in ["planned_end_date", "actual_end_date"]:
                    if date_field in df.columns and pd.notna(row[date_field]):
                        try:
                            from datetime import datetime

                            if isinstance(row[date_field], str):
                                task_data[date_field] = datetime.strptime(row[date_field], "%Y-%m-%d").date()
                            else:
                                task_data[date_field] = row[date_field]
                        except:
                            task_data[date_field] = None

                # 중복 확인
                existing_task = (
                    db.query(DetailedTaskDB)
                    .filter(
                        and_(
                            DetailedTaskDB.project_id == project_id,
                            DetailedTaskDB.task_item == task_data["task_item"],
                        )
                    )
                    .first()
                )

                if existing_task:
                    failed_imports.append(
                        {
                            "row": index + 2,  # Excel 행 번호 (헤더 포함)
                            "project": task_data["project"],
                            "task_item": task_data["task_item"],
                            "reason": "이미 존재하는 업무",
                        }
                    )
                    continue

                # 데이터베이스에 저장
                task_data.pop("project")  # project 필드 제거
                task_data["project_id"] = project_id  # project_id 추가

                db_task = DetailedTaskDB(**task_data)
                db.add(db_task)
                db.commit()

                successful_imports += 1

            except Exception as e:
                failed_imports.append(
                    {
                        "row": index + 2,
                        "project": task_data.get("project", ""),
                        "task_item": task_data.get("task_item", ""),
                        "reason": f"처리 중 오류: {str(e)}",
                    }
                )
                continue

        return {
            "success": True,
            "message": f"일괄 등록이 완료되었습니다. 성공: {successful_imports}개, 실패: {len(failed_imports)}개",
            "data": {
                "successful_imports": successful_imports,
                "failed_imports": failed_imports,
                "total_processed": len(df),
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 업로드 중 오류가 발생했습니다: {str(e)}")


# 업로드 템플릿 가이드
@router.get("/template/download")
def get_detailed_tasks_template():
    """상세 업무 업로드용 템플릿 정보를 반환합니다."""
    template_columns = [
        "project",
        "stage",
        "task_item",
        "assignee",
        "current_status",
        "has_risk",
        "description",
        "planned_end_date",
        "actual_end_date",
        "progress_rate",
    ]

    sample_data = [
        {
            "project": "AI개발",
            "stage": "요구사항분석",
            "task_item": "사용자 스토리 작성",
            "assignee": "김개발",
            "current_status": "in_progress",
            "has_risk": False,
            "description": "주요 기능에 대한 사용자 스토리 작성",
            "planned_end_date": "2024-12-31",
            "actual_end_date": "",
            "progress_rate": 50,
        },
        {
            "project": "AI개발",
            "stage": "설계",
            "task_item": "시스템 아키텍처 설계",
            "assignee": "박설계",
            "current_status": "not_started",
            "has_risk": True,
            "description": "전체 시스템 구조 설계",
            "planned_end_date": "2025-01-15",
            "actual_end_date": "",
            "progress_rate": 0,
        },
    ]

    return {
        "success": True,
        "data": {
            "columns": template_columns,
            "required_columns": ["project", "stage", "task_item"],
            "sample_data": sample_data,
            "status_options": ["not_started", "in_progress", "completed", "on_hold", "cancelled"],
            "date_format": "YYYY-MM-DD (예: 2024-12-31)",
            "boolean_format": "TRUE/FALSE 또는 1/0",
        },
    }
