import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { detailedTaskAPI, projectAPI } from '../services/api';
import DetailedTaskFormModal from './DetailedTaskFormModal';
import DetailedTaskUploadModal from './DetailedTaskUploadModal';

const DetailedTaskSheet = () => {
  // 상태 관리
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    project: '',
    assignee: '',
    current_status: '',
    has_risk: null
  });

  // 테이블 설정 상태
  const [tableWidth, setTableWidth] = useState(95);
  const [columnWidths, setColumnWidths] = useState({
    project: 120,
    stage: 100,
    task_item: 200,
    assignee: 100,
    current_status: 120,
    has_risk: 80,
    description: 200,
    planned_end_date: 130,
    actual_end_date: 130,
    progress_rate: 100,
    linked_reports: 180  // 연결된 보고서 컬럼 추가
  });

  // 편집 상태
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [saving, setSaving] = useState(false);

  // 텍스트 펼침/접기 상태
  const [expandedText, setExpandedText] = useState({});
  
  // 모달 상태
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // 상태 옵션들
  const statusOptions = [
    { value: 'not_started', label: '시작안함', color: 'bg-gray-200 text-gray-700' },
    { value: 'in_progress', label: '진행중', color: 'bg-blue-200 text-blue-700' },
    { value: 'completed', label: '완료', color: 'bg-green-200 text-green-700' },
    { value: 'on_hold', label: '보류', color: 'bg-yellow-200 text-yellow-700' },
    { value: 'cancelled', label: '취소', color: 'bg-red-200 text-red-700' }
  ];

  // 데이터 로딩
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await detailedTaskAPI.getAllDetailedTasks(filters);
      const tasksWithReports = await Promise.all(
        response.data.map(async (task) => {
          try {
            const reportsResponse = await detailedTaskAPI.getTaskWeeklyReports(task.id);
            return {
              ...task,
              linkedReports: reportsResponse.data
            };
          } catch (err) {
            console.error(`Error loading reports for task ${task.id}:`, err);
            return {
              ...task,
              linkedReports: []
            };
          }
        })
      );
      setTasks(tasksWithReports);
    } catch (err) {
      setError('상세 업무 목록을 불러오는데 실패했습니다.');
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // 프로젝트 목록 로딩
  const loadProjects = useCallback(async () => {
    try {
      const response = await projectAPI.getProjectNames();
      setProjects(response.data);
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadProjects();
  }, [loadTasks, loadProjects]);

  // 새 상세 업무 추가 모달 열기
  const openNewTaskModal = () => {
    setEditingTask(null);
    setShowFormModal(true);
  };

  // 업무 편집 모달 열기
  const openEditTaskModal = (task) => {
    setEditingTask(task);
    setShowFormModal(true);
  };

  // 모달 닫기
  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingTask(null);
  };

  // 모달에서 업무 저장 성공 시
  const handleFormSuccess = () => {
    loadTasks();
    closeFormModal();
  };

  // 파일 업로드 모달 열기
  const openUploadModal = () => {
    setShowUploadModal(true);
  };

  // 파일 업로드 모달 닫기
  const closeUploadModal = () => {
    setShowUploadModal(false);
  };

  // 파일 업로드 성공 시
  const handleUploadSuccess = () => {
    loadTasks(); // 업무 목록 새로고침
    closeUploadModal();
  };

  // 셀 편집 시작
  const startEditing = (taskId, field, currentValue) => {
    setEditingCell({ taskId, field });
    setEditingValue(currentValue || '');
  };

  // 편집 취소
  const cancelEditing = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  // 편집 저장
  const saveEdit = async () => {
    if (!editingCell) return;

    setSaving(true);
    try {
      const updateData = { [editingCell.field]: editingValue };
      
      // 불린 값 처리
      if (editingCell.field === 'has_risk') {
        updateData[editingCell.field] = editingValue === 'true' || editingValue === true;
      }
      
      // 숫자 값 처리
      if (editingCell.field === 'progress_rate') {
        const numValue = parseFloat(editingValue);
        updateData[editingCell.field] = isNaN(numValue) ? 0 : Math.max(0, Math.min(100, numValue));
      }

      await detailedTaskAPI.updateDetailedTask(editingCell.taskId, updateData);
      
      // 로컬 상태 업데이트
      setTasks(prev => prev.map(task => 
        task.id === editingCell.taskId 
          ? { ...task, [editingCell.field]: updateData[editingCell.field] }
          : task
      ));

      setEditingCell(null);
      setEditingValue('');
    } catch (err) {
      setError('업데이트에 실패했습니다.');
      console.error('Error updating task:', err);
    } finally {
      setSaving(false);
    }
  };

  // 키보드 이벤트 처리
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  // 업무 삭제
  const deleteTask = async (taskId) => {
    if (!window.confirm('이 상세 업무를 삭제하시겠습니까?')) return;

    try {
      await detailedTaskAPI.deleteDetailedTask(taskId);
      setTasks(prev => prev.filter(task => task.id !== taskId));
    } catch (err) {
      setError('업무 삭제에 실패했습니다.');
      console.error('Error deleting task:', err);
    }
  };

  // 텍스트 펼침/접기 처리
  const toggleTextExpansion = useCallback((taskId, field) => {
    setExpandedText(prev => ({
      ...prev,
      [`${taskId}-${field}`]: !prev[`${taskId}-${field}`]
    }));
  }, []);

  // 펼침 가능한 텍스트 렌더링
  const renderExpandableText = useCallback((text, taskId, field, bgColor = 'bg-gray-50') => {
    if (!text || text.length <= 100) {
      return <span className="text-sm">{text || '-'}</span>;
    }

    const isExpanded = expandedText[`${taskId}-${field}`];
    const maxLength = Math.max(80, Math.min(200, Math.floor((columnWidths[field] || 150) / 8)));
    
    return (
      <div className="relative">
        <div className={`text-sm leading-relaxed transition-all duration-300 ${
          isExpanded ? 'max-h-none' : 'max-h-20 overflow-hidden'
        }`}>
          <span>{isExpanded ? text : `${text.substring(0, maxLength)}...`}</span>
          {!isExpanded && (
            <div className={`absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-${bgColor} to-transparent pointer-events-none`} />
          )}
        </div>
        <button
          onClick={() => toggleTextExpansion(taskId, field)}
          className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          {isExpanded ? '접기' : '더보기'} ({text.length}자)
        </button>
      </div>
    );
  }, [expandedText, columnWidths, toggleTextExpansion]);

  // 편집 가능한 셀 렌더링
  const renderEditableCell = useCallback((task, field, type = 'text') => {
    const isEditing = editingCell?.taskId === task.id && editingCell?.field === field;
    const value = task[field];

    if (isEditing) {
      if (field === 'has_risk') {
        return (
          <div className="flex items-center space-x-2">
            <select
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyPress}
              className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            >
              <option value="false">아니오</option>
              <option value="true">예</option>
            </select>
          </div>
        );
      }

      if (['previous_status', 'current_status'].includes(field)) {
        return (
          <div className="flex items-center space-x-2">
            <select
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyPress}
              className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        );
      }

      if (['requests', 'notes'].includes(field)) {
        return (
          <div className="relative">
            <textarea
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyPress}
              className="w-full px-2 py-1 border-2 border-blue-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end mt-1 space-x-2">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? '저장중...' : '저장'}
              </button>
              <button
                onClick={cancelEditing}
                className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
              >
                취소
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="relative">
          <input
            type={type}
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyPress}
            className="w-full px-2 py-1 border-2 border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {saving && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>
      );
    }

    // 일반 표시 모드
    let displayValue = value;
    let cellClass = "cursor-pointer hover:bg-blue-50 transition-colors group relative";

    if (field === 'has_risk') {
      displayValue = value ? '예' : '아니오';
      cellClass += value ? ' text-red-600 font-medium' : ' text-green-600';
    } else if (['previous_status', 'current_status'].includes(field)) {
      const statusOption = statusOptions.find(opt => opt.value === value);
      return (
        <div 
          className={`${cellClass} p-2`}
          onClick={() => startEditing(task.id, field, value)}
        >
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusOption?.color || 'bg-gray-200 text-gray-700'}`}>
            {statusOption?.label || value}
          </span>
          <span className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            ✏️
          </span>
        </div>
      );
    } else if (field === 'progress_rate') {
      return (
        <div 
          className={`${cellClass} p-2`}
          onClick={() => startEditing(task.id, field, value)}
        >
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}
              ></div>
            </div>
            <span className="text-xs font-medium min-w-[3rem] text-right">{value || 0}%</span>
          </div>
          <span className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            ✏️
          </span>
        </div>
      );
    } else if (['requests', 'notes'].includes(field)) {
      return (
        <div 
          className={`${cellClass} p-2`}
          onClick={() => startEditing(task.id, field, value)}
        >
          {renderExpandableText(value, task.id, field, field === 'requests' ? 'blue-50' : 'gray-50')}
          <span className="absolute right-2 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
            ✏️
          </span>
        </div>
      );
    } else if (field === 'linked_reports') {
      // 연결된 보고서 표시 (편집 불가)
      const linkedReports = task.linkedReports || [];
      return (
        <div className="p-2">
          {linkedReports.length > 0 ? (
            <div className="space-y-1">
              {linkedReports.slice(0, 3).map((report, index) => (
                <div key={report.id} className="flex items-center space-x-2">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span className="text-xs text-blue-700 font-medium">
                    {report.week}
                  </span>
                  <span className="text-xs text-gray-600">
                    {report.stage && `(${report.stage})`}
                  </span>
                </div>
              ))}
              {linkedReports.length > 3 && (
                <div className="text-xs text-gray-500">
                  +{linkedReports.length - 3}개 더
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">연결된 보고서 없음</span>
          )}
        </div>
      );
    }

    return (
      <div 
        className={`${cellClass} p-2`}
        onClick={() => startEditing(task.id, field, value)}
      >
        <span className="text-sm">{displayValue || '-'}</span>
        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          ✏️
        </span>
      </div>
    );
  }, [editingCell, editingValue, saving, handleKeyPress, saveEdit, cancelEditing, renderExpandableText, statusOptions]);

  // 컬럼 정의 (연결된 보고서 포함)
  const columns = [
    { key: 'project', title: '프로젝트', minWidth: 100, maxWidth: 200 },
    { key: 'stage', title: '단계', minWidth: 80, maxWidth: 150 },
    { key: 'task_item', title: '업무 항목', minWidth: 150, maxWidth: 300 },
    { key: 'assignee', title: '담당자', minWidth: 80, maxWidth: 150 },
    { key: 'current_status', title: '현재 상태', minWidth: 100, maxWidth: 150 },
    { key: 'has_risk', title: '리스크', minWidth: 60, maxWidth: 100 },
    { key: 'linked_reports', title: '연결된 보고서', minWidth: 160, maxWidth: 220 },
    { key: 'description', title: '설명/비고', minWidth: 150, maxWidth: 300 },
    { key: 'planned_end_date', title: '종료예정일', minWidth: 110, maxWidth: 140 },
    { key: 'actual_end_date', title: '실제완료일', minWidth: 110, maxWidth: 140 },
    { key: 'progress_rate', title: '진행률(%)', minWidth: 90, maxWidth: 120 }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">📋 상세 업무 시트</h2>
        <div className="flex space-x-3">
          <button
            onClick={openNewTaskModal}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center"
          >
            📋 새 업무 추가
          </button>
          <button
            onClick={openUploadModal}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center"
          >
            📤 파일 업로드
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">프로젝트</label>
          <select
            value={filters.project}
            onChange={(e) => setFilters(prev => ({ ...prev, project: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 프로젝트</option>
            {projects.map(project => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">담당자</label>
          <input
            type="text"
            value={filters.assignee}
            onChange={(e) => setFilters(prev => ({ ...prev, assignee: e.target.value }))}
            placeholder="담당자 검색"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">현재 상태</label>
          <select
            value={filters.current_status}
            onChange={(e) => setFilters(prev => ({ ...prev, current_status: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 상태</option>
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">리스크 여부</label>
          <select
            value={filters.has_risk === null ? '' : filters.has_risk.toString()}
            onChange={(e) => setFilters(prev => ({ 
              ...prev, 
              has_risk: e.target.value === '' ? null : e.target.value === 'true' 
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체</option>
            <option value="true">리스크 있음</option>
            <option value="false">리스크 없음</option>
          </select>
        </div>
      </div>

      {/* 테이블 설정 */}
      <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">테이블 너비:</span>
          <input
            type="range"
            min="80"
            max="100"
            value={tableWidth}
            onChange={(e) => setTableWidth(Number(e.target.value))}
            className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-gray-600 min-w-[3rem]">{tableWidth}%</span>
        </div>
        <div className="text-sm text-gray-600">
          총 {tasks.length}개 업무
        </div>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <div style={{ width: `${tableWidth}%` }}>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(column => (
                  <th
                    key={column.key}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
                    style={{ width: `${columnWidths[column.key]}px`, minWidth: `${column.minWidth}px` }}
                  >
                    {column.title}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-20">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  {columns.map(column => (
                    <td
                      key={column.key}
                      className="border-b border-gray-200"
                      style={{ width: `${columnWidths[column.key]}px` }}
                    >
                      {column.key === 'linked_reports' ? 
                        renderEditableCell(task, column.key, 'readonly') :
                        renderEditableCell(
                          task, 
                          column.key, 
                          ['planned_end_date', 'actual_end_date'].includes(column.key) ? 'date' :
                          column.key === 'progress_rate' ? 'number' : 'text'
                        )
                      }
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center border-b border-gray-200">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => openEditTaskModal(task)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="편집"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {tasks.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          조건에 맞는 상세 업무가 없습니다.
        </div>
      )}

      {/* 업무 추가/편집 모달 */}
      <DetailedTaskFormModal
        isOpen={showFormModal}
        onClose={closeFormModal}
        onSuccess={handleFormSuccess}
        initialData={editingTask}
      />

      {/* 파일 업로드 모달 */}
      <DetailedTaskUploadModal
        isOpen={showUploadModal}
        onClose={closeUploadModal}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
};

export default DetailedTaskSheet; 