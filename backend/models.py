from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Enum, ForeignKey, Float, Boolean, Table
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field, field_serializer, model_serializer
from datetime import date, datetime
from typing import Optional, List, Union
import enum

# database.py에서 Base를 import
from database import Base

# WeeklyReport와 DetailedTask 간 Many-to-Many 관계를 위한 중간 테이블
weekly_report_detailed_tasks = Table(
    "weekly_report_detailed_tasks",
    Base.metadata,
    Column("weekly_report_id", Integer, ForeignKey("weekly_reports.id"), primary_key=True),
    Column("detailed_task_id", Integer, ForeignKey("detailed_tasks.id"), primary_key=True),
)


# 프로젝트 상태 열거형
class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# 프로젝트 우선순위 열거형
class ProjectPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# 프로젝트 DB 모델
class ProjectDB(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.PLANNING)
    priority = Column(Enum(ProjectPriority), default=ProjectPriority.MEDIUM)
    manager = Column(String(100))  # 프로젝트 매니저
    team_members = Column(Text)  # 팀원 (JSON 형태 또는 콤마 구분)
    budget = Column(Float)  # 예산
    notes = Column(Text)  # 비고
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 관계 설정
    weekly_reports = relationship("WeeklyReportDB", back_populates="project_obj")
    detailed_tasks = relationship("DetailedTaskDB", back_populates="project_obj")


# 주차별 보고서 DB 모델 (기존 수정)
class WeeklyReportDB(Base):
    __tablename__ = "weekly_reports"

    id = Column(Integer, primary_key=True, index=True)
    project = Column(String(255), ForeignKey("projects.name"), nullable=False, index=True)
    week = Column(String(10), nullable=False, index=True)  # YYYY-WXX 형식
    stage = Column(String(100), nullable=False)
    this_week_work = Column(Text, nullable=False)
    next_week_plan = Column(Text)
    issues_risks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 관계 설정
    project_obj = relationship("ProjectDB", back_populates="weekly_reports")
    detailed_tasks = relationship(
        "DetailedTaskDB", secondary=weekly_report_detailed_tasks, back_populates="weekly_reports"
    )


# Pydantic 모델들


# 프로젝트 기본 모델
class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="프로젝트명")
    description: Optional[str] = Field(None, description="프로젝트 설명")
    start_date: Optional[Union[str, date]] = Field(None, description="시작일 (YYYY-MM-DD)")
    end_date: Optional[Union[str, date]] = Field(None, description="종료일 (YYYY-MM-DD)")
    status: Optional[ProjectStatus] = Field(ProjectStatus.PLANNING, description="프로젝트 상태")
    priority: Optional[ProjectPriority] = Field(ProjectPriority.MEDIUM, description="우선순위")
    manager: Optional[str] = Field(None, max_length=100, description="프로젝트 매니저")
    team_members: Optional[str] = Field(None, description="팀원 목록")
    budget: Optional[float] = Field(None, description="예산")
    notes: Optional[str] = Field(None, description="비고")


# 프로젝트 생성 모델
class ProjectCreate(ProjectBase):
    pass


# 프로젝트 수정 모델
class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    manager: Optional[str] = Field(None, max_length=100)
    team_members: Optional[str] = None
    budget: Optional[float] = None
    notes: Optional[str] = None


# 프로젝트 응답 모델
class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @model_serializer
    def serialize_model(self):
        """모델 직렬화 시 날짜 필드를 문자열로 변환"""
        # 기본 dict 생성
        data = dict(self)

        # 날짜 필드들을 문자열로 변환
        for field_name in ["start_date", "end_date"]:
            if field_name in data:
                field_value = data[field_name]
                if field_value is not None and hasattr(field_value, "strftime"):
                    data[field_name] = field_value.strftime("%Y-%m-%d")
                elif field_value is not None:
                    data[field_name] = str(field_value)

        return data


# 프로젝트 통계 모델
class ProjectStats(BaseModel):
    total_weeks: int
    latest_week: Optional[str]
    total_reports: int
    current_issues: int
    completion_rate: float
    stages: List[str]


# 프로젝트 상세 정보 (통계 포함)
class ProjectDetail(ProjectResponse):
    stats: Optional[ProjectStats] = None


# 기존 주차별 보고서 모델들
class WeeklyReportBase(BaseModel):
    project: str = Field(..., min_length=1, max_length=255, description="프로젝트명")
    week: str = Field(..., pattern=r"^\d{4}-W\d{2}$", description="주차 (YYYY-WXX 형식)")
    stage: str = Field(..., min_length=1, max_length=100, description="단계/단위")
    this_week_work: str = Field(..., min_length=1, description="이번 주 한 일")
    next_week_plan: Optional[str] = Field(None, description="다음 주 계획")
    issues_risks: Optional[str] = Field(None, description="이슈/리스크")


class WeeklyReportCreate(WeeklyReportBase):
    pass


class WeeklyReportUpdate(BaseModel):
    project: Optional[str] = Field(None, min_length=1, max_length=255)
    week: Optional[str] = Field(None, pattern=r"^\d{4}-W\d{2}$")
    stage: Optional[str] = Field(None, min_length=1, max_length=100)
    this_week_work: Optional[str] = Field(None, min_length=1)
    next_week_plan: Optional[str] = None
    issues_risks: Optional[str] = None


class WeeklyReportResponse(WeeklyReportBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# 요약 정보 모델
class ProjectSummary(BaseModel):
    project_name: str
    total_weeks: int
    latest_week: str
    total_reports: int
    current_issues: int
    completion_rate: float
    stages: List[str]


class WeeklySummary(BaseModel):
    week: str
    total_projects: int
    total_stages: int
    projects_with_issues: int
    total_issues: int
    project_list: List[str]


class DashboardData(BaseModel):
    total_projects: int
    active_projects: int
    total_reports: int
    current_week_reports: int
    recent_updates: List[dict]


# 필터 모델
class WeeklyReportFilter(BaseModel):
    project: Optional[str] = None
    week: Optional[str] = None
    stage: Optional[str] = None
    start_week: Optional[str] = None
    end_week: Optional[str] = None


# 상세 업무 상태 열거형
class TaskStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"
    CANCELLED = "cancelled"


# 상세 업무 DB 모델 (간소화 버전)
class DetailedTaskDB(Base):
    __tablename__ = "detailed_tasks"

    id = Column(Integer, primary_key=True, index=True)
    project = Column(String(255), ForeignKey("projects.name"), nullable=False, index=True)
    stage = Column(String(100))  # 단계/단위
    task_item = Column(String(255), nullable=False)  # 업무 항목
    assignee = Column(String(100))  # 담당자
    current_status = Column(Enum(TaskStatus), default=TaskStatus.NOT_STARTED)  # 현재 상태
    has_risk = Column(Boolean, default=False)  # 리스크 여부
    description = Column(Text)  # 설명/요청사항/비고 통합
    planned_end_date = Column(Date)  # 종료예정일
    actual_end_date = Column(Date)  # 실제 완료일
    progress_rate = Column(Float, default=0.0)  # 진행률(%)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 관계 설정
    project_obj = relationship("ProjectDB", back_populates="detailed_tasks")
    weekly_reports = relationship(
        "WeeklyReportDB", secondary=weekly_report_detailed_tasks, back_populates="detailed_tasks"
    )


# 상세 업무 Pydantic 모델들


# 상세 업무 기본 모델 (간소화 버전)
class DetailedTaskBase(BaseModel):
    project: str = Field(..., min_length=1, max_length=255, description="프로젝트명")
    stage: Optional[str] = Field(None, max_length=100, description="단계/단위")
    task_item: str = Field(..., min_length=1, max_length=255, description="업무 항목")
    assignee: Optional[str] = Field(None, max_length=100, description="담당자")
    current_status: Optional[TaskStatus] = Field(TaskStatus.NOT_STARTED, description="현재 상태")
    has_risk: Optional[bool] = Field(False, description="리스크 여부")
    description: Optional[str] = Field(None, description="설명/요청사항/비고")
    planned_end_date: Optional[Union[str, date]] = Field(None, description="종료예정일 (YYYY-MM-DD)")
    actual_end_date: Optional[Union[str, date]] = Field(None, description="실제 완료일 (YYYY-MM-DD)")
    progress_rate: Optional[float] = Field(0.0, ge=0.0, le=100.0, description="진행률(%)")


# 상세 업무 생성 모델
class DetailedTaskCreate(DetailedTaskBase):
    pass


# 상세 업무 수정 모델 (간소화 버전)
class DetailedTaskUpdate(BaseModel):
    project: Optional[str] = Field(None, min_length=1, max_length=255)
    stage: Optional[str] = Field(None, max_length=100)
    task_item: Optional[str] = Field(None, min_length=1, max_length=255)
    assignee: Optional[str] = Field(None, max_length=100)
    current_status: Optional[TaskStatus] = None
    has_risk: Optional[bool] = None
    description: Optional[str] = None
    planned_end_date: Optional[str] = None
    actual_end_date: Optional[str] = None
    progress_rate: Optional[float] = Field(None, ge=0.0, le=100.0)


# 상세 업무 응답 모델
class DetailedTaskResponse(DetailedTaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @model_serializer
    def serialize_model(self):
        """모델 직렬화 시 날짜 필드를 문자열로 변환"""
        data = dict(self)

        # 날짜 필드들을 문자열로 변환 (간소화된 필드)
        for field_name in ["planned_end_date", "actual_end_date"]:
            if field_name in data:
                field_value = data[field_name]
                if field_value is not None and hasattr(field_value, "strftime"):
                    data[field_name] = field_value.strftime("%Y-%m-%d")
                elif field_value is not None:
                    data[field_name] = str(field_value)

        return data


# 상세 업무 필터 모델 (간소화 버전)
class DetailedTaskFilter(BaseModel):
    project: Optional[str] = None
    stage: Optional[str] = None
    assignee: Optional[str] = None
    current_status: Optional[TaskStatus] = None
    has_risk: Optional[bool] = None
    planned_start_date: Optional[str] = None
    planned_end_date: Optional[str] = None


# 주차별 보고서와 상세 업무 연결 모델
class WeeklyReportDetailedTasksUpdate(BaseModel):
    detailed_task_ids: List[int] = Field(..., description="연결할 상세 업무 ID 목록")
