import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { weeklyReportAPI, projectAPI, utilsAPI, detailedTaskAPI } from '../services/api';
import MarkdownEditor from './MarkdownEditor';
import DetailedTaskFormModal from './DetailedTaskFormModal';
import ProjectFormModal from './ProjectFormModal';

const WeeklyReportForm = ({ editingReport, onSave, onCancel, defaultProject, fullscreen = false }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projectNames, setProjectNames] = useState([]);
  const [isNewProject, setIsNewProject] = useState(false);
  
  // 상세 업무 관련 상태
  const [availableTasks, setAvailableTasks] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  
  // 상세 업무 추가 모달 상태
  const [showTaskModal, setShowTaskModal] = useState(false);
  
  // 프로젝트 추가 모달 상태
  const [showProjectModal, setShowProjectModal] = useState(false);
  
  // API 호출 중복 방지를 위한 ref
  const isProjectNamesFetched = useRef(false);
  const projectNamesLoading = useRef(false);
  
  // 폼 데이터
  const [formData, setFormData] = useState({
    project: '',
    week: '',
    stage: '',
    this_week_work: '',
    next_week_plan: '',
    issues_risks: '',
    detailed_task_ids: []
  });

  // 프로젝트명 목록 조회 (메모이제이션 + 중복 방지)
  const fetchProjectNames = useCallback(async () => {
    // 이미 로딩 중이거나 가져온 상태면 중복 호출 방지
    if (projectNamesLoading.current || isProjectNamesFetched.current) {
      return;
    }
    
    try {
      projectNamesLoading.current = true;
      console.log('🔄 Fetching project names...'); // 디버깅용 로그
      const response = await projectAPI.getProjectNames();
      setProjectNames(response.data);
      isProjectNamesFetched.current = true;
      console.log('✅ Project names fetched:', response.data.length); // 디버깅용 로그
    } catch (err) {
      console.error('❌ Failed to fetch project names:', err);
    } finally {
      projectNamesLoading.current = false;
    }
  }, []); // 빈 의존성 배열로 완전 메모이제이션

  // 프로젝트별 상세 업무 목록 조회
  const fetchDetailedTasks = useCallback(async (projectName) => {
    if (!projectName) {
      setAvailableTasks([]);
      return;
    }
    
    setTasksLoading(true);
    try {
      const response = await detailedTaskAPI.getDetailedTasksByProject(projectName);
      setAvailableTasks(response.data);
    } catch (err) {
      console.error('Failed to fetch detailed tasks:', err);
      setAvailableTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  // 연결된 상세 업무 조회
  const fetchLinkedTasks = useCallback(async (reportId) => {
    if (!reportId) return;
    
    try {
      const response = await detailedTaskAPI.getLinkedTasks(reportId);
      const linkedTaskIds = response.data.map(task => task.id);
      setSelectedTaskIds(linkedTaskIds);
      setFormData(prev => ({ ...prev, detailed_task_ids: linkedTaskIds }));
    } catch (err) {
      console.error('Failed to fetch linked tasks:', err);
    }
  }, []);

  // 프로젝트명 목록 조회 (컴포넌트 마운트 시 한 번만)
  useEffect(() => {
    fetchProjectNames();
  }, []); // 빈 의존성 배열로 한 번만 실행

  // 편집 모드 여부 확인 (id가 있는 경우만 진짜 편집 모드)
  const isEditMode = editingReport && editingReport.id;

  // 편집 모드 데이터 로드 (editingReport 변경 시에만)
  useEffect(() => {
    if (isEditMode) {
      console.log('📝 Loading editing report data...'); // 디버깅용 로그
      // 수정 모드인 경우 기존 데이터 로드
      setFormData({
        project: editingReport.project || '',
        week: editingReport.week || '',
        stage: editingReport.stage || '',
        this_week_work: editingReport.this_week_work || '',
        next_week_plan: editingReport.next_week_plan || '',
        issues_risks: editingReport.issues_risks || '',
        detailed_task_ids: []
      });
      
      // 연결된 상세 업무 로드
      fetchLinkedTasks(editingReport.id);
      
      // 프로젝트별 상세 업무 목록 로드
      if (editingReport.project) {
        fetchDetailedTasks(editingReport.project);
      }
    } else {
      console.log('🆕 Initializing new report form...'); // 디버깅용 로그
      // 새 보고서 작성 시 현재 주차로 초기화
      setFormData(prev => ({
        ...prev,
        project: defaultProject || '',
        week: utilsAPI.getCurrentWeek(),
        detailed_task_ids: []
      }));
      setSelectedTaskIds([]);
      
      // defaultProject가 있으면 해당 프로젝트의 상세 업무 로드
      if (defaultProject) {
        fetchDetailedTasks(defaultProject);
      } else {
        setAvailableTasks([]);
      }
    }
  }, [editingReport, defaultProject, fetchLinkedTasks, fetchDetailedTasks, isEditMode]); // 의존성 추가

  // 편집 모드에서 프로젝트 존재 여부 확인 (별도 useEffect)
  useEffect(() => {
    if (isEditMode && editingReport.project && projectNames.length > 0) {
      const projectExists = projectNames.includes(editingReport.project);
      if (!projectExists) {
        console.log('🔍 Project not found in list, switching to new project mode'); // 디버깅용 로그
        setIsNewProject(true);
      } else {
        setIsNewProject(false);
      }
    }
  }, [isEditMode, editingReport?.project, projectNames.length]); // 더 정확한 의존성 설정

  // 입력 필드 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 프로젝트 선택 변경 핸들러
  const handleProjectChange = (e) => {
    const value = e.target.value;
    
    if (value === '__NEW_PROJECT__') {
      // 모달 열기
      handleOpenProjectModal();
      // select 박스를 원래 상태로 되돌림
      e.target.value = formData.project;
    } else {
      setIsNewProject(false);
      setFormData(prev => ({
        ...prev,
        project: value,
        detailed_task_ids: []
      }));
      setSelectedTaskIds([]);
      
      // 프로젝트별 상세 업무 목록 로드
      if (value) {
        fetchDetailedTasks(value);
      } else {
        setAvailableTasks([]);
      }
    }
  };

  // 신규/기존 프로젝트 토글
  const toggleProjectMode = () => {
    setIsNewProject(!isNewProject);
    setFormData(prev => ({
      ...prev,
      project: ''
    }));
  };

  // 프로젝트 생성 모달 열기
  const handleOpenProjectModal = () => {
    setShowProjectModal(true);
  };

  // 프로젝트 생성 성공 콜백
  const handleProjectCreated = async () => {
    // 프로젝트 목록 새로고침
    isProjectNamesFetched.current = false; // 재조회 플래그 리셋
    await fetchProjectNames();
    
    // 새로 생성된 프로젝트를 자동 선택하기 위해 잠시 기다림
    setTimeout(async () => {
      const response = await projectAPI.getProjectNames();
      const latestProject = response.data[response.data.length - 1]; // 가장 최근 프로젝트
      if (latestProject) {
        setFormData(prev => ({
          ...prev,
          project: latestProject
        }));
        setIsNewProject(false);
        // 새 프로젝트의 상세 업무 로드
        fetchDetailedTasks(latestProject);
      }
    }, 100);
  };

  // 현재 주차 설정
  const setCurrentWeek = () => {
    setFormData(prev => ({
      ...prev,
      week: utilsAPI.getCurrentWeek()
    }));
  };

  // 상세 업무 선택 핸들러
  const handleTaskSelection = (taskId) => {
    const newSelectedIds = selectedTaskIds.includes(taskId)
      ? selectedTaskIds.filter(id => id !== taskId)
      : [...selectedTaskIds, taskId];
    
    setSelectedTaskIds(newSelectedIds);
    setFormData(prev => ({
      ...prev,
      detailed_task_ids: newSelectedIds
    }));
  };

  // 모든 상세 업무 선택/해제
  const toggleAllTasks = () => {
    const allSelected = selectedTaskIds.length === availableTasks.length && availableTasks.length > 0;
    const newSelectedIds = allSelected ? [] : availableTasks.map(task => task.id);
    
    setSelectedTaskIds(newSelectedIds);
    setFormData(prev => ({
      ...prev,
      detailed_task_ids: newSelectedIds
    }));
  };

  // 새 상세 업무 저장 후 핸들러
  const handleNewTaskSaved = (newTask) => {
    // 상세 업무 목록에 추가
    setAvailableTasks(prev => [newTask, ...prev]);
    
    // 자동으로 새 업무 선택
    setSelectedTaskIds(prev => [newTask.id, ...prev]);
    setFormData(prev => ({ 
      ...prev, 
      detailed_task_ids: [newTask.id, ...prev.detailed_task_ids] 
    }));
    
    // 모달 닫기
    setShowTaskModal(false);
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let reportId;
      
      // 상세 업무 ID 제외한 폼 데이터 준비
      const { detailed_task_ids, ...reportData } = formData;
      
      if (isEditMode) {
        await weeklyReportAPI.updateWeeklyReport(editingReport.id, reportData);
        reportId = editingReport.id;
      } else {
        const response = await weeklyReportAPI.createWeeklyReport(reportData);
        reportId = response.data.id;
      }
      
      // 상세 업무 연결 (선택된 업무가 있는 경우)
      if (selectedTaskIds.length > 0) {
        await detailedTaskAPI.linkTasksToWeeklyReport(reportId, selectedTaskIds);
      }
      
      onSave();
    } catch (err) {
      // 에러 메시지 안전하게 처리
      let errorMessage = '저장 중 오류가 발생했습니다.';
      
      if (err.response?.data?.detail) {
        // detail이 문자열이 아닌 경우 안전하게 처리
        if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else if (typeof err.response.data.detail === 'object') {
          errorMessage = JSON.stringify(err.response.data.detail);
        }
      }
      
      setError(errorMessage);
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 주차 옵션 생성 (메모이제이션으로 최적화)
  const weekOptions = useMemo(() => {
    const currentWeek = utilsAPI.getCurrentWeek();
    const recentWeeks = utilsAPI.getRecentWeeks();
    const currentYear = new Date().getFullYear();
    const yearWeeks = utilsAPI.getYearWeeks(currentYear);
    
    // 중복 제거 및 정렬
    const allWeeks = [...new Set([...recentWeeks, ...yearWeeks])].sort().reverse();
    
    return allWeeks.map(week => ({
      value: week,
      label: week === currentWeek ? `${week} (현재)` : week,
      isCurrent: week === currentWeek
    }));
  }, []); // 컴포넌트 마운트 시 한 번만 계산

  // 컴포넌트 언마운트 시 cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 WeeklyReportForm cleanup'); // 디버깅용 로그
      // 필요한 경우 여기에 cleanup 로직 추가
    };
  }, []);

  return (
    <div className={fullscreen ? 'space-y-6' : 'card'}>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`${fullscreen ? 'text-2xl' : 'text-xl'} font-bold text-gray-900`}>
          {isEditMode ? '주차별 보고서 수정' : '새 주차별 보고서'}
          {fullscreen && (
            <span className="text-sm font-normal text-purple-600 ml-3">
              📺 풀스크린 편집 모드
            </span>
          )}
        </h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            title={fullscreen ? '풀스크린 모드 종료' : '편집 취소'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 프로젝트 선택 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 프로젝트 선택 방식 */}
          <div className="md:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                프로젝트 선택 방식
              </label>
              <button
                type="button"
                onClick={isNewProject ? toggleProjectMode : handleOpenProjectModal}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {isNewProject ? '기존 프로젝트 선택' : '신규 프로젝트 추가'}
              </button>
            </div>
            
            {isNewProject ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  신규 프로젝트명 *
                </label>
                <input
                  type="text"
                  name="project"
                  required
                  value={formData.project}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="새 프로젝트명을 입력하세요"
                />
                <p className="text-sm text-gray-500 mt-1">
                  💡 새로운 프로젝트명을 입력하면 자동으로 프로젝트 목록에 추가됩니다.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  기존 프로젝트 선택 *
                </label>
                <select
                  name="project"
                  required
                  value={formData.project}
                  onChange={handleProjectChange}
                  className="form-select"
                >
                  <option value="">프로젝트를 선택하세요</option>
                  {projectNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="__NEW_PROJECT__" className="text-blue-600 font-medium">
                    + 신규 프로젝트 추가
                  </option>
                </select>
                {projectNames.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    등록된 프로젝트가 없습니다. 신규 프로젝트를 추가해주세요.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 주차 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                주차 *
              </label>
              <button
                type="button"
                onClick={setCurrentWeek}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                현재
              </button>
            </div>
            <select
              name="week"
              required
              value={formData.week}
              onChange={handleChange}
              className="form-select"
            >
              <option value="">주차를 선택하세요</option>
              {weekOptions.map(({ value, label, isCurrent }) => (
                <option
                  key={value}
                  value={value}
                  className={isCurrent ? 'font-medium bg-blue-50' : ''}
                >
                  {label}
                </option>
              ))}
            </select>
            {formData.week && (
              <p className="text-sm text-gray-500 mt-1">
                📅 {utilsAPI.formatWeekDisplay(formData.week)}
              </p>
            )}
          </div>

          {/* 단계 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              단계/단위 *
            </label>
            <input
              type="text"
              name="stage"
              required
              value={formData.stage}
              onChange={handleChange}
              className="form-input"
              placeholder="예: 설계, 개발, 테스트, 배포"
            />
          </div>

          {/* 빈 공간 */}
          <div></div>
        </div>

        {/* 작업 내용 */}
        <div className={`${fullscreen ? 'grid grid-cols-1 xl:grid-cols-2 gap-8' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}`}>
          {/* 이번 주 한 일 */}
          <div>
            <MarkdownEditor
              label="이번 주 한 일"
              required
              value={formData.this_week_work}
              onChange={(value) => setFormData(prev => ({ ...prev, this_week_work: value }))}
              placeholder="이번 주에 수행한 작업을 구체적으로 작성해주세요.

📝 마크다운 문법 예시:
## 주요 성과
- 기능 A 개발 완료
- **중요**: 성능 20% 향상
- `코드 리팩토링` 진행

## 상세 내용
1. 첫 번째 작업
2. 두 번째 작업
3. 세 번째 작업"
              rows={fullscreen ? 16 : 8}
            />
          </div>

          {/* 다음 주 계획 */}
          <div>
            <MarkdownEditor
              label="다음 주 계획"
              value={formData.next_week_plan}
              onChange={(value) => setFormData(prev => ({ ...prev, next_week_plan: value }))}
              placeholder="다음 주에 수행할 작업 계획을 작성해주세요.

📝 마크다운 문법 예시:
## 계획된 작업
- [ ] 기능 B 설계
- [ ] **우선순위 높음**: API 개발
- [ ] `테스트 케이스` 작성

## 목표
1. 품질 개선
2. 일정 준수
3. 팀 협업 강화"
              rows={fullscreen ? 16 : 8}
            />
          </div>
        </div>

        {/* 연관 상세 업무 선택 */}
        {formData.project && (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                📋 연관 상세 업무 선택
              </label>
              <div className="flex items-center space-x-2">
                {availableTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllTasks}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {selectedTaskIds.length === availableTasks.length ? '전체 해제' : '전체 선택'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowTaskModal(true)}
                  className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium flex items-center space-x-1"
                  title="새 상세 업무 추가"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>추가</span>
                </button>
              </div>
            </div>
            
            {tasksLoading ? (
              <div className="flex justify-center items-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-sm text-gray-600">상세 업무 목록 로딩 중...</span>
              </div>
            ) : availableTasks.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableTasks.map(task => (
                  <div
                    key={task.id}
                    className={`flex items-start space-x-3 p-3 rounded border cursor-pointer transition-colors ${
                      selectedTaskIds.includes(task.id)
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => handleTaskSelection(task.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(task.id)}
                      onChange={() => handleTaskSelection(task.id)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {task.task_item}
                        </h4>
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          task.current_status === 'completed' ? 'bg-green-100 text-green-700' :
                          task.current_status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          task.current_status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' :
                          task.current_status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {task.current_status === 'not_started' ? '시작안함' :
                           task.current_status === 'in_progress' ? '진행중' :
                           task.current_status === 'completed' ? '완료' :
                           task.current_status === 'on_hold' ? '보류' :
                           task.current_status === 'cancelled' ? '취소' : task.current_status}
                        </span>
                        {task.has_risk && (
                          <span className="text-red-500 text-xs">⚠️</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        {task.assignee && (
                          <span className="text-xs text-gray-600">
                            👤 {task.assignee}
                          </span>
                        )}
                        {task.progress_rate !== undefined && (
                          <span className="text-xs text-gray-600">
                            📊 {task.progress_rate}%
                          </span>
                        )}
                        {task.planned_end_date && (
                          <span className="text-xs text-gray-600">
                            📅 {task.planned_end_date}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <div className="text-sm">
                  {formData.project ? 
                    `'${formData.project}' 프로젝트에 등록된 상세 업무가 없습니다.` :
                    '프로젝트를 선택하면 상세 업무 목록을 확인할 수 있습니다.'
                  }
                </div>
                <div className="text-xs mt-1 text-blue-600">
                  상세 업무 시트에서 새로운 업무를 추가할 수 있습니다.
                </div>
              </div>
            )}
            
            {selectedTaskIds.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                <div className="text-sm text-blue-800">
                  ✅ {selectedTaskIds.length}개의 상세 업무가 이 보고서와 연결됩니다.
                </div>
              </div>
            )}
          </div>
        )}

        {/* 이슈/리스크 */}
        <div>
          <MarkdownEditor
            label="이슈/리스크"
            value={formData.issues_risks}
            onChange={(value) => setFormData(prev => ({ ...prev, issues_risks: value }))}
            placeholder="현재 직면한 이슈나 향후 예상되는 리스크를 작성해주세요.

📝 마크다운 문법 예시:
## 🚨 현재 이슈
- **긴급**: 외부 API 응답 지연 (평균 5초)
- 데이터베이스 성능 저하
- `SSL 인증서` 만료 예정

## ⚠️ 예상 리스크 
1. 리소스 부족으로 인한 일정 지연
2. 기술적 의존성 문제
3. 외부 서비스 변경 영향

## 💡 대응 방안
- [ ] 백업 API 준비
- [ ] 성능 모니터링 강화
- [ ] 리스크 회피 계획 수립"
            rows={fullscreen ? 14 : 6}
          />
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              disabled={loading}
            >
              취소
            </button>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                저장 중...
              </div>
            ) : (
              isEditMode ? '수정 완료' : '보고서 저장'
            )}
          </button>
        </div>
      </form>

      {/* 상세 업무 추가 모달 */}
      <DetailedTaskFormModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSave={handleNewTaskSaved}
        defaultProject={formData.project}
        defaultStage={formData.stage}
      />

      {/* 프로젝트 추가 모달 */}
      <ProjectFormModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        onSuccess={handleProjectCreated}
        title="신규 프로젝트 추가"
      />
    </div>
  );
};

export default WeeklyReportForm; 