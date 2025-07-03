from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, desc
from typing import List, Optional
from database import get_db
from models import (
    WeeklyReportDB,
    WeeklyReportResponse,
    WeeklyReportCreate,
    WeeklyReportUpdate,
    WeeklyReportFilter,
    ProjectDB,
)

router = APIRouter(prefix="/weekly-reports", tags=["weekly-reports"])


def get_project_by_name(db: Session, project_name: str) -> ProjectDB:
    """프로젝트명으로 프로젝트 객체를 조회합니다."""
    project = db.query(ProjectDB).filter(ProjectDB.name == project_name).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"프로젝트 '{project_name}'를 찾을 수 없습니다.")
    return project


# 주차별 보고서 생성
@router.post("/", response_model=WeeklyReportResponse)
def create_weekly_report(report: WeeklyReportCreate, db: Session = Depends(get_db)):
    """새로운 주간 보고서를 생성합니다."""

    # ✨ 프로젝트명을 project_id로 변환
    project = get_project_by_name(db, report.project)

    # 동일한 프로젝트-주차-단계 조합이 이미 존재하는지 확인
    existing_report = (
        db.query(WeeklyReportDB)
        .filter(WeeklyReportDB.project_id == project.id)
        .filter(WeeklyReportDB.week == report.week)
        .filter(WeeklyReportDB.stage == report.stage)
        .first()
    )

    if existing_report:
        raise HTTPException(
            status_code=400,
            detail=f"프로젝트 '{report.project}', 주차 '{report.week}', 단계 '{report.stage}' 조합이 이미 존재합니다.",
        )

    # ✨ project_id를 사용하여 DB 객체 생성
    db_report = WeeklyReportDB(
        project_id=project.id,  # ✨ Integer FK 사용
        week=report.week,
        stage=report.stage,
        this_week_work=report.this_week_work,
        next_week_plan=report.next_week_plan,
        issues_risks=report.issues_risks,
    )

    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    # ✨ 응답에서 프로젝트명 포함 (relationship 활용)
    response_data = WeeklyReportResponse(
        id=db_report.id,
        project=project.name,  # ✨ 프로젝트명 직접 설정
        week=db_report.week,
        stage=db_report.stage,
        this_week_work=db_report.this_week_work,
        next_week_plan=db_report.next_week_plan,
        issues_risks=db_report.issues_risks,
        created_at=db_report.created_at,
        updated_at=db_report.updated_at,
    )

    return response_data


# 모든 주차별 보고서 조회 (필터링 지원)
@router.get("/", response_model=List[WeeklyReportResponse])
def get_weekly_reports(
    project: Optional[str] = None,
    week: Optional[str] = None,
    stage: Optional[str] = None,
    start_week: Optional[str] = None,
    end_week: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """주간 보고서 목록을 조회합니다. (필터링 지원)"""

    # ✨ relationship으로 project 정보도 함께 로드
    query = db.query(WeeklyReportDB).options(joinedload(WeeklyReportDB.project_obj))

    # ✨ 프로젝트 필터링 (프로젝트명으로)
    if project:
        project_obj = db.query(ProjectDB).filter(ProjectDB.name.ilike(f"%{project}%")).first()
        if project_obj:
            query = query.filter(WeeklyReportDB.project_id == project_obj.id)
        else:
            # 존재하지 않는 프로젝트면 빈 결과 반환
            return []

    # 기타 필터링
    if week:
        query = query.filter(WeeklyReportDB.week == week)
    if stage:
        query = query.filter(WeeklyReportDB.stage.ilike(f"%{stage}%"))
    if start_week:
        query = query.filter(WeeklyReportDB.week >= start_week)
    if end_week:
        query = query.filter(WeeklyReportDB.week <= end_week)

    # 최신순 정렬
    query = query.order_by(desc(WeeklyReportDB.week), desc(WeeklyReportDB.updated_at))

    # 페이징
    reports = query.offset(offset).limit(limit).all()

    # ✨ 응답 데이터 구성 (relationship 활용)
    response_data = []
    for report in reports:
        response_data.append(
            WeeklyReportResponse(
                id=report.id,
                project=report.project_obj.name if report.project_obj else "Unknown",  # ✨ relationship 활용
                week=report.week,
                stage=report.stage,
                this_week_work=report.this_week_work,
                next_week_plan=report.next_week_plan,
                issues_risks=report.issues_risks,
                created_at=report.created_at,
                updated_at=report.updated_at,
            )
        )

    return response_data


# 특정 주차별 보고서 조회
@router.get("/{report_id}", response_model=WeeklyReportResponse)
def get_weekly_report(report_id: int, db: Session = Depends(get_db)):
    """특정 주간 보고서를 조회합니다."""

    report = (
        db.query(WeeklyReportDB)
        .options(joinedload(WeeklyReportDB.project_obj))
        .filter(WeeklyReportDB.id == report_id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="주차별 보고서를 찾을 수 없습니다.")

    response_data = WeeklyReportResponse(
        id=report.id,
        project=report.project_obj.name if report.project_obj else "Unknown",  # ✨ relationship 활용
        week=report.week,
        stage=report.stage,
        this_week_work=report.this_week_work,
        next_week_plan=report.next_week_plan,
        issues_risks=report.issues_risks,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )

    return response_data


# 주차별 보고서 수정
@router.put("/{report_id}", response_model=WeeklyReportResponse)
def update_weekly_report(report_id: int, report_update: WeeklyReportUpdate, db: Session = Depends(get_db)):
    """주간 보고서를 수정합니다."""

    report = (
        db.query(WeeklyReportDB)
        .options(joinedload(WeeklyReportDB.project_obj))
        .filter(WeeklyReportDB.id == report_id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="주차별 보고서를 찾을 수 없습니다.")

    # 업데이트할 필드들
    update_data = report_update.model_dump(exclude_unset=True)

    # ✨ 프로젝트 변경 시 project_id 업데이트
    if "project" in update_data and update_data["project"]:
        project = get_project_by_name(db, update_data["project"])
        update_data["project_id"] = project.id
        # project 필드는 제거 (DB에는 project_id만 저장)
        del update_data["project"]

    # 중복 체크 (프로젝트, 주차, 단계가 변경되는 경우)
    if any(field in update_data for field in ["project_id", "week", "stage"]):
        project_id = update_data.get("project_id", report.project_id)
        week = update_data.get("week", report.week)
        stage = update_data.get("stage", report.stage)

        existing_report = (
            db.query(WeeklyReportDB)
            .filter(WeeklyReportDB.project_id == project_id)
            .filter(WeeklyReportDB.week == week)
            .filter(WeeklyReportDB.stage == stage)
            .filter(WeeklyReportDB.id != report_id)  # 현재 보고서는 제외
            .first()
        )

        if existing_report:
            project_name = update_data.get("project", report.project_obj.name if report.project_obj else "Unknown")
            raise HTTPException(
                status_code=400,
                detail=f"프로젝트 '{project_name}', 주차 '{week}', 단계 '{stage}' 조합이 이미 존재합니다.",
            )

    # 필드 업데이트
    for field, value in update_data.items():
        setattr(report, field, value)

    db.commit()
    db.refresh(report)

    response_data = WeeklyReportResponse(
        id=report.id,
        project=report.project_obj.name if report.project_obj else "Unknown",  # ✨ relationship 활용
        week=report.week,
        stage=report.stage,
        this_week_work=report.this_week_work,
        next_week_plan=report.next_week_plan,
        issues_risks=report.issues_risks,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )

    return response_data


# 주차별 보고서 삭제
@router.delete("/{report_id}")
def delete_weekly_report(report_id: int, db: Session = Depends(get_db)):
    """주간 보고서를 삭제합니다."""

    report = (
        db.query(WeeklyReportDB)
        .options(joinedload(WeeklyReportDB.project_obj))
        .filter(WeeklyReportDB.id == report_id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="주차별 보고서를 찾을 수 없습니다.")

    project_name = report.project_obj.name if report.project_obj else "Unknown"
    week = report.week
    stage = report.stage

    # ✨ Many-to-Many 관계는 SQLAlchemy가 자동으로 정리
    # cascade 설정에 의해 관련 연결들이 자동으로 정리됨

    db.delete(report)
    db.commit()

    return {"message": f"주간 보고서 '{project_name} - {week} - {stage}'가 성공적으로 삭제되었습니다."}
