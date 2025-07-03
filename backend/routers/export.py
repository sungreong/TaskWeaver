from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, distinct, and_
from database import get_db
from models import WeeklyReportDB, DetailedTaskDB, ProjectDB, TaskStatus
import pandas as pd
from io import StringIO
import logging

router = APIRouter(prefix="/export", tags=["export"])
logger = logging.getLogger(__name__)


@router.get("/weekly-reports.csv")
def export_weekly_reports_csv(
    project: str = None,
    week: str = None,
    stage: str = None,
    start_week: str = None,
    end_week: str = None,
    db: Session = Depends(get_db),
):
    """주차별 보고서를 CSV 형식으로 내보냅니다."""

    # 쿼리 구성 (joinedload 사용)
    query = db.query(WeeklyReportDB).options(joinedload(WeeklyReportDB.project_obj))

    # 필터 적용
    if project:
        query = query.join(ProjectDB, WeeklyReportDB.project_id == ProjectDB.id).filter(
            ProjectDB.name.ilike(f"%{project}%")
        )
    if week:
        query = query.filter(WeeklyReportDB.week == week)
    if stage:
        query = query.filter(WeeklyReportDB.stage.ilike(f"%{stage}%"))
    if start_week:
        query = query.filter(WeeklyReportDB.week >= start_week)
    if end_week:
        query = query.filter(WeeklyReportDB.week <= end_week)

    # 최신순 정렬
    reports = query.order_by(desc(WeeklyReportDB.week), WeeklyReportDB.project_obj.name, WeeklyReportDB.stage).all()

    # 데이터 변환
    data = []
    for report in reports:
        data.append(
            {
                "ID": report.id,
                "프로젝트": report.project_obj.name,
                "주차": report.week,
                "단계": report.stage,
                "이번 주 한 일": report.this_week_work,
                "다음 주 계획": report.next_week_plan or "",
                "이슈/리스크": report.issues_risks or "",
                "생성일": report.created_at.strftime("%Y-%m-%d %H:%M:%S") if report.created_at else "",
                "수정일": report.updated_at.strftime("%Y-%m-%d %H:%M:%S") if report.updated_at else "",
            }
        )

    # DataFrame 생성
    df = pd.DataFrame(data)

    # CSV 문자열 생성
    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False, encoding="utf-8-sig")  # BOM 추가로 한글 깨짐 방지
    csv_content = csv_buffer.getvalue()

    # 파일명 생성
    filename = "weekly_reports"
    if project:
        filename += f"_{project}"
    if week:
        filename += f"_{week}"
    filename += ".csv"

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/project-summary.csv")
def export_project_summary_csv(db: Session = Depends(get_db)):
    """프로젝트별 요약 정보를 CSV 형식으로 내보냅니다."""

    # 모든 프로젝트 목록 조회
    projects = db.query(ProjectDB.name).distinct().all()

    data = []
    for project_tuple in projects:
        project_name = project_tuple[0]

        # 프로젝트의 모든 보고서 조회
        project_obj = db.query(ProjectDB).filter(ProjectDB.name == project_name).first()
        if not project_obj:
            continue

        reports = (
            db.query(WeeklyReportDB)
            .filter(WeeklyReportDB.project_id == project_obj.id)
            .order_by(desc(WeeklyReportDB.week))
            .all()
        )

        if reports:
            # 통계 계산
            total_weeks = len(set(report.week for report in reports))
            latest_week = max(report.week for report in reports)
            stages = list(set(report.stage for report in reports))
            current_issues = len([r for r in reports if r.issues_risks and r.issues_risks.strip()])

            # 완료율 계산
            completed_reports = len(
                [
                    r
                    for r in reports
                    if not r.next_week_plan
                    or "완료" in r.next_week_plan
                    or "종료" in r.next_week_plan
                    or "마무리" in r.next_week_plan
                ]
            )
            completion_rate = (completed_reports / len(reports)) * 100 if reports else 0

            data.append(
                {
                    "프로젝트": project_name,
                    "총 주차 수": total_weeks,
                    "최신 주차": latest_week,
                    "단계 수": len(stages),
                    "진행 단계": ", ".join(stages),
                    "현재 이슈 수": current_issues,
                    "완료율(%)": round(completion_rate, 1),
                    "총 보고서 수": len(reports),
                }
            )

    # DataFrame 생성
    df = pd.DataFrame(data)

    # CSV 문자열 생성
    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False, encoding="utf-8-sig")
    csv_content = csv_buffer.getvalue()

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=project_summary.csv"},
    )


@router.get("/weekly-summary.csv")
def export_weekly_summary_csv(db: Session = Depends(get_db)):
    """주차별 요약 정보를 CSV 형식으로 내보냅니다."""

    # 모든 주차 목록 조회 (최신순)
    weeks = db.query(distinct(WeeklyReportDB.week)).order_by(desc(WeeklyReportDB.week)).all()

    data = []
    for week_tuple in weeks:
        week = week_tuple[0]

        # 해당 주차의 모든 보고서 조회
        reports = (
            db.query(WeeklyReportDB)
            .options(joinedload(WeeklyReportDB.project_obj))
            .filter(WeeklyReportDB.week == week)
            .order_by(WeeklyReportDB.project_obj.name, WeeklyReportDB.stage)
            .all()
        )

        if reports:
            # 프로젝트별 그룹핑
            project_groups = {}
            for report in reports:
                project_name = report.project_obj.name
                if project_name not in project_groups:
                    project_groups[project_name] = []
                project_groups[project_name].append(report)

            projects_with_issues = 0
            total_issues = 0

            for project_name, project_reports in project_groups.items():
                has_issues = any(r.issues_risks and r.issues_risks.strip() for r in project_reports)
                if has_issues:
                    projects_with_issues += 1
                total_issues += len([r for r in project_reports if r.issues_risks and r.issues_risks.strip()])

            data.append(
                {
                    "주차": week,
                    "총 프로젝트 수": len(project_groups),
                    "총 단계 수": len(reports),
                    "이슈가 있는 프로젝트 수": projects_with_issues,
                    "총 이슈 수": total_issues,
                    "프로젝트 목록": ", ".join(project_groups.keys()),
                }
            )

    # DataFrame 생성
    df = pd.DataFrame(data)

    # CSV 문자열 생성
    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False, encoding="utf-8-sig")
    csv_content = csv_buffer.getvalue()

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=weekly_summary.csv"},
    )


@router.get("/detailed-tasks.csv")
def export_detailed_tasks_csv(
    project: str = None,
    assignee: str = None,
    current_status: str = None,
    has_risk: bool = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
):
    """상세 업무를 CSV 형식으로 내보냅니다."""

    # 쿼리 구성 (joinedload 사용)
    query = db.query(DetailedTaskDB).options(joinedload(DetailedTaskDB.project_obj))

    # 필터 적용
    if project:
        query = query.join(ProjectDB, DetailedTaskDB.project_id == ProjectDB.id).filter(
            ProjectDB.name.ilike(f"%{project}%")
        )
    if assignee:
        query = query.filter(DetailedTaskDB.assignee.ilike(f"%{assignee}%"))
    if current_status:
        query = query.filter(DetailedTaskDB.current_status == current_status)
    if has_risk is not None:
        query = query.filter(DetailedTaskDB.has_risk == has_risk)
    if start_date:
        query = query.filter(DetailedTaskDB.planned_end_date >= start_date)
    if end_date:
        query = query.filter(DetailedTaskDB.planned_end_date <= end_date)

    # 정렬
    tasks = query.order_by(DetailedTaskDB.project_obj.name, DetailedTaskDB.stage, DetailedTaskDB.task_item).all()

    # 데이터 변환
    data = []
    for task in tasks:
        data.append(
            {
                "ID": task.id,
                "프로젝트": task.project_obj.name,
                "단계": task.stage or "",
                "업무 항목": task.task_item,
                "담당자": task.assignee or "",
                "현재 상태": task.current_status.value if task.current_status else "",
                "리스크 여부": "예" if task.has_risk else "아니오",
                "설명": task.description or "",
                "종료예정일": task.planned_end_date.strftime("%Y-%m-%d") if task.planned_end_date else "",
                "실제 완료일": task.actual_end_date.strftime("%Y-%m-%d") if task.actual_end_date else "",
                "진행률(%)": task.progress_rate,
                "생성일": task.created_at.strftime("%Y-%m-%d %H:%M:%S") if task.created_at else "",
                "수정일": task.updated_at.strftime("%Y-%m-%d %H:%M:%S") if task.updated_at else "",
            }
        )

    # DataFrame 생성
    df = pd.DataFrame(data)

    # CSV 문자열 생성
    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False, encoding="utf-8-sig")
    csv_content = csv_buffer.getvalue()

    # 파일명 생성
    filename = "detailed_tasks"
    if project:
        filename += f"_{project}"
    if assignee:
        filename += f"_{assignee}"
    filename += ".csv"

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
