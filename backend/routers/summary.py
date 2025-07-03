from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, distinct, and_, case, or_
from database import get_db
from models import WeeklyReportDB, DetailedTaskDB, ProjectDB, TaskStatus
from typing import List, Dict, Any, Optional
import logging

router = APIRouter(prefix="/summary", tags=["summary"])
logger = logging.getLogger(__name__)


@router.get("/projects")
def get_projects(db: Session = Depends(get_db)):
    """모든 프로젝트 목록을 조회합니다."""
    # ProjectDB 테이블에서 직접 조회
    projects = db.query(ProjectDB).all()
    return [{"name": project.name, "id": project.id} for project in projects]


@router.get("/weeks")
def get_weeks(db: Session = Depends(get_db)):
    """모든 주차 목록을 조회합니다."""
    weeks = db.query(distinct(WeeklyReportDB.week)).order_by(desc(WeeklyReportDB.week)).all()
    return [week[0] for week in weeks]


@router.get("/stages")
def get_stages(db: Session = Depends(get_db)):
    """모든 단계 목록을 조회합니다."""
    stages = db.query(distinct(WeeklyReportDB.stage)).all()
    return [stage[0] for stage in stages]


@router.get("/project/{project_name}")
def get_project_summary(project_name: str, db: Session = Depends(get_db)):
    """특정 프로젝트의 요약 정보를 조회합니다."""

    # ProjectDB에서 프로젝트 조회
    project = db.query(ProjectDB).filter(ProjectDB.name == project_name).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    # 관련된 보고서들 조회 (relationship 사용)
    reports = (
        db.query(WeeklyReportDB)
        .options(joinedload(WeeklyReportDB.project_obj))
        .filter(WeeklyReportDB.project_id == project.id)
        .order_by(WeeklyReportDB.week)
        .all()
    )

    if not reports:
        return {
            "project_name": project_name,
            "total_weeks": 0,
            "latest_week": None,
            "current_issues": 0,
            "completion_rate": 0.0,
            "stages": [],
            "report_count": 0,
            "weeks": [],
        }

    # 기본 통계 계산
    weeks = list(set(report.week for report in reports))
    total_weeks = len(weeks)
    latest_week = max(weeks)
    stages = list(set(report.stage for report in reports))
    current_issues = len([report for report in reports if report.issues_risks and report.issues_risks.strip()])

    # 완료율 계산 (간단한 휴리스틱)
    completed_reports = 0
    for report in reports:
        if report.next_week_plan:
            next_plan_lower = report.next_week_plan.lower()
            if any(keyword in next_plan_lower for keyword in ["완료", "종료", "마무리", "끝", "finish", "complete"]):
                completed_reports += 1

    completion_rate = (completed_reports / len(reports)) * 100 if reports else 0

    return {
        "project_name": project_name,
        "total_weeks": total_weeks,
        "latest_week": latest_week,
        "current_issues": current_issues,
        "completion_rate": round(completion_rate, 1),
        "stages": stages,
        "report_count": len(reports),
        "weeks": sorted(weeks, reverse=True),
    }


@router.get("/week/{week}")
def get_week_summary(week: str, db: Session = Depends(get_db)):
    """특정 주차의 요약 정보를 조회합니다."""

    reports = (
        db.query(WeeklyReportDB)
        .options(joinedload(WeeklyReportDB.project_obj))
        .filter(WeeklyReportDB.week == week)
        .order_by(WeeklyReportDB.project_obj.name, WeeklyReportDB.stage)
        .all()
    )

    if not reports:
        return {
            "week": week,
            "total_projects": 0,
            "total_stages": 0,
            "projects_with_issues": 0,
            "total_issues": 0,
            "project_list": [],
        }

    # 프로젝트별 그룹핑
    project_groups = {}
    for report in reports:
        project_name = report.project_obj.name
        if project_name not in project_groups:
            project_groups[project_name] = []
        project_groups[project_name].append(report)

    # 통계 계산
    total_projects = len(project_groups)
    total_stages = len(reports)
    projects_with_issues = 0
    total_issues = 0

    for project_name, project_reports in project_groups.items():
        has_issues = any(r.issues_risks and r.issues_risks.strip() for r in project_reports)
        if has_issues:
            projects_with_issues += 1
        total_issues += len([r for r in project_reports if r.issues_risks and r.issues_risks.strip()])

    return {
        "week": week,
        "total_projects": total_projects,
        "total_stages": total_stages,
        "projects_with_issues": projects_with_issues,
        "total_issues": total_issues,
        "project_list": list(project_groups.keys()),
    }


@router.get("/dashboard")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """전체 대시보드 요약 정보를 조회합니다."""

    # 기본 통계
    total_projects = db.query(ProjectDB).count()
    total_reports = db.query(WeeklyReportDB).count()
    total_weeks = db.query(distinct(WeeklyReportDB.week)).count()

    # 최근 업데이트 (프로젝트명 포함)
    recent_reports = (
        db.query(WeeklyReportDB)
        .options(joinedload(WeeklyReportDB.project_obj))
        .order_by(desc(WeeklyReportDB.updated_at))
        .limit(5)
        .all()
    )

    recent_updates = []
    for report in recent_reports:
        recent_updates.append(
            {
                "project": report.project_obj.name,
                "week": report.week,
                "stage": report.stage,
                "updated_at": report.updated_at.isoformat() if report.updated_at else "",
            }
        )

    return {
        "total_projects": total_projects,
        "total_reports": total_reports,
        "total_weeks": total_weeks,
        "recent_updates": recent_updates,
    }


@router.get("/enhanced-dashboard")
def get_enhanced_dashboard(db: Session = Depends(get_db)):
    """상세 업무 시트 데이터까지 포함한 종합 대시보드 정보를 조회합니다."""

    total_reports = db.query(WeeklyReportDB).count()
    total_projects_from_reports = db.query(distinct(WeeklyReportDB.project_id)).count()
    total_weeks = db.query(distinct(WeeklyReportDB.week)).count()
    reports_with_issues = (
        db.query(WeeklyReportDB)
        .filter(WeeklyReportDB.issues_risks.isnot(None), WeeklyReportDB.issues_risks != "")
        .count()
    )

    total_detailed_tasks = db.query(DetailedTaskDB).count()
    total_projects_from_tasks = db.query(distinct(DetailedTaskDB.project_id)).count()

    task_status_stats = {}
    for status in TaskStatus:
        count = db.query(DetailedTaskDB).filter(DetailedTaskDB.current_status == status).count()
        task_status_stats[status.value] = count

    progress_stats = {
        "not_started": db.query(DetailedTaskDB).filter(DetailedTaskDB.progress_rate == 0).count(),
        "in_progress": db.query(DetailedTaskDB)
        .filter(and_(DetailedTaskDB.progress_rate > 0, DetailedTaskDB.progress_rate < 100))
        .count(),
        "completed": db.query(DetailedTaskDB).filter(DetailedTaskDB.progress_rate == 100).count(),
    }

    tasks_with_risk = db.query(DetailedTaskDB).filter(DetailedTaskDB.has_risk == True).count()

    avg_progress_result = db.query(func.avg(DetailedTaskDB.progress_rate)).scalar()
    avg_progress = round(avg_progress_result, 1) if avg_progress_result else 0.0

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

    # 프로젝트별 기본 통계 (관계 활용)
    project_basic_stats = (
        db.query(
            ProjectDB.name,
            func.count(DetailedTaskDB.id).label("total_tasks"),
            func.avg(DetailedTaskDB.progress_rate).label("avg_progress"),
        )
        .join(DetailedTaskDB, ProjectDB.id == DetailedTaskDB.project_id)
        .group_by(ProjectDB.name)
        .order_by(desc("total_tasks"))
        .limit(5)
        .all()
    )

    project_risk_stats = {}
    for project_name, _, _ in project_basic_stats:
        risk_count = (
            db.query(func.count(DetailedTaskDB.id))
            .join(ProjectDB, ProjectDB.id == DetailedTaskDB.project_id)
            .filter(ProjectDB.name == project_name)
            .filter(DetailedTaskDB.has_risk == True)
            .scalar()
        ) or 0
        project_risk_stats[project_name] = risk_count

    project_overview = []
    for project_name, total_tasks, avg_progress in project_basic_stats:
        project_overview.append(
            {
                "project": project_name,
                "total_tasks": total_tasks,
                "avg_progress": round(avg_progress, 1) if avg_progress else 0.0,
                "risk_tasks": project_risk_stats.get(project_name, 0),
            }
        )

    # 최근 업무 업데이트 (프로젝트명 포함)
    recent_task_updates = (
        db.query(DetailedTaskDB)
        .options(joinedload(DetailedTaskDB.project_obj))
        .order_by(desc(DetailedTaskDB.updated_at))
        .limit(5)
        .all()
    )

    recent_task_activities = []
    for task in recent_task_updates:
        recent_task_activities.append(
            {
                "project": task.project_obj.name,
                "task_item": task.task_item,
                "assignee": task.assignee,
                "current_status": task.current_status.value if task.current_status else None,
                "progress_rate": task.progress_rate,
                "updated_at": task.updated_at.isoformat() if task.updated_at else "",
            }
        )

    return {
        "overview": {
            "total_projects": max(total_projects_from_reports, total_projects_from_tasks),
            "total_reports": total_reports,
            "total_weeks": total_weeks,
            "total_detailed_tasks": total_detailed_tasks,
            "reports_with_issues": reports_with_issues,
            "tasks_with_risk": tasks_with_risk,
            "avg_task_progress": avg_progress,
        },
        "task_statistics": {
            "status_distribution": task_status_stats,
            "progress_distribution": progress_stats,
            "assignee_distribution": assignee_distribution,
            "project_overview": project_overview,
        },
        "recent_activities": {"task_updates": recent_task_activities},
    }


@router.get("/project/{project_name}/enhanced")
def get_enhanced_project_summary(project_name: str, db: Session = Depends(get_db)):
    """특정 프로젝트의 주간 보고서와 상세 업무를 통합한 요약 정보를 조회합니다."""

    # 프로젝트 확인
    project = db.query(ProjectDB).filter(ProjectDB.name == project_name).first()
    if not project:
        return {"project": project_name, "found": False, "message": "해당 프로젝트를 찾을 수 없습니다."}

    # 프로젝트 ID로 데이터 조회
    reports = (
        db.query(WeeklyReportDB).filter(WeeklyReportDB.project_id == project.id).order_by(WeeklyReportDB.week).all()
    )

    detailed_tasks = (
        db.query(DetailedTaskDB)
        .filter(DetailedTaskDB.project_id == project.id)
        .order_by(DetailedTaskDB.planned_end_date, DetailedTaskDB.created_at)
        .all()
    )

    if not reports and not detailed_tasks:
        return {"project": project_name, "found": False, "message": "해당 프로젝트의 데이터를 찾을 수 없습니다."}

    weekly_summary = {
        "total_weeks": len(set(r.week for r in reports)) if reports else 0,
        "latest_week": max(r.week for r in reports) if reports else None,
        "stages": list(set(r.stage for r in reports)) if reports else [],
        "reports_with_issues": len([r for r in reports if r.issues_risks and r.issues_risks.strip()]),
        "total_reports": len(reports),
    }

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

    for assignee in assignee_tasks:
        if assignee_tasks[assignee]["total"] > 0:
            assignee_tasks[assignee]["avg_progress"] = round(
                assignee_tasks[assignee]["progress_sum"] / assignee_tasks[assignee]["total"], 1
            )
        del assignee_tasks[assignee]["progress_sum"]

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

    for stage in stage_tasks:
        stage_progress = [t.progress_rate for t in detailed_tasks if t.stage == stage]
        if stage_progress:
            stage_tasks[stage]["avg_progress"] = round(sum(stage_progress) / len(stage_progress), 1)

    return {
        "project": project_name,
        "found": True,
        "weekly_summary": weekly_summary,
        "task_summary": task_summary,
        "assignee_breakdown": assignee_tasks,
        "stage_breakdown": stage_tasks,
    }


@router.get("/assignee/{assignee_name}")
def get_assignee_summary(assignee_name: str, db: Session = Depends(get_db)):
    """특정 담당자의 업무 요약 정보를 조회합니다."""

    # 담당자의 모든 업무 조회
    tasks = (
        db.query(DetailedTaskDB)
        .options(joinedload(DetailedTaskDB.project_obj))
        .filter(DetailedTaskDB.assignee == assignee_name)
        .all()
    )

    if not tasks:
        return {
            "assignee": assignee_name,
            "found": False,
            "message": f"담당자 '{assignee_name}'의 업무를 찾을 수 없습니다.",
        }

    # 기본 통계
    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.progress_rate >= 100])
    in_progress_tasks = len([t for t in tasks if 0 < t.progress_rate < 100])
    not_started_tasks = len([t for t in tasks if t.progress_rate == 0])
    tasks_with_risk = len([t for t in tasks if t.has_risk])
    avg_progress = round(sum(t.progress_rate for t in tasks) / total_tasks, 1) if tasks else 0.0

    # 프로젝트별 분류
    project_breakdown = {}
    for task in tasks:
        project_name = task.project_obj.name
        if project_name not in project_breakdown:
            project_breakdown[project_name] = {
                "total": 0,
                "completed": 0,
                "in_progress": 0,
                "with_risk": 0,
                "avg_progress": 0.0,
            }

        project_breakdown[project_name]["total"] += 1
        if task.progress_rate >= 100:
            project_breakdown[project_name]["completed"] += 1
        elif task.progress_rate > 0:
            project_breakdown[project_name]["in_progress"] += 1
        if task.has_risk:
            project_breakdown[project_name]["with_risk"] += 1

    for project_name in project_breakdown:
        project_tasks = [t for t in tasks if t.project_obj.name == project_name]
        if project_tasks:
            project_breakdown[project_name]["avg_progress"] = round(
                sum(t.progress_rate for t in project_tasks) / len(project_tasks), 1
            )

    # 상태별 분류
    status_breakdown = {}
    for task in tasks:
        status = task.current_status.value
        if status not in status_breakdown:
            status_breakdown[status] = 0
        status_breakdown[status] += 1

    return {
        "assignee": assignee_name,
        "found": True,
        "summary": {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "in_progress_tasks": in_progress_tasks,
            "not_started_tasks": not_started_tasks,
            "tasks_with_risk": tasks_with_risk,
            "avg_progress": avg_progress,
        },
        "project_breakdown": project_breakdown,
        "status_breakdown": status_breakdown,
    }


@router.get("/project/{project_name}/timeline")
def get_project_timeline(project_name: str, db: Session = Depends(get_db)):
    """프로젝트의 완전한 타임라인 정보를 조회합니다."""

    # 프로젝트 확인
    project = db.query(ProjectDB).filter(ProjectDB.name == project_name).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    # 모든 관련 데이터 조회
    reports = db.query(WeeklyReportDB).filter(WeeklyReportDB.project_id == project.id).all()
    all_tasks = db.query(DetailedTaskDB).filter(DetailedTaskDB.project_id == project.id).all()

    # 통합 타임라인 이벤트 생성
    timeline_events = []

    # 1. 프로젝트 생성 이벤트
    timeline_events.append(
        {
            "type": "project",
            "title": f"프로젝트 '{project.name}' 생성",
            "description": project.description or "새로운 프로젝트가 생성되었습니다.",
            "date": project.created_at.isoformat(),
            "icon": "🚀",
            "color": "purple",
            "details": {
                "project_name": project.name,
                "manager": project.manager,
                "status": project.status.value if project.status else None,
                "priority": project.priority.value if project.priority else None,
                "start_date": project.start_date.isoformat() if project.start_date else None,
                "end_date": project.end_date.isoformat() if project.end_date else None,
            },
        }
    )

    # 2. 프로젝트 수정 이벤트 (생성 시간과 다른 경우)
    if project.updated_at and project.updated_at != project.created_at:
        timeline_events.append(
            {
                "type": "project",
                "title": f"프로젝트 '{project.name}' 수정",
                "description": "프로젝트 정보가 수정되었습니다.",
                "date": project.updated_at.isoformat(),
                "icon": "✏️",
                "color": "blue",
                "details": {
                    "project_name": project.name,
                    "manager": project.manager,
                    "status": project.status.value if project.status else None,
                    "priority": project.priority.value if project.priority else None,
                },
            }
        )

    # 3. 주간 보고서 생성 이벤트
    for report in reports:
        timeline_events.append(
            {
                "type": "report",
                "title": f"{report.week} 주간 보고서 작성",
                "description": (
                    f"[{report.stage}] {report.this_week_work[:50]}..."
                    if len(report.this_week_work) > 50
                    else f"[{report.stage}] {report.this_week_work}"
                ),
                "date": report.created_at.isoformat(),
                "icon": "📋",
                "color": "red" if report.issues_risks and report.issues_risks.strip() else "blue",
                "details": {
                    "week": report.week,
                    "stage": report.stage,
                    "this_week_work": report.this_week_work,
                    "next_week_plan": report.next_week_plan,
                    "issues_risks": report.issues_risks,
                    "action": "생성",
                },
            }
        )

        # 4. 주간 보고서 수정 이벤트 (생성 시간과 다른 경우)
        if report.updated_at and report.updated_at != report.created_at:
            timeline_events.append(
                {
                    "type": "report",
                    "title": f"{report.week} 주간 보고서 수정",
                    "description": f"[{report.stage}] 보고서가 수정되었습니다.",
                    "date": report.updated_at.isoformat(),
                    "icon": "✏️",
                    "color": "orange",
                    "details": {"week": report.week, "stage": report.stage, "action": "수정"},
                }
            )

    # 5. 상세 업무 생성 이벤트
    for task in all_tasks:
        timeline_events.append(
            {
                "type": "task",
                "title": f"업무 '{task.task_item}' 생성",
                "description": f"[{task.assignee or '미지정'}] {task.stage or '일반'} 단계",
                "date": task.created_at.isoformat(),
                "icon": "📝",
                "color": "gray",
                "details": {
                    "task_item": task.task_item,
                    "assignee": task.assignee,
                    "stage": task.stage,
                    "current_status": task.current_status.value if task.current_status else None,
                    "progress_rate": task.progress_rate,
                    "action": "생성",
                },
            }
        )

        # 6. 상세 업무 수정 이벤트 (생성 시간과 다른 경우)
        if task.updated_at and task.updated_at != task.created_at:
            timeline_events.append(
                {
                    "type": "task",
                    "title": f"업무 '{task.task_item}' 수정",
                    "description": f"[{task.assignee or '미지정'}] 진행률 {task.progress_rate}%",
                    "date": task.updated_at.isoformat(),
                    "icon": "📊",
                    "color": "orange",
                    "details": {
                        "task_item": task.task_item,
                        "assignee": task.assignee,
                        "current_status": task.current_status.value if task.current_status else None,
                        "progress_rate": task.progress_rate,
                        "has_risk": task.has_risk,
                        "action": "수정",
                    },
                }
            )

        # 7. 상세 업무 완료 이벤트 (실제 완료일이 있는 경우)
        if task.actual_end_date:
            timeline_events.append(
                {
                    "type": "milestone",
                    "title": f"업무 '{task.task_item}' 완료",
                    "description": f"[{task.assignee or '미지정'}] 업무가 완료되었습니다.",
                    "date": task.actual_end_date.isoformat(),
                    "icon": "✅",
                    "color": "green",
                    "details": {
                        "task_item": task.task_item,
                        "assignee": task.assignee,
                        "actual_end_date": task.actual_end_date.isoformat(),
                        "progress_rate": task.progress_rate,
                        "action": "완료",
                    },
                }
            )

        # 8. 리스크 발생 이벤트 (리스크가 있는 경우)
        if task.has_risk:
            timeline_events.append(
                {
                    "type": "risk",
                    "title": f"리스크 발생: {task.task_item}",
                    "description": f"[{task.assignee or '미지정'}] 업무에 리스크가 발생했습니다.",
                    "date": task.updated_at.isoformat(),  # 리스크는 수정 시점에 발생했다고 가정
                    "icon": "⚠️",
                    "color": "red",
                    "details": {
                        "task_item": task.task_item,
                        "assignee": task.assignee,
                        "current_status": task.current_status.value if task.current_status else None,
                        "progress_rate": task.progress_rate,
                        "action": "리스크 발생",
                    },
                }
            )

    # 날짜순 정렬
    timeline_events.sort(key=lambda x: x["date"])

    # 통계 계산
    completed_tasks = len([t for t in all_tasks if t.progress_rate >= 100])
    issues_count = len([r for r in reports if r.issues_risks and r.issues_risks.strip()]) + len(
        [t for t in all_tasks if t.has_risk]
    )

    # 날짜 범위 계산
    dates = [event["date"] for event in timeline_events]
    date_range = {"start": min(dates) if dates else None, "end": max(dates) if dates else None}

    # 프로그레스 트렌드 (주별 진행률)
    progress_trend = []
    for report in reports:
        week_tasks = [
            t for t in all_tasks if t.created_at and t.created_at.isocalendar()[1] == int(report.week.split("-W")[1])
        ]
        if week_tasks:
            avg_progress = sum(t.progress_rate for t in week_tasks) / len(week_tasks)
            progress_trend.append({"week": report.week, "progress": round(avg_progress, 1)})

    return {
        "found": True,
        "project_info": {
            "name": project.name,
            "description": project.description or f"{project.name} 프로젝트 진행 현황",
        },
        "summary": {
            "total_events": len(timeline_events),
            "completed_tasks": completed_tasks,
            "issues_count": issues_count,
            "date_range": date_range,
        },
        "timeline_events": timeline_events,
        "progress_trend": progress_trend,
    }
