import React, { useState, useEffect, useCallback } from 'react';
import { weeklyReportAPI, summaryAPI, utilsAPI, detailedTaskAPI } from '../services/api';
import WeeklyReportForm from './TaskForm';

const WeeklyReportList = ({ refreshTrigger, onReportChange }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingReport, setEditingReport] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'
  
  // 펼침/접기 상태 관리 (각 보고서별로 각 필드별로)
  const [expandedItems, setExpandedItems] = useState({});
  
  // 필터 상태
  const [filters, setFilters] = useState({
    project: '',
    week: '',
    stage: '',
    start_week: '',
    end_week: ''
  });
  
  // 필터 옵션들
  const [filterOptions, setFilterOptions] = useState({
    projects: [],
    weeks: [],
    stages: []
  });
  
  // 상세 업무 관련 상태
  const [detailedTasks, setDetailedTasks] = useState({}); // {reportId: [tasks]}
  const [selectedTasks, setSelectedTasks] = useState({}); // {reportId: [taskIds]}
  const [tasksLoading, setTasksLoading] = useState({}); // {reportId: boolean}
  const [expandedTaskSelectors, setExpandedTaskSelectors] = useState({}); // {reportId: boolean}

  // 주차별 보고서 목록 조회
  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await weeklyReportAPI.getAllWeeklyReports(filters);
      setReports(response.data);
      setError('');
    } catch (err) {
      setError('주차별 보고서 목록을 불러오는 중 오류가 발생했습니다.');
      console.error('Fetch reports error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 필터 옵션들 조회
  const fetchFilterOptions = async () => {
    try {
      const [projectsRes, weeksRes, stagesRes] = await Promise.all([
        summaryAPI.getProjects(),
        summaryAPI.getWeeks(),
        summaryAPI.getStages()
      ]);
      
      setFilterOptions({
        projects: projectsRes.data || [],
        weeks: weeksRes.data || [],
        stages: stagesRes.data || []
      });
    } catch (err) {
      console.error('Fetch filter options error:', err);
    }
  };

  useEffect(() => {
    fetchReports();
    fetchFilterOptions();
  }, [refreshTrigger]);

  useEffect(() => {
    fetchReports();
  }, [filters]);

  // 보고서 삭제
  const handleDelete = async (reportId) => {
    try {
      await weeklyReportAPI.deleteWeeklyReport(reportId);
      await fetchReports();
      onReportChange();
      setDeleteConfirm(null);
    } catch (err) {
      setError('주차별 보고서 삭제 중 오류가 발생했습니다.');
      console.error('Delete report error:', err);
    }
  };

  // 필터 변경 핸들러
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setFilters({
      project: '',
      week: '',
      stage: '',
      start_week: '',
      end_week: ''
    });
  };

  // 상세 업무 조회 (프로젝트+단계별)
  const fetchDetailedTasksForReport = useCallback(async (reportId, projectName, stage) => {
    if (!projectName) return;
    
    try {
      setTasksLoading(prev => ({ ...prev, [reportId]: true }));
      const response = await detailedTaskAPI.getDetailedTasksByProjectAndStage(projectName, stage);
      
      setDetailedTasks(prev => ({ 
        ...prev, 
        [reportId]: response.data || [] 
      }));
      
      // 이미 연결된 업무들 조회
      const linkedResponse = await detailedTaskAPI.getLinkedTasks(reportId);
      const linkedTaskIds = linkedResponse.data.map(task => task.id);
      
      setSelectedTasks(prev => ({ 
        ...prev, 
        [reportId]: linkedTaskIds 
      }));
      
    } catch (err) {
      console.error('Fetch detailed tasks error:', err);
      setDetailedTasks(prev => ({ ...prev, [reportId]: [] }));
      setSelectedTasks(prev => ({ ...prev, [reportId]: [] }));
    } finally {
      setTasksLoading(prev => ({ ...prev, [reportId]: false }));
    }
  }, []);

  // 상세 업무 선택 토글
  const handleTaskSelection = useCallback(async (reportId, taskId, isSelected) => {
    const currentTasks = selectedTasks[reportId] || [];
    const updatedTasks = isSelected 
      ? [...currentTasks, taskId]
      : currentTasks.filter(id => id !== taskId);
    
    try {
      // 서버에 업데이트
      await detailedTaskAPI.linkTasksToWeeklyReport(reportId, updatedTasks);
      
      // 로컬 상태 업데이트
      setSelectedTasks(prev => ({ 
        ...prev, 
        [reportId]: updatedTasks 
      }));
      
    } catch (err) {
      console.error('Update task selection error:', err);
      
      // 사용자 친화적인 오류 메시지 표시 (부모 컴포넌트 또는 toast 알림 사용)
      const errorMessage = err.response?.data?.detail || '상세 업무 연결 중 오류가 발생했습니다.';
      
      // 간단한 alert로 오류 알림 (향후 toast 라이브러리로 대체 가능)
      alert(`❌ ${errorMessage}`);
    }
  }, [selectedTasks]);

  // 업무 선택기 확장/축소
  const toggleTaskSelector = useCallback((reportId, projectName, stage) => {
    const isExpanded = expandedTaskSelectors[reportId];
    
    if (!isExpanded) {
      // 확장할 때만 데이터 로드
      fetchDetailedTasksForReport(reportId, projectName, stage);
    }
    
    setExpandedTaskSelectors(prev => ({ 
      ...prev, 
      [reportId]: !isExpanded 
    }));
  }, [expandedTaskSelectors, fetchDetailedTasksForReport]);

  // 텍스트 줄여서 표시
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // 상세 업무 Multi-select 렌더링
  const renderDetailedTaskSelector = (report) => {
    const reportTasks = detailedTasks[report.id] || [];
    const selectedTaskIds = selectedTasks[report.id] || [];
    const isExpanded = expandedTaskSelectors[report.id] || false;
    const isLoading = tasksLoading[report.id] || false;

    const getStatusColor = (status) => {
      const colors = {
        not_started: 'bg-gray-100 text-gray-800',
        in_progress: 'bg-blue-100 text-blue-800',
        completed: 'bg-green-100 text-green-800',
        on_hold: 'bg-yellow-100 text-yellow-800',
        cancelled: 'bg-red-100 text-red-800',
      };
      return colors[status] || colors.not_started;
    };

    const getStatusText = (status) => {
      const statusMap = {
        not_started: '시작전',
        in_progress: '진행중',
        completed: '완료',
        on_hold: '보류',
        cancelled: '취소',
      };
      return statusMap[status] || '시작전';
    };

    return (
      <div className="w-full">
        {/* 토글 버튼 */}
        <button
          onClick={() => toggleTaskSelector(report.id, report.project, report.stage)}
          className="w-full flex items-center justify-between p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors"
          disabled={!report.project}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {isExpanded ? '🔽' : '▶️'} 관련 업무
            </span>
            {selectedTaskIds.length > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                {selectedTaskIds.length}개 선택
              </span>
            )}
          </div>
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
        </button>

        {/* 업무 목록 */}
        {isExpanded && (
          <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg bg-white">
            {reportTasks.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                {report.project ? '해당 프로젝트에 상세 업무가 없습니다.' : '프로젝트를 먼저 선택해주세요.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {reportTasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(task.id)}
                      onChange={(e) => handleTaskSelection(report.id, task.id, e.target.checked)}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {task.task_item}
                        </span>
                        {task.stage && (
                          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                            {task.stage}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.current_status)}`}>
                          {getStatusText(task.current_status)}
                        </span>
                        {task.has_risk && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                            🚨 리스크
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {task.assignee && (
                          <span>👤 {task.assignee}</span>
                        )}
                        <span>📊 {task.progress_rate}%</span>
                        {task.planned_end_date && (
                          <span>📅 {task.planned_end_date}</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 마크다운 스타일 텍스트를 간단한 HTML로 변환
  const renderSimpleMarkdown = (text, maxLength = null) => {
    if (!text) return '';
    const processedText = maxLength ? truncateText(text, maxLength) : text;
    return processedText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '• $1')
      .replace(/^\* (.+)$/gm, '• $1')
      .replace(/\n/g, '<br/>');
  };

  // 인라인 편집 핸들러
  const handleInlineEdit = (report) => {
    setEditingReport(report);
  };

  // 펼침/접기 토글 함수
  const toggleExpanded = (reportId, field) => {
    const key = `${reportId}-${field}`;
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // 텍스트가 잘렸는지 확인하는 함수
  const isTextTruncated = (text, maxLength) => {
    return text && text.length > maxLength;
  };

  // 펼침 가능한 텍스트 렌더링 컴포넌트
  const ExpandableText = ({ text, maxLength, reportId, field, className = "", isMarkdown = false, bgColor = "white" }) => {
    if (!text) return null;
    
    const key = `${reportId}-${field}`;
    const isExpanded = expandedItems[key];
    const isTruncated = isTextTruncated(text, maxLength);
    
    const displayText = !isTruncated || isExpanded ? text : text.substring(0, maxLength);
    const renderedText = isMarkdown ? renderSimpleMarkdown(displayText) : displayText;
    
    // 배경색에 따른 그라데이션 설정
    const getGradientClass = () => {
      switch(bgColor) {
        case 'gray': return 'from-gray-50 to-transparent';
        case 'blue': return 'from-blue-50 to-transparent';
        case 'red': return 'from-red-50 to-transparent';
        default: return 'from-white to-transparent';
      }
    };
    
    return (
      <div className={`relative ${className}`}>
        <div 
          className={`text-sm transition-all duration-300 ease-in-out ${
            isExpanded ? 'max-h-none' : 'overflow-hidden'
          }`}
          style={{
            maxHeight: isExpanded ? 'none' : isTruncated ? '4.5rem' : 'auto'
          }}
          dangerouslySetInnerHTML={isMarkdown ? { __html: renderedText } : undefined}
        >
          {!isMarkdown && displayText}
        </div>
        
        {/* 그라데이션 페이드 효과 (접혀있을 때만) */}
        {isTruncated && !isExpanded && (
          <div className={`absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t ${getGradientClass()} pointer-events-none`} />
        )}
        
        {isTruncated && (
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-100">
            <button
              onClick={() => toggleExpanded(reportId, field)}
              className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium transition-all duration-200 hover:bg-blue-50 px-2 py-1 rounded"
            >
              {isExpanded ? (
                <>
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  접기
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  더보기
                </>
              )}
            </button>
            
            <div className="text-xs text-gray-400">
              {isExpanded ? `전체 ${text.length}자` : `+${text.length - maxLength}자 더`}
            </div>
          </div>
        )}
        
        {!isTruncated && (
          <div className="text-xs text-gray-400 mt-1 text-right">
            {text.length}자
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 편집 폼 (편집 모드일 때만 표시) */}
      {editingReport && (
        <WeeklyReportForm
          editingReport={editingReport}
          onReportChange={() => {
            onReportChange();
            setEditingReport(null);
          }}
          onCancelEdit={() => setEditingReport(null)}
        />
      )}

      {/* 필터 및 뷰 컨트롤 섹션 */}
      <div className="card">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">필터 및 보기 설정</h3>
          
          {/* 뷰 모드 전환 버튼 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0V4a1 1 0 011-1h16a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
              </svg>
              테이블 뷰
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'card'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              카드 뷰
            </button>
          </div>
        </div>
        
        {/* 필터 옵션 */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">프로젝트</label>
            <select
              value={filters.project}
              onChange={(e) => handleFilterChange('project', e.target.value)}
              className="form-select text-sm"
            >
              <option value="">전체</option>
              {filterOptions.projects.map(project => (
                <option key={typeof project === 'string' ? project : project.name} value={typeof project === 'string' ? project : project.name}>
                  {typeof project === 'string' ? project : project.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주차</label>
            <select
              value={filters.week}
              onChange={(e) => handleFilterChange('week', e.target.value)}
              className="form-select text-sm"
            >
              <option value="">전체</option>
              {filterOptions.weeks.map(week => (
                <option key={week} value={week}>{week}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">단계</label>
            <select
              value={filters.stage}
              onChange={(e) => handleFilterChange('stage', e.target.value)}
              className="form-select text-sm"
            >
              <option value="">전체</option>
              {filterOptions.stages.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작 주차</label>
            <input
              type="text"
              value={filters.start_week}
              onChange={(e) => handleFilterChange('start_week', e.target.value)}
              className="form-input text-sm"
              placeholder="2024-W01"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료 주차</label>
            <input
              type="text"
              value={filters.end_week}
              onChange={(e) => handleFilterChange('end_week', e.target.value)}
              className="form-input text-sm"
              placeholder="2024-W12"
            />
          </div>
        </div>
        
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            필터 초기화
          </button>
          
          <div className="text-sm text-gray-600">
            총 <span className="font-semibold text-gray-900">{reports.length}</span>개 보고서
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 주차별 보고서 목록 */}
      {reports.length === 0 ? (
        <div className="card">
          <div className="text-center py-12 text-gray-500">
            {Object.values(filters).some(f => f) ? '필터 조건에 맞는 보고서가 없습니다.' : '등록된 주차별 보고서가 없습니다.'}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              주차별 보고서 목록
            </h2>
          </div>

          {/* 테이블 뷰 */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주차</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">프로젝트</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">단계</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-96">이번 주 한 일</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">다음 주 계획</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">이슈/리스크</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">상세업무리스트</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수정일</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-blue-600">{report.week}</span>
                          <span className="text-xs text-gray-500">
                            {utilsAPI.getWeekDateRange(report.week)?.startString}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="text-sm font-medium text-gray-900 break-words max-w-32">
                          {report.project}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {report.stage}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <ExpandableText
                          text={report.this_week_work}
                          maxLength={200}
                          reportId={report.id}
                          field="this_week_work"
                          className="text-gray-900 max-w-96"
                          isMarkdown={true}
                        />
                      </td>
                      <td className="px-3 py-4">
                        {report.next_week_plan && (
                          <ExpandableText
                            text={report.next_week_plan}
                            maxLength={150}
                            reportId={report.id}
                            field="next_week_plan"
                            className="text-gray-700 max-w-64"
                            isMarkdown={true}
                          />
                        )}
                      </td>
                      <td className="px-3 py-4">
                        {report.issues_risks && (
                          <ExpandableText
                            text={report.issues_risks}
                            maxLength={150}
                            reportId={report.id}
                            field="issues_risks"
                            className="text-red-700 max-w-64"
                            isMarkdown={true}
                          />
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <div className="bg-purple-50 p-2 rounded-lg max-w-64">
                          {renderDetailedTaskSelector(report)}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(report.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleInlineEdit(report)}
                            className="text-blue-600 hover:text-blue-900"
                            title="수정"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(report.id)}
                            className="text-red-600 hover:text-red-900"
                            title="삭제"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 카드 뷰 */}
          {viewMode === 'card' && (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          {report.week}
                        </span>
                        <span className="font-semibold text-lg text-gray-900">
                          {report.project}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
                          {report.stage}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({utilsAPI.formatWeekDisplay(report.week)})
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleInlineEdit(report)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(report.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {/* 이번 주 한 일 & 다음 주 계획 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        📋 이번 주 한 일
                      </h4>
                      <div className="bg-gray-50 p-3 rounded">
                        <ExpandableText
                          text={report.this_week_work}
                          maxLength={400}
                          reportId={report.id}
                          field="this_week_work_card"
                          className="text-gray-700"
                          isMarkdown={true}
                          bgColor="gray"
                        />
                      </div>
                    </div>

                    {report.next_week_plan && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          📅 다음 주 계획
                        </h4>
                        <div className="bg-blue-50 p-3 rounded">
                          <ExpandableText
                            text={report.next_week_plan}
                            maxLength={300}
                            reportId={report.id}
                            field="next_week_plan_card"
                            className="text-gray-700"
                            isMarkdown={true}
                            bgColor="blue"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 이슈/리스크 */}
                  {report.issues_risks && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">
                        ⚠️ 이슈/리스크
                      </h4>
                      <div className="bg-red-50 p-3 rounded">
                        <ExpandableText
                          text={report.issues_risks}
                          maxLength={300}
                          reportId={report.id}
                          field="issues_risks_card"
                          className="text-red-700"
                          isMarkdown={true}
                          bgColor="red"
                        />
                      </div>
                    </div>
                  )}

                  {/* 메타 정보 */}
                  <div className="text-xs text-gray-500 pt-3 border-t border-gray-100 mt-4">
                    생성일: {new Date(report.created_at).toLocaleDateString()} 
                    {report.updated_at !== report.created_at && (
                      <span className="ml-4">
                        수정일: {new Date(report.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              주차별 보고서 삭제 확인
            </h3>
            <p className="text-gray-600 mb-4">
              이 보고서를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
              >
                삭제
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-md transition duration-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyReportList; 