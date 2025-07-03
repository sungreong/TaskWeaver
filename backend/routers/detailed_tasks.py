from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from typing import List, Optional
import pandas as pd
import io
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
)

router = APIRouter(prefix="/detailed-tasks", tags=["detailed-tasks"])


# 상세 업무 생성
@router.post("/", response_model=DetailedTaskResponse)
def create_detailed_task(task: DetailedTaskCreate, db: Session = Depends(get_db)):
    # 동일한 프로젝트-업무항목 조합이 이미 존재하는지 확인
    existing_task = (
        db.query(DetailedTaskDB)
        .filter(
            and_(
                DetailedTaskDB.project == task.project,
                DetailedTaskDB.task_item == task.task_item,
            )
        )
        .first()
    )

    if existing_task:
        raise HTTPException(
            status_code=400,
            detail=f"프로젝트 '{task.project}'에 업무항목 '{task.task_item}'이 이미 존재합니다.",
        )

    # 날짜 문자열을 Date 객체로 변환 (빈 문자열은 None으로 처리)
    task_data = task.model_dump()
    for date_field in ["planned_end_date", "actual_end_date"]:
        if task_data[date_field] and task_data[date_field].strip():
            try:
                from datetime import datetime

                task_data[date_field] = datetime.strptime(task_data[date_field], "%Y-%m-%d").date()
            except (ValueError, TypeError):
                task_data[date_field] = None
        else:
            task_data[date_field] = None

    db_task = DetailedTaskDB(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    return DetailedTaskResponse.model_validate(db_task)


# 모든 상세 업무 조회 (필터링 지원)
@router.get("/", response_model=List[DetailedTaskResponse])
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
    query = db.query(DetailedTaskDB)

    # 필터 적용
    if project:
        query = query.filter(DetailedTaskDB.project.ilike(f"%{project}%"))
    if stage:
        query = query.filter(DetailedTaskDB.stage.ilike(f"%{stage}%"))
    if assignee:
        query = query.filter(DetailedTaskDB.assignee.ilike(f"%{assignee}%"))
    if current_status:
        query = query.filter(DetailedTaskDB.current_status == current_status)
    if has_risk is not None:
        query = query.filter(DetailedTaskDB.has_risk == has_risk)
    if planned_start_date:
        query = query.filter(DetailedTaskDB.planned_end_date >= planned_start_date)
    if planned_end_date:
        query = query.filter(DetailedTaskDB.planned_end_date <= planned_end_date)

    # 최신순 정렬
    query = query.order_by(desc(DetailedTaskDB.updated_at))

    # 페이징
    tasks = query.offset(offset).limit(limit).all()

    return [DetailedTaskResponse.model_validate(task) for task in tasks]


# 프로젝트별 상세 업무 조회
@router.get("/by-project/{project_name}", response_model=List[DetailedTaskResponse])
def get_detailed_tasks_by_project(project_name: str, db: Session = Depends(get_db)):
    tasks = (
        db.query(DetailedTaskDB)
        .filter(DetailedTaskDB.project == project_name)
        .order_by(desc(DetailedTaskDB.updated_at))
        .all()
    )

    return [DetailedTaskResponse.model_validate(task) for task in tasks]


# 프로젝트+단계별 상세 업무 조회 (주차별 보고서 연동용)
@router.get("/by-project-stage/{project_name}")
def get_detailed_tasks_by_project_and_stage(
    project_name: str, stage: Optional[str] = None, db: Session = Depends(get_db)
):
    """프로젝트와 단계에 맞는 상세 업무 목록을 조회합니다."""
    query = db.query(DetailedTaskDB).filter(DetailedTaskDB.project == project_name)

    # 단계 필터링 (선택사항)
    if stage:
        # 단계는 완전 일치가 아닌 유사 매칭으로 처리
        # 예: "설계" 단계의 보고서에 "상세설계", "기본설계" 등의 업무가 포함될 수 있음
        query = query.filter(
            or_(
                DetailedTaskDB.stage.ilike(f"%{stage}%"),
                DetailedTaskDB.task_item.ilike(f"%{stage}%"),
                # 단계 필드와 업무 항목 모두에서 검색
            )
        )

    tasks = query.order_by(desc(DetailedTaskDB.updated_at)).all()

    # 간소화된 응답 (Multi-select용)
    result = []
    for task in tasks:
        result.append(
            {
                "id": task.id,
                "stage": task.stage or "",
                "task_item": task.task_item,
                "assignee": task.assignee or "",
                "current_status": task.current_status.value if task.current_status else "not_started",
                "has_risk": task.has_risk,
                "progress_rate": task.progress_rate or 0,
                "planned_end_date": task.planned_end_date.strftime("%Y-%m-%d") if task.planned_end_date else "",
            }
        )

    return result


# 특정 상세 업무 조회
@router.get("/{task_id}", response_model=DetailedTaskResponse)
def get_detailed_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DetailedTaskDB).filter(DetailedTaskDB.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="상세 업무를 찾을 수 없습니다.")

    return DetailedTaskResponse.model_validate(task)


# 상세 업무 수정
@router.put("/{task_id}", response_model=DetailedTaskResponse)
def update_detailed_task(task_id: int, task_update: DetailedTaskUpdate, db: Session = Depends(get_db)):
    task = db.query(DetailedTaskDB).filter(DetailedTaskDB.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="상세 업무를 찾을 수 없습니다.")

    # 동일한 프로젝트-업무항목 조합 중복 확인 (자신 제외)
    if task_update.project and task_update.task_item:
        existing_task = (
            db.query(DetailedTaskDB)
            .filter(
                and_(
                    DetailedTaskDB.project == task_update.project,
                    DetailedTaskDB.task_item == task_update.task_item,
                    DetailedTaskDB.id != task_id,
                )
            )
            .first()
        )

        if existing_task:
            raise HTTPException(
                status_code=400,
                detail=f"프로젝트 '{task_update.project}'에 업무항목 '{task_update.task_item}'이 이미 존재합니다.",
            )

    # 업데이트할 데이터 준비
    update_data = task_update.model_dump(exclude_unset=True)

    # 날짜 문자열을 Date 객체로 변환 (빈 문자열은 None으로 처리)
    for date_field in ["planned_end_date", "actual_end_date"]:
        if date_field in update_data:
            if update_data[date_field] and update_data[date_field].strip():
                try:
                    from datetime import datetime

                    update_data[date_field] = datetime.strptime(update_data[date_field], "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    update_data[date_field] = None
            else:
                update_data[date_field] = None

    # 업데이트
    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)

    return DetailedTaskResponse.model_validate(task)


# 상세 업무 삭제
@router.delete("/{task_id}")
def delete_detailed_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DetailedTaskDB).filter(DetailedTaskDB.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="상세 업무를 찾을 수 없습니다.")

    db.delete(task)
    db.commit()

    return {"message": "상세 업무가 성공적으로 삭제되었습니다."}


# 주간 보고서에 상세 업무 연결
@router.post("/weekly-reports/{report_id}/link")
def link_detailed_tasks_to_weekly_report(
    report_id: int, task_links: WeeklyReportDetailedTasksUpdate, db: Session = Depends(get_db)
):
    try:
        # 입력 데이터 로깅
        print(f"🔗 주간 보고서 {report_id}에 상세 업무 연결 요청")
        print(f"📋 요청된 상세 업무 IDs: {task_links.detailed_task_ids}")
        print(f"📊 요청 데이터 타입: {type(task_links.detailed_task_ids)}")

        # 빈 목록 체크
        if not task_links.detailed_task_ids:
            print("⚠️ 빈 상세 업무 목록으로 연결 해제 처리")

        # 주간 보고서 존재 확인
        weekly_report = db.query(WeeklyReportDB).filter(WeeklyReportDB.id == report_id).first()
        if not weekly_report:
            print(f"❌ 주간 보고서 {report_id}를 찾을 수 없음")
            raise HTTPException(status_code=404, detail="주간 보고서를 찾을 수 없습니다.")

        print(f"✅ 주간 보고서 발견: {weekly_report.project} - {weekly_report.week}")

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

        # 기존 연결 제거 후 새로운 연결 설정
        old_count = len(weekly_report.detailed_tasks)
        weekly_report.detailed_tasks.clear()
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
    weekly_report = db.query(WeeklyReportDB).filter(WeeklyReportDB.id == report_id).first()
    if not weekly_report:
        raise HTTPException(status_code=404, detail="주간 보고서를 찾을 수 없습니다.")

    return [DetailedTaskResponse.model_validate(task) for task in weekly_report.detailed_tasks]


# 상세 업무와 연결된 주간 보고서 조회
@router.get("/{task_id}/weekly-reports")
def get_task_weekly_reports(task_id: int, db: Session = Depends(get_db)):
    """상세 업무와 연결된 주간 보고서 목록을 조회합니다."""
    from models import weekly_report_detailed_tasks

    task = db.query(DetailedTaskDB).filter(DetailedTaskDB.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="상세 업무를 찾을 수 없습니다.")

    # 연결된 주간 보고서 조회
    reports = (
        db.query(WeeklyReportDB)
        .join(weekly_report_detailed_tasks)
        .filter(weekly_report_detailed_tasks.c.detailed_task_id == task_id)
        .order_by(desc(WeeklyReportDB.week))
        .all()
    )

    result = []
    for report in reports:
        result.append(
            {
                "id": report.id,
                "project": report.project,
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
    tasks = db.query(DetailedTaskDB).filter(DetailedTaskDB.project == project_name).all()

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
                            DetailedTaskDB.project == task_data["project"],
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
                db_task = DetailedTaskDB(**task_data)
                db.add(db_task)
                db.commit()

                successful_imports += 1

            except Exception as e:
                failed_imports.append(
                    {
                        "row": index + 2,
                        "project": str(row.get("project", "")),
                        "task_item": str(row.get("task_item", "")),
                        "reason": f"저장 오류: {str(e)}",
                    }
                )
                db.rollback()

        return {
            "success": True,
            "message": f"파일 업로드가 완료되었습니다.",
            "data": {
                "total_rows": len(df),
                "successful_imports": successful_imports,
                "failed_imports": len(failed_imports),
                "failed_details": failed_imports[:10],  # 최대 10개만 표시
            },
        }

    except Exception as e:
        db.rollback()
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
