import axios from 'axios';

// API 기본 URL 설정 (CRA 환경변수 방식)
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 프로젝트 관리 API 함수들
export const projectAPI = {
  // 모든 프로젝트 조회 (필터링 지원)
  getAllProjects: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return api.get(`/projects?${params.toString()}`);
  },
  
  // 프로젝트 목록 조회 (ProjectWorkspace 호환성)
  getProjects: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return api.get(`/projects?${params.toString()}`);
  },
  
  // 프로젝트명 목록 조회 (select box용)
  getProjectNames: () => api.get('/projects/names'),
  
  // 프로젝트 생성
  createProject: (projectData) => api.post('/projects', projectData),
  
  // 프로젝트 수정
  updateProject: (projectId, projectData) => api.put(`/projects/${projectId}`, projectData),
  
  // 프로젝트 삭제
  deleteProject: (projectId) => api.delete(`/projects/${projectId}`),
  
  // 특정 프로젝트 조회 (ID로)
  getProject: (projectId) => api.get(`/projects/${projectId}`),
  
  // 특정 프로젝트 조회 (이름으로)
  getProjectByName: (projectName) => api.get(`/projects/name/${encodeURIComponent(projectName)}`),
  
  // 프로젝트 전체 개요 통계
  getProjectsOverview: () => api.get('/projects/stats/overview'),
  
  // 파일 업로드 검증
  validateUploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/projects/upload/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // 프로젝트 일괄 등록
  importProjects: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/projects/upload/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // 템플릿 다운로드 URL 생성
  getTemplateDownloadUrl: (format = 'csv') => {
    return `${API_BASE_URL}/projects/template/download?format=${format}`;
  },
  
  // 업로드 가이드 정보 조회
  getUploadGuide: () => api.get('/projects/upload/guide'),
};

// 주차별 보고서 API 함수들
export const weeklyReportAPI = {
  // 모든 주차별 보고서 조회 (필터링 지원)
  getAllWeeklyReports: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return api.get(`/weekly-reports?${params.toString()}`);
  },
  
  // 주차별 보고서 생성
  createWeeklyReport: (reportData) => api.post('/weekly-reports', reportData),
  
  // 주차별 보고서 수정
  updateWeeklyReport: (reportId, reportData) => api.put(`/weekly-reports/${reportId}`, reportData),
  
  // 주차별 보고서 삭제
  deleteWeeklyReport: (reportId) => api.delete(`/weekly-reports/${reportId}`),
  
  // 특정 주차별 보고서 조회
  getWeeklyReport: (reportId) => api.get(`/weekly-reports/${reportId}`),
};

// 요약 정보 API 함수들
export const summaryAPI = {
  // 프로젝트 목록 조회
  getProjects: () => api.get('/summary/projects'),
  
  // 주차 목록 조회
  getWeeks: () => api.get('/summary/weeks'),
  
  // 단계 목록 조회
  getStages: () => api.get('/summary/stages'),
  
  // 프로젝트별 요약 정보 조회
  getProjectSummary: (projectName) => api.get(`/summary/project/${encodeURIComponent(projectName)}`),
  
  // 주차별 요약 정보 조회
  getWeeklySummary: (week) => api.get(`/summary/week/${week}`),
  
  // 전체 대시보드 조회
  getDashboard: () => api.get('/summary/dashboard'),
  
  // 🆕 상세 업무 포함 종합 요약 API
  getEnhancedDashboard: () => api.get('/summary/enhanced-dashboard'),
  getEnhancedProjectSummary: (projectName) => api.get(`/summary/project/${encodeURIComponent(projectName)}/enhanced`),
  getAssigneeSummary: (assigneeName) => api.get(`/summary/assignee/${encodeURIComponent(assigneeName)}`),
  
  // 🆕 프로젝트 타임라인 API
  getProjectTimeline: (projectName) => api.get(`/summary/project/${encodeURIComponent(projectName)}/timeline`),
};

// 상세 업무 API 함수들
export const detailedTaskAPI = {
  // 모든 상세 업무 조회 (필터링 지원)
  getAllDetailedTasks: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    return api.get(`/detailed-tasks?${params.toString()}`);
  },
  
  // 프로젝트별 상세 업무 조회
  getDetailedTasksByProject: (projectName) => 
    api.get(`/detailed-tasks/by-project/${encodeURIComponent(projectName)}`),
  
  // 프로젝트+단계별 상세 업무 조회 (주차별 보고서 연동용)
  getDetailedTasksByProjectAndStage: (projectName, stage = null) => {
    const params = new URLSearchParams();
    if (stage) params.append('stage', stage);
    return api.get(`/detailed-tasks/by-project-stage/${encodeURIComponent(projectName)}?${params.toString()}`);
  },
  
  // 상세 업무 생성
  createDetailedTask: (taskData) => api.post('/detailed-tasks/', taskData),
  
  // 상세 업무 수정
  updateDetailedTask: (taskId, taskData) => api.put(`/detailed-tasks/${taskId}`, taskData),
  
  // 상세 업무 삭제
  deleteDetailedTask: (taskId) => api.delete(`/detailed-tasks/${taskId}`),
  
  // 특정 상세 업무 조회
  getDetailedTask: (taskId) => api.get(`/detailed-tasks/${taskId}`),
  
  // 주간 보고서에 상세 업무 연결
  linkTasksToWeeklyReport: (reportId, taskIds) => 
    api.post(`/detailed-tasks/weekly-reports/${reportId}/link`, {
      detailed_task_ids: taskIds
    }),
  
  // 주간 보고서의 연결된 상세 업무 조회
  getLinkedTasks: (reportId) => 
    api.get(`/detailed-tasks/weekly-reports/${reportId}/tasks`),
  
  // 상세 업무와 연결된 주간 보고서 조회
  getTaskWeeklyReports: (taskId) => 
    api.get(`/detailed-tasks/${taskId}/weekly-reports`),
  
  // 프로젝트별 상세 업무 통계
  getProjectTaskStatistics: (projectName) => 
    api.get(`/detailed-tasks/statistics/${encodeURIComponent(projectName)}`),
  
  // 파일 업로드 검증
  validateUploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/detailed-tasks/upload/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // 상세 업무 일괄 등록
  importDetailedTasks: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/detailed-tasks/upload/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // 템플릿 가이드 정보 조회
  getUploadTemplate: () => api.get('/detailed-tasks/template/download'),
};

// CSV 내보내기 API 함수들
export const exportAPI = {
  // 주차별 보고서 CSV 다운로드 URL (필터링 지원)
  getWeeklyReportsCSVUrl: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return `${API_BASE_URL}/export/weekly-reports.csv?${params.toString()}`;
  },
  
  // 프로젝트 요약 CSV 다운로드 URL
  getProjectSummaryCSVUrl: () => `${API_BASE_URL}/export/project-summary.csv`,
  
  // 주차별 요약 CSV 다운로드 URL
  getWeeklySummaryCSVUrl: () => `${API_BASE_URL}/export/weekly-summary.csv`,
  
  // 상세 업무 CSV 다운로드 URL (필터링 지원)
  getDetailedTasksCSVUrl: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return `${API_BASE_URL}/export/detailed-tasks.csv?${params.toString()}`;
  },
};

// 유틸리티 함수들
export const utilsAPI = {
  // 정확한 주차 계산 (ISO 8601 기준)
  getCurrentWeek: () => {
    const now = new Date();
    const year = now.getFullYear();
    const week = utilsAPI.getWeekNumber(now);
    return `${year}-W${String(week).padStart(2, '0')}`;
  },
  
  // ISO 8601 주차 번호 계산
  getWeekNumber: (date) => {
    const target = new Date(date.valueOf());
    const dayNumber = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNumber + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  },
  
  // 특정 년도의 모든 주차 생성 (W01~W52/W53)
  getYearWeeks: (year = new Date().getFullYear()) => {
    const weeks = [];
    const maxWeeks = utilsAPI.getWeeksInYear(year);
    
    for (let week = 1; week <= maxWeeks; week++) {
      weeks.push(`${year}-W${String(week).padStart(2, '0')}`);
    }
    
    return weeks;
  },
  
  // 특정 년도의 총 주차 수 계산
  getWeeksInYear: (year) => {
    const dec31 = new Date(year, 11, 31);
    const weekNumber = utilsAPI.getWeekNumber(dec31);
    return weekNumber === 1 ? 52 : weekNumber;
  },
  
  // 현재 년도와 다음 년도 주차 모두 생성
  getAllRecentWeeks: () => {
    const currentYear = new Date().getFullYear();
    const currentWeeks = utilsAPI.getYearWeeks(currentYear);
    const nextWeeks = utilsAPI.getYearWeeks(currentYear + 1);
    
    return [...currentWeeks, ...nextWeeks];
  },
  
  // 주차 형식 검증
  isValidWeekFormat: (week) => {
    return /^\d{4}-W\d{2}$/.test(week);
  },
  
  // 최근 12주 생성 (현재 주차 기준)
  getRecentWeeks: () => {
    const weeks = [];
    const now = new Date();
    
    for (let i = -6; i < 6; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + (i * 7));
      
      const year = date.getFullYear();
      const week = utilsAPI.getWeekNumber(date);
      weeks.push(`${year}-W${String(week).padStart(2, '0')}`);
    }
    
    return weeks;
  },
  
  // 주차 날짜 범위 계산
  getWeekDateRange: (weekString) => {
    const match = weekString.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return null;
    
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    
    // 해당 년도 1월 4일 (항상 첫째 주에 포함)
    const jan4 = new Date(year, 0, 4);
    const firstWeekStart = new Date(jan4);
    firstWeekStart.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    
    // 해당 주의 시작일
    const weekStart = new Date(firstWeekStart);
    weekStart.setDate(firstWeekStart.getDate() + (week - 1) * 7);
    
    // 해당 주의 종료일
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return {
      start: weekStart,
      end: weekEnd,
      startString: weekStart.toLocaleDateString(),
      endString: weekEnd.toLocaleDateString()
    };
  },
  
  // 주차 문자열을 표시용으로 변환
  formatWeekDisplay: (weekString) => {
    const dateRange = utilsAPI.getWeekDateRange(weekString);
    if (!dateRange) return weekString;
    
    return `${weekString} (${dateRange.startString} ~ ${dateRange.endString})`;
  },
  
  // 프로젝트 상태 색상 매핑
  getProjectStatusColor: (status) => {
    const statusColors = {
      '계획': 'bg-gray-100 text-gray-800',
      '진행중': 'bg-blue-100 text-blue-800',
      '보류': 'bg-yellow-100 text-yellow-800',
      '완료': 'bg-green-100 text-green-800',
      '취소': 'bg-red-100 text-red-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  },
  
  // 프로젝트 우선순위 색상 매핑
  getProjectPriorityColor: (priority) => {
    const priorityColors = {
      '낮음': 'bg-gray-100 text-gray-600',
      '보통': 'bg-blue-100 text-blue-600',
      '높음': 'bg-orange-100 text-orange-600',
      '긴급': 'bg-red-100 text-red-600'
    };
    return priorityColors[priority] || 'bg-gray-100 text-gray-600';
  },
  
  // 날짜 형식 변환
  formatDate: (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
  },
  
  // 프로젝트 진행률 계산 (시작일과 종료일 기준)
  calculateProjectProgress: (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    
    if (now < start) return 0;
    if (now > end) return 100;
    
    const totalDuration = end.getTime() - start.getTime();
    const currentDuration = now.getTime() - start.getTime();
    
    return Math.round((currentDuration / totalDuration) * 100);
  }
};

export default api; 