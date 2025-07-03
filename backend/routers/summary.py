from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, desc, and_
from typing import List, Dict, Any, Optional
from database import get_db
from models import WeeklyReportDB, ProjectSummary, DetailedTaskDB, TaskStatus

router = APIRouter(prefix="/summary", tags=["summary"])


# 프로젝트 목록 조회
@router.get("/projects")
def get_projects(db: Session = Depends(get_db)):
    """모든 프로젝트 목록을 조회합니다."""
    projects = db.query(distinct(WeeklyReportDB.project)).all()
    return [project[0] for project in projects]


# 주차 목록 조회
@router.get("/weeks")
def get_weeks(db: Session = Depends(get_db)):
    """모든 주차 목록을 조회합니다."""
    weeks = db.query(distinct(WeeklyReportDB.week)).order_by(desc(WeeklyReportDB.week)).all()
    return [week[0] for week in weeks]


# 단계 목록 조회
@router.get("/stages")
def get_stages(db: Session = Depends(get_db)):
    """모든 단계 목록을 조회합니다."""
    stages = db.query(distinct(WeeklyReportDB.stage)).all()
    return [stage[0] for stage in stages]


# 프로젝트별 요약 정보
@router.get("/project/{project_name}")
def get_project_summary(project_name: str, db: Session = Depends(get_db)):
    """특정 프로젝트의 요약 정보를 조회합니다."""

    # 프로젝트의 모든 보고서 조회
    reports = (
        db.query(WeeklyReportDB)
        .filter(WeeklyReportDB.project == project_name)
        .order_by(desc(WeeklyReportDB.week))
        .all()
    )

    if not reports:
        return {
            "project": project_name,
            "total_weeks": 0,
            "latest_week": None,
            "stages": [],
            "current_issues": 0,
            "completion_rate": 0.0,
            "recent_updates": [],
        }

    # 통계 계산
    total_weeks = len(set(report.week for report in reports))
    latest_week = max(report.week for report in reports)
    stages = list(set(report.stage for report in reports))

    # 이슈가 있는 보고서 수 계산
    current_issues = len([r for r in reports if r.issues_risks and r.issues_risks.strip()])

    # 완료율 계산 (예시: 다음 주 계획이 비어있거나 "완료"라는 키워드가 있으면 완료로 간주)
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

    # 최근 업데이트 (최근 3개)
    recent_updates = []
    for report in reports[:3]:
        recent_updates.append(
            {
                "week": report.week,
                "stage": report.stage,
                "this_week_work": (
                    report.this_week_work[:100] + "..." if len(report.this_week_work) > 100 else report.this_week_work
                ),
                "updated_at": report.updated_at.isoformat() if report.updated_at else "",
            }
        )

    return {
        "project": project_name,
        "total_weeks": total_weeks,
        "latest_week": latest_week,
        "stages": stages,
        "current_issues": current_issues,
        "completion_rate": round(completion_rate, 1),
        "recent_updates": recent_updates,
    }


# 주차별 전체 요약
@router.get("/week/{week}")
def get_week_summary(week: str, db: Session = Depends(get_db)):
    """특정 주차의 모든 프로젝트 요약을 조회합니다."""

    reports = (
        db.query(WeeklyReportDB)
        .filter(WeeklyReportDB.week == week)
        .order_by(WeeklyReportDB.project, WeeklyReportDB.stage)
        .all()
    )

    if not reports:
        return {
            "week": week,
            "total_projects": 0,
            "total_stages": 0,
            "projects_with_issues": 0,
            "project_summaries": [],
        }

    # 프로젝트별 그룹핑
    project_groups = {}
    for report in reports:
        if report.project not in project_groups:
            project_groups[report.project] = []
        project_groups[report.project].append(report)

    project_summaries = []
    projects_with_issues = 0

    for project, project_reports in project_groups.items():
        has_issues = any(r.issues_risks and r.issues_risks.strip() for r in project_reports)
        if has_issues:
            projects_with_issues += 1

        project_summaries.append(
            {
                "project": project,
                "stages": [r.stage for r in project_reports],
                "has_issues": has_issues,
                "total_stages": len(project_reports),
            }
        )

    return {
        "week": week,
        "total_projects": len(project_groups),
        "total_stages": len(reports),
        "projects_with_issues": projects_with_issues,
        "project_summaries": project_summaries,
    }


# 전체 대시보드 요약
@router.get("/dashboard")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """전체 대시보드 요약 정보를 조회합니다."""

    # 전체 통계
    total_reports = db.query(WeeklyReportDB).count()
    total_projects = db.query(distinct(WeeklyReportDB.project)).count()
    total_weeks = db.query(distinct(WeeklyReportDB.week)).count()

    # 최근 주차
    latest_week_result = db.query(WeeklyReportDB.week).order_by(desc(WeeklyReportDB.week)).first()
    latest_week = latest_week_result[0] if latest_week_result else None

    # 이슈가 있는 보고서 수
    reports_with_issues = (
        db.query(WeeklyReportDB)
        .filter(WeeklyReportDB.issues_risks.isnot(None), WeeklyReportDB.issues_risks != "")
        .count()
    )

    # 최근 업데이트된 보고서들
    recent_reports = db.query(WeeklyReportDB).order_by(desc(WeeklyReportDB.updated_at)).limit(5).all()

    recent_activities = []
    for report in recent_reports:
        recent_activities.append(
            {
                "project": report.project,
                "week": report.week,
                "stage": report.stage,
                "updated_at": report.updated_at.isoformat() if report.updated_at else "",
            }
        )

    return {
        "total_reports": total_reports,
        "total_projects": total_projects,
        "total_weeks": total_weeks,
        "latest_week": latest_week,
        "reports_with_issues": reports_with_issues,
        "recent_activities": recent_activities,
    }


# 🆕 상세 업무 포함 종합 대시보드
@router.get("/enhanced-dashboard")
def get_enhanced_dashboard(db: Session = Depends(get_db)):
    """상세 업무 시트 데이터까지 포함한 종합 대시보드 정보를 조회합니다."""

    # 기존 주간 보고서 통계
    total_reports = db.query(WeeklyReportDB).count()
    total_projects_from_reports = db.query(distinct(WeeklyReportDB.project)).count()
    total_weeks = db.query(distinct(WeeklyReportDB.week)).count()
    reports_with_issues = (
        db.query(WeeklyReportDB)
        .filter(WeeklyReportDB.issues_risks.isnot(None), WeeklyReportDB.issues_risks != "")
        .count()
    )

    # 상세 업무 통계
    total_detailed_tasks = db.query(DetailedTaskDB).count()
    total_projects_from_tasks = db.query(distinct(DetailedTaskDB.project)).count()

    # 상세 업무 상태별 통계
    task_status_stats = {}
    for status in TaskStatus:
        count = db.query(DetailedTaskDB).filter(DetailedTaskDB.current_status == status).count()
        task_status_stats[status.value] = count

    # 진행률별 통계
    progress_stats = {
        "not_started": db.query(DetailedTaskDB).filter(DetailedTaskDB.progress_rate == 0).count(),
        "in_progress": db.query(DetailedTaskDB)
        .filter(and_(DetailedTaskDB.progress_rate > 0, DetailedTaskDB.progress_rate < 100))
        .count(),
        "completed": db.query(DetailedTaskDB).filter(DetailedTaskDB.progress_rate == 100).count(),
    }

    # 리스크 있는 업무 수
    tasks_with_risk = db.query(DetailedTaskDB).filter(DetailedTaskDB.has_risk == True).count()

    # 평균 진행률
    avg_progress_result = db.query(func.avg(DetailedTaskDB.progress_rate)).scalar()
    avg_progress = round(avg_progress_result, 1) if avg_progress_result else 0.0

    # 담당자별 업무 분포
    assignee_stats = (
        db.query(
            DetailedTaskDB.assignee,
            func.count(DetailedTaskDB.id).label("task_count"),
            func.avg(DetailedTaskDB.progress_rate).label("avg_progress"),
        )
        .filter(DetailedTaskDB.assignee.isnot(None), DetailedTaskDB.assignee != "")
        .group_by(DetailedTaskDB.assignee)
        .order_by(desc("task_count"))
        .limit(10)
        .all()
    )

    assignee_distribution = []
    for assignee, task_count, avg_progress in assignee_stats:
        assignee_distribution.append(
            {
                "assignee": assignee,
                "task_count": task_count,
                "avg_progress": round(avg_progress, 1) if avg_progress else 0.0,
            }
        )

    # 프로젝트별 업무 현황 (상위 5개)
    # 프로젝트별 기본 통계
    project_basic_stats = (
        db.query(
            DetailedTaskDB.project,
            func.count(DetailedTaskDB.id).label("total_tasks"),
            func.avg(DetailedTaskDB.progress_rate).label("avg_progress"),
        )
        .group_by(DetailedTaskDB.project)
        .order_by(desc("total_tasks"))
        .limit(5)
        .all()
    )

    # 프로젝트별 리스크 업무 수 별도 계산 (SQLAlchemy 호환성 보장)
    project_risk_stats = {}
    for project, _, _ in project_basic_stats:
        risk_count = (
            db.query(func.count(DetailedTaskDB.id))
            .filter(DetailedTaskDB.project == project)
            .filter(DetailedTaskDB.has_risk == True)
            .scalar()
        ) or 0
        project_risk_stats[project] = risk_count

    project_overview = []
    for project, total_tasks, avg_progress in project_basic_stats:
        project_overview.append(
            {
                "project": project,
                "total_tasks": total_tasks,
                "avg_progress": round(avg_progress, 1) if avg_progress else 0.0,
                "risk_tasks": project_risk_stats.get(project, 0),
            }
        )

    # 최근 업데이트된 상세 업무들
    recent_task_updates = db.query(DetailedTaskDB).order_by(desc(DetailedTaskDB.updated_at)).limit(5).all()

    recent_task_activities = []
    for task in recent_task_updates:
        recent_task_activities.append(
            {
                "project": task.project,
                "task_item": task.task_item,
                "assignee": task.assignee,
                "current_status": task.current_status.value if task.current_status else None,
                "progress_rate": task.progress_rate,
                "updated_at": task.updated_at.isoformat() if task.updated_at else "",
            }
        )

    return {
        # 전체 통계
        "overview": {
            "total_projects": max(total_projects_from_reports, total_projects_from_tasks),
            "total_reports": total_reports,
            "total_weeks": total_weeks,
            "total_detailed_tasks": total_detailed_tasks,
            "reports_with_issues": reports_with_issues,
            "tasks_with_risk": tasks_with_risk,
            "avg_task_progress": avg_progress,
        },
        # 상세 업무 통계
        "task_statistics": {
            "status_distribution": task_status_stats,
            "progress_distribution": progress_stats,
            "assignee_distribution": assignee_distribution,
            "project_overview": project_overview,
        },
        # 최근 활동
        "recent_activities": {"task_updates": recent_task_activities},
    }


# 🆕 프로젝트별 상세 현황 (주간 보고서 + 상세 업무 통합)
@router.get("/project/{project_name}/enhanced")
def get_enhanced_project_summary(project_name: str, db: Session = Depends(get_db)):
    """특정 프로젝트의 주간 보고서와 상세 업무를 통합한 요약 정보를 조회합니다."""

    # 기존 주간 보고서 통계
    reports = (
        db.query(WeeklyReportDB)
        .filter(WeeklyReportDB.project == project_name)
        .order_by(desc(WeeklyReportDB.week))
        .all()
    )

    # 상세 업무 통계
    detailed_tasks = (
        db.query(DetailedTaskDB)
        .filter(DetailedTaskDB.project == project_name)
        .order_by(desc(DetailedTaskDB.updated_at))
        .all()
    )

    if not reports and not detailed_tasks:
        return {"project": project_name, "found": False, "message": "해당 프로젝트의 데이터를 찾을 수 없습니다."}

    # 주간 보고서 요약
    weekly_summary = {
        "total_weeks": len(set(r.week for r in reports)) if reports else 0,
        "latest_week": max(r.week for r in reports) if reports else None,
        "stages": list(set(r.stage for r in reports)) if reports else [],
        "reports_with_issues": len([r for r in reports if r.issues_risks and r.issues_risks.strip()]),
        "total_reports": len(reports),
    }

    # 상세 업무 요약
    task_summary = {
        "total_tasks": len(detailed_tasks),
        "completed_tasks": len([t for t in detailed_tasks if t.progress_rate >= 100]),
        "in_progress_tasks": len([t for t in detailed_tasks if 0 < t.progress_rate < 100]),
        "not_started_tasks": len([t for t in detailed_tasks if t.progress_rate == 0]),
        "tasks_with_risk": len([t for t in detailed_tasks if t.has_risk]),
        "avg_progress": (
            round(sum(t.progress_rate for t in detailed_tasks) / len(detailed_tasks), 1) if detailed_tasks else 0.0
        ),
    }

    # 담당자별 업무 현황
    assignee_tasks = {}
    for task in detailed_tasks:
        if task.assignee:
            if task.assignee not in assignee_tasks:
                assignee_tasks[task.assignee] = {
                    "total": 0,
                    "completed": 0,
                    "in_progress": 0,
                    "with_risk": 0,
                    "avg_progress": 0.0,
                    "progress_sum": 0.0,
                }

            assignee_tasks[task.assignee]["total"] += 1
            assignee_tasks[task.assignee]["progress_sum"] += task.progress_rate

            if task.progress_rate >= 100:
                assignee_tasks[task.assignee]["completed"] += 1
            elif task.progress_rate > 0:
                assignee_tasks[task.assignee]["in_progress"] += 1

            if task.has_risk:
                assignee_tasks[task.assignee]["with_risk"] += 1

    # 평균 진행률 계산
    for assignee in assignee_tasks:
        if assignee_tasks[assignee]["total"] > 0:
            assignee_tasks[assignee]["avg_progress"] = round(
                assignee_tasks[assignee]["progress_sum"] / assignee_tasks[assignee]["total"], 1
            )
        del assignee_tasks[assignee]["progress_sum"]  # 임시 필드 제거

    # 단계별 업무 현황
    stage_tasks = {}
    for task in detailed_tasks:
        if task.stage:
            if task.stage not in stage_tasks:
                stage_tasks[task.stage] = {"total": 0, "completed": 0, "with_risk": 0, "avg_progress": 0.0}

            stage_tasks[task.stage]["total"] += 1
            if task.progress_rate >= 100:
                stage_tasks[task.stage]["completed"] += 1
            if task.has_risk:
                stage_tasks[task.stage]["with_risk"] += 1

    # 단계별 평균 진행률 계산
    for stage in stage_tasks:
        stage_task_list = [t for t in detailed_tasks if t.stage == stage]
        if stage_task_list:
            stage_tasks[stage]["avg_progress"] = round(
                sum(t.progress_rate for t in stage_task_list) / len(stage_task_list), 1
            )

    # 최근 업무 활동
    recent_task_activities = []
    for task in detailed_tasks[:5]:  # 최근 5개
        recent_task_activities.append(
            {
                "task_item": task.task_item,
                "assignee": task.assignee,
                "current_status": task.current_status.value if task.current_status else None,
                "progress_rate": task.progress_rate,
                "has_risk": task.has_risk,
                "updated_at": task.updated_at.isoformat() if task.updated_at else "",
            }
        )

    return {
        "project": project_name,
        "found": True,
        "weekly_summary": weekly_summary,
        "task_summary": task_summary,
        "assignee_breakdown": assignee_tasks,
        "stage_breakdown": stage_tasks,
        "recent_task_activities": recent_task_activities,
    }


# 🆕 담당자별 업무 현황
@router.get("/assignee/{assignee_name}")
def get_assignee_summary(assignee_name: str, db: Session = Depends(get_db)):
    """특정 담당자의 모든 업무 현황을 조회합니다."""

    tasks = (
        db.query(DetailedTaskDB)
        .filter(DetailedTaskDB.assignee == assignee_name)
        .order_by(desc(DetailedTaskDB.updated_at))
        .all()
    )

    if not tasks:
        return {"assignee": assignee_name, "found": False, "message": "해당 담당자의 업무를 찾을 수 없습니다."}

    # 프로젝트별 업무 분포
    project_distribution = {}
    for task in tasks:
        if task.project not in project_distribution:
            project_distribution[task.project] = {
                "total": 0,
                "completed": 0,
                "in_progress": 0,
                "with_risk": 0,
                "avg_progress": 0.0,
            }

        project_distribution[task.project]["total"] += 1
        if task.progress_rate >= 100:
            project_distribution[task.project]["completed"] += 1
        elif task.progress_rate > 0:
            project_distribution[task.project]["in_progress"] += 1
        if task.has_risk:
            project_distribution[task.project]["with_risk"] += 1

    # 프로젝트별 평균 진행률 계산
    for project in project_distribution:
        project_tasks = [t for t in tasks if t.project == project]
        if project_tasks:
            project_distribution[project]["avg_progress"] = round(
                sum(t.progress_rate for t in project_tasks) / len(project_tasks), 1
            )

    # 전체 통계
    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.progress_rate >= 100])
    in_progress_tasks = len([t for t in tasks if 0 < t.progress_rate < 100])
    not_started_tasks = len([t for t in tasks if t.progress_rate == 0])
    tasks_with_risk = len([t for t in tasks if t.has_risk])
    avg_progress = round(sum(t.progress_rate for t in tasks) / total_tasks, 1) if tasks else 0.0

    # 최근 업무 목록
    recent_tasks = []
    for task in tasks[:10]:  # 최근 10개
        recent_tasks.append(
            {
                "project": task.project,
                "stage": task.stage,
                "task_item": task.task_item,
                "current_status": task.current_status.value if task.current_status else None,
                "progress_rate": task.progress_rate,
                "has_risk": task.has_risk,
                "planned_end_date": task.planned_end_date.strftime("%Y-%m-%d") if task.planned_end_date else None,
                "updated_at": task.updated_at.isoformat() if task.updated_at else "",
            }
        )

    return {
        "assignee": assignee_name,
        "found": True,
        "overview": {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "in_progress_tasks": in_progress_tasks,
            "not_started_tasks": not_started_tasks,
            "tasks_with_risk": tasks_with_risk,
            "avg_progress": avg_progress,
            "total_projects": len(project_distribution),
        },
        "project_distribution": project_distribution,
        "recent_tasks": recent_tasks,
    }
