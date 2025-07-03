from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from typing import List, Optional
from database import get_db
from models import WeeklyReportDB, WeeklyReportResponse, WeeklyReportCreate, WeeklyReportUpdate, WeeklyReportFilter

router = APIRouter(prefix="/weekly-reports", tags=["weekly-reports"])


# 주차별 보고서 생성
@router.post("/", response_model=WeeklyReportResponse)
def create_weekly_report(report: WeeklyReportCreate, db: Session = Depends(get_db)):
    # 동일한 프로젝트-주차-단계 조합이 이미 존재하는지 확인
    existing_report = (
        db.query(WeeklyReportDB)
        .filter(
            and_(
                WeeklyReportDB.project == report.project,
                WeeklyReportDB.week == report.week,
                WeeklyReportDB.stage == report.stage,
            )
        )
        .first()
    )

    if existing_report:
        raise HTTPException(
            status_code=400,
            detail=f"프로젝트 '{report.project}', 주차 '{report.week}', 단계 '{report.stage}' 조합이 이미 존재합니다.",
        )

    db_report = WeeklyReportDB(**report.model_dump())
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    # datetime을 문자열로 변환
    response_data = WeeklyReportResponse(
        id=db_report.id,
        project=db_report.project,
        week=db_report.week,
        stage=db_report.stage,
        this_week_work=db_report.this_week_work,
        next_week_plan=db_report.next_week_plan,
        issues_risks=db_report.issues_risks,
        created_at=db_report.created_at.isoformat() if db_report.created_at else "",
        updated_at=db_report.updated_at.isoformat() if db_report.updated_at else "",
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
    query = db.query(WeeklyReportDB)

    # 필터 적용
    if project:
        query = query.filter(WeeklyReportDB.project.ilike(f"%{project}%"))
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

    # datetime을 문자열로 변환
    response_data = []
    for report in reports:
        response_data.append(
            WeeklyReportResponse(
                id=report.id,
                project=report.project,
                week=report.week,
                stage=report.stage,
                this_week_work=report.this_week_work,
                next_week_plan=report.next_week_plan,
                issues_risks=report.issues_risks,
                created_at=report.created_at.isoformat() if report.created_at else "",
                updated_at=report.updated_at.isoformat() if report.updated_at else "",
            )
        )

    return response_data


# 특정 주차별 보고서 조회
@router.get("/{report_id}", response_model=WeeklyReportResponse)
def get_weekly_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(WeeklyReportDB).filter(WeeklyReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="주차별 보고서를 찾을 수 없습니다.")

    response_data = WeeklyReportResponse(
        id=report.id,
        project=report.project,
        week=report.week,
        stage=report.stage,
        this_week_work=report.this_week_work,
        next_week_plan=report.next_week_plan,
        issues_risks=report.issues_risks,
        created_at=report.created_at.isoformat() if report.created_at else "",
        updated_at=report.updated_at.isoformat() if report.updated_at else "",
    )

    return response_data


# 주차별 보고서 수정
@router.put("/{report_id}", response_model=WeeklyReportResponse)
def update_weekly_report(report_id: int, report_update: WeeklyReportUpdate, db: Session = Depends(get_db)):
    report = db.query(WeeklyReportDB).filter(WeeklyReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="주차별 보고서를 찾을 수 없습니다.")

    # 동일한 프로젝트-주차-단계 조합 중복 확인 (자신 제외)
    existing_report = (
        db.query(WeeklyReportDB)
        .filter(
            and_(
                WeeklyReportDB.project == report_update.project,
                WeeklyReportDB.week == report_update.week,
                WeeklyReportDB.stage == report_update.stage,
                WeeklyReportDB.id != report_id,
            )
        )
        .first()
    )

    if existing_report:
        raise HTTPException(
            status_code=400,
            detail=f"프로젝트 '{report_update.project}', 주차 '{report_update.week}', 단계 '{report_update.stage}' 조합이 이미 존재합니다.",
        )

    # 업데이트
    for key, value in report_update.model_dump().items():
        setattr(report, key, value)

    db.commit()
    db.refresh(report)

    response_data = WeeklyReportResponse(
        id=report.id,
        project=report.project,
        week=report.week,
        stage=report.stage,
        this_week_work=report.this_week_work,
        next_week_plan=report.next_week_plan,
        issues_risks=report.issues_risks,
        created_at=report.created_at.isoformat() if report.created_at else "",
        updated_at=report.updated_at.isoformat() if report.updated_at else "",
    )

    return response_data


# 주차별 보고서 삭제
@router.delete("/{report_id}")
def delete_weekly_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(WeeklyReportDB).filter(WeeklyReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="주차별 보고서를 찾을 수 없습니다.")

    db.delete(report)
    db.commit()

    return {"message": "주차별 보고서가 성공적으로 삭제되었습니다."}
