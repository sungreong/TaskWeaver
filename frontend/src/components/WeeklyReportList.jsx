import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { weeklyReportAPI, summaryAPI, utilsAPI, detailedTaskAPI } from '../services/api';

const WeeklyReportList = ({ refreshTrigger, onEdit, projectFilter, fullscreen = false }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'
  
  // 텍스트 펼침/접기 상태 관리
  const [expandedTexts, setExpandedTexts] = useState({});
  
  // 테이블 너비 조절 상태 (80% ~ 100%)
  const [tableWidth, setTableWidth] = useState(100);
  
  // 컬럼 너비 관리 (엑셀 스타일 리사이징)
  const [columnWidths, setColumnWidths] = useState({
    week: 120,
    project: 160,
    stage: 120,
    thisWeek: 400,
    nextWeek: 400,
    issues: 200,
    detailedTasks: 300, // 관련 상세 업무 컬럼
    updated: 100,
    actions: 100
  });
  
  // 드래그 상태 관리
  const [dragState, setDragState] = useState({
    isDragging: false,
    dragColumn: null,
    startX: 0,
    startWidth: 0
  });
  
  // 인라인 편집 상태 관리
  const [editingCell, setEditingCell] = useState(null); // {reportId, fieldType}
  const [editingValue, setEditingValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // 마크다운 편집 모드 상태 관리
  const [previewMode, setPreviewMode] = useState({}); // {reportId_fieldType: boolean}
  const textareaRef = useRef(null);
  
  // 필터 상태
  const [filters, setFilters] = useState({
    project: projectFilter || '',
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
  const fetchReports = useCallback(async () => {
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
  }, [filters]);

  // 필터 옵션들 조회
  const fetchFilterOptions = useCallback(async () => {
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
  }, []);

  // projectFilter 변경 시 자동 적용
  useEffect(() => {
    if (projectFilter) {
      setFilters(prev => ({
        ...prev,
        project: projectFilter
      }));
    }
  }, [projectFilter]);

  useEffect(() => {
    fetchReports();
    fetchFilterOptions();
  }, [refreshTrigger, fetchReports, fetchFilterOptions]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // 보고서 삭제
  const handleDelete = async (reportId) => {
    try {
      await weeklyReportAPI.deleteWeeklyReport(reportId);
      await fetchReports();
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
      project: projectFilter || '', // projectFilter가 있으면 유지
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
      
      // 백엔드 응답 구조 변환: {stages: {...}} -> 평평한 배열
      let tasksArray = [];
      if (response.data && response.data.stages) {
        // 모든 단계의 업무를 하나의 배열로 병합
        tasksArray = Object.values(response.data.stages).flat();
      } else if (Array.isArray(response.data)) {
        // 이전 형태와 호환성 유지
        tasksArray = response.data;
      }
      
      setDetailedTasks(prev => ({ 
        ...prev, 
        [reportId]: tasksArray 
      }));
      
      // 이미 연결된 업무들 조회
      const linkedResponse = await detailedTaskAPI.getLinkedTasks(reportId);
      const linkedTaskIds = Array.isArray(linkedResponse.data) 
        ? linkedResponse.data.map(task => task.id)
        : [];
      
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
      
      // 사용자 친화적인 오류 메시지 표시
      const errorMessage = err.response?.data?.detail || '상세 업무 연결 중 오류가 발생했습니다.';
      setError(errorMessage);
      
      // 3초 후 오류 메시지 자동 제거
      setTimeout(() => setError(null), 3000);
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

  // 컬럼 리사이징 이벤트 핸들러들
  const handleMouseDown = useCallback((e, columnKey) => {
    e.preventDefault();
    setDragState({
      isDragging: true,
      dragColumn: columnKey,
      startX: e.clientX,
      startWidth: columnWidths[columnKey]
    });
  }, [columnWidths]);

  const handleMouseMove = useCallback((e) => {
    if (!dragState.isDragging || !dragState.dragColumn) return;
    
    const deltaX = e.clientX - dragState.startX;
    const newWidth = Math.max(80, Math.min(600, dragState.startWidth + deltaX)); // 최소 80px, 최대 600px
    
    setColumnWidths(prev => ({
      ...prev,
      [dragState.dragColumn]: newWidth
    }));
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      dragColumn: null,
      startX: 0,
      startWidth: 0
    });
  }, []);

  // 자동 너비 조절 (더블클릭)
  const handleDoubleClick = useCallback((columnKey) => {
    const autoWidths = {
      week: 120,
      project: 160,
      stage: 120,
      thisWeek: 400,
      nextWeek: 400,
      issues: 200,
      detailedTasks: 300,
      updated: 100,
      actions: 100
    };
    
    setColumnWidths(prev => ({
      ...prev,
      [columnKey]: autoWidths[columnKey]
    }));
  }, []);

  // 드래그 이벤트 리스너 등록
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  // 인라인 편집 핸들러들 (먼저 선언)
  const startEditing = useCallback((reportId, fieldType, currentValue) => {
    setEditingCell({ reportId, fieldType });
    setEditingValue(currentValue || '');
    // 프리뷰 모드 초기화
    const key = `${reportId}_${fieldType}`;
    setPreviewMode(prev => ({ ...prev, [key]: false }));
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingCell(null);
    setEditingValue('');
    setIsUpdating(false);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingCell || isUpdating) return;

    try {
      setIsUpdating(true);
      
      // 현재 보고서 찾기
      const currentReport = reports.find(r => r.id === editingCell.reportId);
      if (!currentReport) return;

      // 업데이트할 데이터 준비
      const updateData = {
        ...currentReport,
        [editingCell.fieldType]: editingValue
      };

      // API 호출
      await weeklyReportAPI.updateWeeklyReport(editingCell.reportId, updateData);
      
      // 목록 새로고침
      await fetchReports();
      
      // 편집 모드 종료
      setEditingCell(null);
      setEditingValue('');
      
    } catch (err) {
      console.error('Save edit error:', err);
      setError('수정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsUpdating(false);
    }
  }, [editingCell, editingValue, isUpdating, reports, fetchReports]);

  const togglePreviewMode = useCallback((reportId, fieldType) => {
    const key = `${reportId}_${fieldType}`;
    setPreviewMode(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  // 고급 텍스트 에디터 기능들
  const insertTabAtCursor = useCallback((textarea, isShiftTab = false) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const lines = value.split('\n');
    
    // 현재 커서가 있는 라인들 찾기
    let currentPos = 0;
    let startLine = 0;
    let endLine = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1; // +1 for \n
      if (currentPos <= start && start <= currentPos + lineLength - 1) {
        startLine = i;
      }
      if (currentPos <= end && end <= currentPos + lineLength - 1) {
        endLine = i;
      }
      currentPos += lineLength;
    }
    
    const tabSize = 2; // 2 스페이스 들여쓰기
    const tabString = ' '.repeat(tabSize);
    
    if (isShiftTab) {
      // Shift+Tab: 내어쓰기
      for (let i = startLine; i <= endLine; i++) {
        if (lines[i].startsWith(tabString)) {
          lines[i] = lines[i].substring(tabSize);
        } else if (lines[i].startsWith(' ')) {
          lines[i] = lines[i].substring(1);
        }
      }
    } else {
      // Tab: 들여쓰기
      for (let i = startLine; i <= endLine; i++) {
        lines[i] = tabString + lines[i];
      }
    }
    
    const newValue = lines.join('\n');
    const newStart = start + (isShiftTab ? -Math.min(tabSize, value.substring(start - tabSize, start).length) : tabSize);
    const newEnd = end + (endLine - startLine + 1) * (isShiftTab ? -tabSize : tabSize);
    
    return {
      value: newValue,
      selectionStart: Math.max(0, newStart),
      selectionEnd: Math.max(0, newEnd)
    };
  }, []);

  const handleAdvancedKeyDown = useCallback((e) => {
    const textarea = e.target;
    
    if (e.key === 'Tab') {
      e.preventDefault();
      const result = insertTabAtCursor(textarea, e.shiftKey);
      setEditingValue(result.value);
      
      // 커서 위치 복원 (다음 렌더링 후)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = result.selectionStart;
          textareaRef.current.selectionEnd = result.selectionEnd;
        }
      }, 0);
    } else if (e.key === 'Enter' && !e.ctrlKey) {
      // 자동 들여쓰기
      e.preventDefault();
      const start = textarea.selectionStart;
      const value = textarea.value;
      const lines = value.substring(0, start).split('\n');
      const currentLine = lines[lines.length - 1];
      
      // 현재 라인의 들여쓰기 감지
      const indentMatch = currentLine.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      
      // 리스트 아이템 자동 완성
      let autoComplete = '';
      if (currentLine.trim().match(/^[-*+]\s/)) {
        autoComplete = currentLine.match(/^(\s*[-*+]\s)/)[1];
      } else if (currentLine.trim().match(/^\d+\.\s/)) {
        const numberMatch = currentLine.match(/^(\s*)(\d+)(\.\s)/);
        if (numberMatch) {
          const nextNumber = parseInt(numberMatch[2]) + 1;
          autoComplete = `${numberMatch[1]}${nextNumber}${numberMatch[3]}`;
        }
      } else if (currentLine.trim().match(/^-\s\[\s\]\s/)) {
        autoComplete = currentLine.match(/^(\s*-\s\[\s\]\s)/)[1];
      }
      
      const newValue = value.substring(0, start) + '\n' + (autoComplete || indent) + value.substring(textarea.selectionEnd);
      setEditingValue(newValue);
      
      // 커서 위치 설정
      const newCursorPos = start + 1 + (autoComplete || indent).length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
        }
      }, 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      saveEdit();
    }
  }, [insertTabAtCursor, cancelEditing, saveEdit]);

  // 키보드 이벤트 핸들러
  const handleEditKeyDown = useCallback((e) => {
    handleAdvancedKeyDown(e);
  }, [handleAdvancedKeyDown]);

  // 포커스 아웃 시 저장
  const handleEditBlur = useCallback(() => {
    // 약간의 지연을 두어 다른 UI 요소 클릭을 허용
    setTimeout(() => {
      if (editingCell) {
        saveEdit();
      }
    }, 100);
  }, [editingCell, saveEdit]);

  // 텍스트 펼침/접기 토글 함수
  const toggleTextExpansion = useCallback((reportId, fieldType) => {
    const key = `${reportId}-${fieldType}`;
    setExpandedTexts(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  // 텍스트가 펼쳐져 있는지 확인하는 함수
  const isTextExpanded = useCallback((reportId, fieldType) => {
    const key = `${reportId}-${fieldType}`;
    return expandedTexts[key] || false;
  }, [expandedTexts]);

  // 마크다운 친화적인 텍스트 자르기 함수
  const smartTruncateMarkdown = useCallback((text, maxLength) => {
    if (!text || text.length <= maxLength) return text;
    
    // 안전한 자르기 위치 찾기 (줄바꿈 기준)
    const lines = text.split('\n');
    let result = '';
    let currentLength = 0;
    
    for (const line of lines) {
      if (currentLength + line.length + 1 > maxLength) {
        // 현재 줄을 추가하면 길이를 초과하는 경우
        if (result.length === 0) {
          // 첫 번째 줄이지만 너무 긴 경우, 단어 경계에서 자르기
          const words = line.split(' ');
          let lineResult = '';
          for (const word of words) {
            if (lineResult.length + word.length + 1 > maxLength) break;
            lineResult += (lineResult ? ' ' : '') + word;
          }
          result = lineResult;
        }
        break;
      }
      result += (result ? '\n' : '') + line;
      currentLength = result.length;
    }
    
    return result;
  }, []);

  // 폴백용 간단한 마크다운 변환 (필요시)
  const renderSimpleMarkdown = useCallback((text) => {
    if (!text) return '';
    
    // 줄별로 처리하여 더 정확한 마크다운 렌더링
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
      // 체크박스 리스트
      if (/^(\s*)- \[ \] (.+)$/.test(line)) {
        const match = line.match(/^(\s*)- \[ \] (.+)$/);
        const indent = match[1].length > 0 ? `<span style="margin-left: ${match[1].length * 8}px"></span>` : '';
        return `${indent}☐ ${match[2]}`;
      }
      if (/^(\s*)- \[x\] (.+)$/.test(line)) {
        const match = line.match(/^(\s*)- \[x\] (.+)$/);
        const indent = match[1].length > 0 ? `<span style="margin-left: ${match[1].length * 8}px"></span>` : '';
        return `${indent}☑ ${match[2]}`;
      }
      
      // 일반 리스트 (들여쓰기 지원)
      if (/^(\s*)[-*] (.+)$/.test(line)) {
        const match = line.match(/^(\s*)[-*] (.+)$/);
        const indent = match[1].length > 0 ? `<span style="margin-left: ${match[1].length * 8}px"></span>` : '';
        return `${indent}• ${match[2]}`;
      }
      
      // 번호 리스트 (들여쓰기 지원)
      if (/^(\s*)\d+\. (.+)$/.test(line)) {
        const match = line.match(/^(\s*)(\d+)\. (.+)$/);
        const indent = match[1].length > 0 ? `<span style="margin-left: ${match[1].length * 8}px"></span>` : '';
        return `${indent}${match[2]}. ${match[3]}`;
      }
      
      // 헤더
      if (/^### (.+)$/.test(line)) {
        return `<strong style="font-size: 1.1em; color: #374151;">${line.replace(/^### /, '')}</strong>`;
      }
      if (/^## (.+)$/.test(line)) {
        return `<strong style="font-size: 1.2em; color: #1f2937;">${line.replace(/^## /, '')}</strong>`;
      }
      if (/^# (.+)$/.test(line)) {
        return `<strong style="font-size: 1.3em; color: #111827;">${line.replace(/^# /, '')}</strong>`;
      }
      
      return line;
    });
    
    // 인라인 마크다운 처리
    return processedLines.join('<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #111827;">$1</strong>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em style="color: #374151;">$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background-color: #f3f4f6; color: #1f2937; padding: 2px 4px; border-radius: 3px; font-size: 0.875em;">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">$1</a>');
  }, []);

  // 텍스트 길이 체크 및 렌더링 함수 (마크다운 지원)
  const renderExpandableText = useCallback((text, reportId, fieldType, maxLength = 150, className = '', bgType = 'white') => {
    if (!text) return <span className="text-xs text-gray-400 italic">미입력</span>;
    
    const isExpanded = isTextExpanded(reportId, fieldType);
    const shouldShowToggle = text.length > maxLength;
    
    // 배경 타입에 따른 그라데이션 클래스 결정
    const getGradientClass = () => {
      switch (bgType) {
        case 'gray':
          return 'from-gray-50 to-transparent';
        case 'blue':
          return 'from-blue-50 to-transparent';
        case 'red':
          return 'from-red-50 to-transparent';
        default:
          return 'from-white to-transparent';
      }
    };
    
    return (
      <div className={`relative ${className}`}>
        <div 
          className={`text-sm leading-relaxed transition-all duration-300 ${
            shouldShowToggle && !isExpanded ? 'overflow-hidden' : ''
          }`}
        >
          {isExpanded || !shouldShowToggle ? (
            // 펼친 상태이거나 짧은 텍스트: 완전한 마크다운 렌더링
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                  // 체크박스 스타일링
                  input: ({ type, checked, ...props }) => {
                    if (type === 'checkbox') {
                      return (
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          className="mr-2 accent-blue-600"
                          {...props}
                        />
                      );
                    }
                    return <input type={type} {...props} />;
                  },
                  // 리스트 스타일링 (컴팩트)
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-0.5 text-sm ml-4">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-0.5 text-sm ml-4">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-sm leading-relaxed" style={{ whiteSpace: 'normal' }}>{children}</li>
                  ),
                  // 헤더 스타일링 (컴팩트)
                  h1: ({ children }) => (
                    <h1 className="text-base font-bold text-gray-900 mb-1">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-sm font-bold text-gray-800 mb-1">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-bold text-gray-700 mb-0.5">{children}</h3>
                  ),
                  // 코드 스타일링
                  code: ({ inline, children }) => {
                    return inline ? (
                      <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-xs">
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs overflow-x-auto my-1" style={{ whiteSpace: 'pre-wrap' }}>
                        <code>{children}</code>
                      </pre>
                    );
                  },
                  // 링크 스타일링
                  a: ({ href, children }) => (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      {children}
                    </a>
                  ),
                  // 단락 스타일링 (컴팩트)
                  p: ({ children }) => (
                    <p className="text-sm leading-relaxed mb-1">{children}</p>
                  ),
                  // 볼드/이탤릭 스타일링
                  strong: ({ children }) => (
                    <strong className="font-semibold text-gray-900">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-gray-700">{children}</em>
                  ),
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          ) : (
            // 접힌 상태: 스마트 자르기 + 단순 마크다운 스타일링
            <div className="text-sm leading-relaxed">
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: renderSimpleMarkdown(smartTruncateMarkdown(text, maxLength))
                }}
              />
            </div>
          )}
        </div>
        
        {/* 그라데이션 페이드 효과 */}
        {shouldShowToggle && !isExpanded && (
          <div className={`absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t ${getGradientClass()} pointer-events-none`} />
        )}
        
        {/* 펼침/접기 버튼 */}
        {shouldShowToggle && (
          <button
            onClick={() => toggleTextExpansion(reportId, fieldType)}
            className="inline-flex items-center mt-2 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full border border-blue-200 transition-all duration-200"
          >
            {isExpanded ? (
              <>
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                접기 ({text.length}자)
              </>
            ) : (
              <>
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                더보기 ({text.length}자)
              </>
            )}
          </button>
        )}
      </div>
    );
  }, [isTextExpanded, toggleTextExpansion, smartTruncateMarkdown, renderSimpleMarkdown]);

  // 텍스트 줄여서 표시
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // 상세 업무 Multi-select 렌더링
  const renderDetailedTaskSelector = (report) => {
    // 방어적 프로그래밍: 안전한 배열 처리
    const taskData = detailedTasks[report.id];
    const reportTasks = Array.isArray(taskData) ? taskData : [];
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
                {Array.isArray(reportTasks) && reportTasks.map((task) => (
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

  // 마크다운을 렌더링하는 함수 (뷰 모드용)
  const renderMarkdownContent = useCallback((text) => {
    if (!text) return <span className="text-xs text-gray-400 italic">미입력</span>;
    
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
          components={{
            // 체크박스 스타일링
            input: ({ type, checked, ...props }) => {
              if (type === 'checkbox') {
                return (
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="mr-2 accent-blue-600"
                    {...props}
                  />
                );
              }
              return <input type={type} {...props} />;
            },
            // 리스트 스타일링
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-1 text-sm">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-1 text-sm">{children}</ol>
            ),
            // 헤더 스타일링
            h1: ({ children }) => (
              <h1 className="text-lg font-bold text-gray-900 mb-2">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-base font-bold text-gray-800 mb-2">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-bold text-gray-700 mb-1">{children}</h3>
            ),
            // 코드 스타일링
            code: ({ inline, children }) => {
              return inline ? (
                <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-xs">
                  {children}
                </code>
              ) : (
                <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                  <code>{children}</code>
                </pre>
              );
            },
            // 링크 스타일링
            a: ({ href, children }) => (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                {children}
              </a>
            ),
            // 단락 스타일링
            p: ({ children }) => (
              <p className="text-sm leading-relaxed mb-2">{children}</p>
            ),
            // 볼드/이탤릭 스타일링
            strong: ({ children }) => (
              <strong className="font-semibold text-gray-900">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-gray-700">{children}</em>
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  }, []);



  // 인라인 편집 가능한 셀 렌더링 함수 (마크다운 지원)
  const renderEditableCell = useCallback((text, reportId, fieldType, maxLength = 150, className = '', bgType = 'white') => {
    const isCurrentlyEditing = editingCell?.reportId === reportId && editingCell?.fieldType === fieldType;
    const previewKey = `${reportId}_${fieldType}`;
    const isPreviewMode = previewMode[previewKey] || false;
    
    if (isCurrentlyEditing) {
      return (
        <div className={`relative ${className}`}>
          {/* 모드 토글 버튼 */}
          <div className="absolute top-2 left-2 z-10 flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePreviewMode(reportId, fieldType);
              }}
              className={`px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${
                isPreviewMode 
                  ? 'bg-gray-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title="편집/프리뷰 모드 토글"
            >
              {isPreviewMode ? '📝 편집' : '👁 프리뷰'}
            </button>
          </div>
          
          {isPreviewMode ? (
            // 프리뷰 모드
            <div className="w-full min-h-[120px] p-3 border-2 border-blue-500 rounded-lg bg-gray-50">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  components={{
                    // 체크박스 스타일링
                    input: ({ type, checked, ...props }) => {
                      if (type === 'checkbox') {
                        return (
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            className="mr-2 accent-blue-600"
                            {...props}
                          />
                        );
                      }
                      return <input type={type} {...props} />;
                    },
                    // 리스트 스타일링
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-1">{children}</ol>
                    ),
                    // 코드 블록 스타일링
                    code: ({ inline, children }) => {
                      return inline ? (
                        <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-sm">
                          {children}
                        </code>
                      ) : (
                        <pre className="bg-gray-800 text-gray-100 p-3 rounded-lg overflow-x-auto">
                          <code>{children}</code>
                        </pre>
                      );
                    },
                    // 링크 스타일링
                    a: ({ href, children }) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {editingValue || '*내용을 입력하세요...*'}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            // 편집 모드
            <textarea
              ref={textareaRef}
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditBlur}
              className="w-full min-h-[120px] p-3 pt-12 border-2 border-blue-500 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white text-sm font-mono"
              autoFocus
              placeholder="마크다운을 지원합니다:
# 제목
- [ ] 체크박스
- 리스트 아이템
**볼드** *이탤릭*
`코드`

TAB: 들여쓰기
Shift+TAB: 내어쓰기
Enter: 자동 들여쓰기/리스트 계속"
            />
          )}
          
          {/* 편집 모드 컨트롤 */}
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            {isUpdating ? (
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveEdit();
                  }}
                  className="w-6 h-6 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center justify-center shadow-lg"
                  title="저장 (Ctrl+Enter)"
                >
                  ✓
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelEditing();
                  }}
                  className="w-6 h-6 bg-red-600 text-white rounded text-xs hover:bg-red-700 flex items-center justify-center shadow-lg"
                  title="취소 (ESC)"
                >
                  ×
                </button>
              </>
            )}
          </div>
          
          {/* 키보드 단축키 안내 */}
          <div className="absolute bottom-1 left-3 text-xs text-gray-500">
            {isPreviewMode ? '프리뷰 모드' : 'TAB: 들여쓰기 • Ctrl+Enter: 저장 • ESC: 취소'}
          </div>
        </div>
      );
    }
    
    // 뷰 모드 (클릭 시 편집 모드로 전환)
    return (
      <div 
        className={`relative cursor-pointer hover:ring-2 hover:ring-blue-300 rounded-lg transition-all duration-200 ${className}`}
        onClick={() => startEditing(reportId, fieldType, text)}
        title="클릭하여 편집"
      >
        {renderExpandableText(text, reportId, fieldType, maxLength, '', bgType)}
        
        {/* 편집 가능 표시 */}
        <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
      </div>
    );
  }, [editingCell, editingValue, isUpdating, previewMode, handleEditKeyDown, handleEditBlur, saveEdit, cancelEditing, startEditing, togglePreviewMode, renderExpandableText]);

  // 편집 핸들러
  const handleEdit = (report) => {
    onEdit && onEdit(report);
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
    <div className="w-full space-y-4">
      {/* 대시보드 헤더 - 풀스크린에서는 간소화 */}
      {!fullscreen && (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">주차별 보고서 관리</h2>
            <p className="text-gray-600">프로젝트별 주차 진행 상황을 한눈에 확인하고 관리하세요</p>
          </div>
          
          {/* 뷰 모드 및 통계 */}
          <div className="flex items-center gap-6">
            <div className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
              총 <span className="font-semibold text-blue-600">{reports.length}</span>개 보고서
            </div>
            
            {/* 뷰 모드 전환 버튼 */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
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
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
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
        </div>
      </div>
      )}

      {/* 풀스크린 모드 - 간소화된 헤더 */}
      {fullscreen && (
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold text-gray-900">
              총 <span className="text-blue-600">{reports.length}</span>개 보고서
            </div>
            {projectFilter && (
              <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-lg">
                📋 {projectFilter}
              </div>
            )}
          </div>
          
          {/* 뷰 모드 전환 버튼 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0V4a1 1 0 011-1h16a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
              </svg>
              테이블
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                viewMode === 'card'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              카드
            </button>
          </div>
        </div>
      )}

      {/* 필터 패널 - 풀스크린에서는 숨김 */}
      {!fullscreen && (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">필터 및 검색</h3>
        </div>
        
        {/* 필터 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">프로젝트</label>
            <select
              value={filters.project}
              onChange={(e) => handleFilterChange('project', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">전체 프로젝트</option>
                              {Array.isArray(filterOptions.projects) && filterOptions.projects.map(project => (
                <option key={typeof project === 'string' ? project : project.name} value={typeof project === 'string' ? project : project.name}>
                  {typeof project === 'string' ? project : project.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">주차</label>
            <select
              value={filters.week}
              onChange={(e) => handleFilterChange('week', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">전체 주차</option>
                              {Array.isArray(filterOptions.weeks) && filterOptions.weeks.map(week => (
                <option key={week} value={week}>{week}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">단계</label>
            <select
              value={filters.stage}
              onChange={(e) => handleFilterChange('stage', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">전체 단계</option>
                              {Array.isArray(filterOptions.stages) && filterOptions.stages.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">시작 주차</label>
            <input
              type="text"
              value={filters.start_week}
              onChange={(e) => handleFilterChange('start_week', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="2024-W01"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">종료 주차</label>
            <input
              type="text"
              value={filters.end_week}
              onChange={(e) => handleFilterChange('end_week', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="2024-W12"
            />
          </div>
        </div>
        
        {/* 필터 액션 */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <button
            onClick={handleResetFilters}
            className="flex items-center px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            필터 초기화
          </button>
          
          <div className="text-sm text-gray-600">
            {Object.values(filters).some(f => f) && (
              <span className="text-blue-600 font-medium">필터 적용 중 • </span>
            )}
            <span>검색 결과: {reports.length}건</span>
          </div>
        </div>
      </div>
      )}

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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* 테이블 뷰 */}
          {viewMode === 'table' && (
            <div className="space-y-4">
              {/* 엑셀 스타일 테이블 컨트롤 */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-green-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-700">📊 테이블 전체 너비</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">80%</span>
                        <input
                          type="range"
                          min="80"
                          max="100"
                          value={tableWidth}
                          onChange={(e) => setTableWidth(Number(e.target.value))}
                          className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((tableWidth - 80) / 20) * 100}%, #E5E7EB ${((tableWidth - 80) / 20) * 100}%, #E5E7EB 100%)`
                          }}
                        />
                        <span className="text-xs text-gray-500">100%</span>
                      </div>
                      <span className="text-sm font-medium text-blue-600">{tableWidth}%</span>
                    </div>
                    
                    <div className="border-l border-gray-300 pl-6">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">📏 컬럼별 리사이징:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">드래그</span>
                          <span className="text-xs text-gray-500">또는</span>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">더블클릭</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-gray-600 font-medium">✨ 엑셀 스타일 컬럼 조절 & 인라인 편집</div>
                    <div className="text-xs text-gray-500">
                      컬럼 경계 드래그로 크기 조절 • 더블클릭으로 자동 조절 • 내용 클릭으로 바로 편집
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 테이블 컨테이너 */}
              <div className="overflow-x-auto">
                <div style={{ width: `${tableWidth}%`, minWidth: '1700px' }}>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {/* 주차 컬럼 */}
                        <th 
                          className="relative px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300 select-none"
                          style={{ width: `${columnWidths.week}px` }}
                        >
                          <div className="flex items-center justify-between">
                            <span>주차</span>
                            <span className="text-xs text-gray-400">({columnWidths.week}px)</span>
                          </div>
                          <div 
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                            onMouseDown={(e) => handleMouseDown(e, 'week')}
                            onDoubleClick={() => handleDoubleClick('week')}
                            title="드래그하여 컬럼 크기 조절 / 더블클릭으로 자동 조절"
                          />
                        </th>
                        
                        {/* 프로젝트 컬럼 */}
                        <th 
                          className="relative px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300 select-none"
                          style={{ width: `${columnWidths.project}px` }}
                        >
                          <div className="flex items-center justify-between">
                            <span>프로젝트</span>
                            <span className="text-xs text-gray-400">({columnWidths.project}px)</span>
                          </div>
                          <div 
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                            onMouseDown={(e) => handleMouseDown(e, 'project')}
                            onDoubleClick={() => handleDoubleClick('project')}
                            title="드래그하여 컬럼 크기 조절 / 더블클릭으로 자동 조절"
                          />
                        </th>
                        
                        {/* 단계 컬럼 */}
                        <th 
                          className="relative px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300 select-none"
                          style={{ width: `${columnWidths.stage}px` }}
                        >
                          <div className="flex items-center justify-between">
                            <span>단계</span>
                            <span className="text-xs text-gray-400">({columnWidths.stage}px)</span>
                          </div>
                          <div 
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                            onMouseDown={(e) => handleMouseDown(e, 'stage')}
                            onDoubleClick={() => handleDoubleClick('stage')}
                            title="드래그하여 컬럼 크기 조절 / 더블클릭으로 자동 조절"
                          />
                        </th>
                        
                        {/* 이번 주 한 일 컬럼 */}
                        <th 
                          className="relative px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300 select-none"
                          style={{ width: `${columnWidths.thisWeek}px` }}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span>이번 주 한 일</span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                주요
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">({columnWidths.thisWeek}px)</span>
                          </div>
                          <div 
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                            onMouseDown={(e) => handleMouseDown(e, 'thisWeek')}
                            onDoubleClick={() => handleDoubleClick('thisWeek')}
                            title="드래그하여 컬럼 크기 조절 / 더블클릭으로 자동 조절"
                          />
                        </th>
                        
                        {/* 다음 주 계획 컬럼 */}
                        <th 
                          className="relative px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300 select-none"
                          style={{ width: `${columnWidths.nextWeek}px` }}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span>다음 주 계획</span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                주요
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">({columnWidths.nextWeek}px)</span>
                          </div>
                          <div 
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                            onMouseDown={(e) => handleMouseDown(e, 'nextWeek')}
                            onDoubleClick={() => handleDoubleClick('nextWeek')}
                            title="드래그하여 컬럼 크기 조절 / 더블클릭으로 자동 조절"
                          />
                        </th>
                        
                        {/* 이슈/리스크 컬럼 */}
                        <th 
                          className="relative px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300 select-none"
                          style={{ width: `${columnWidths.issues}px` }}
                        >
                          <div className="flex items-center justify-between">
                            <span>이슈/리스크</span>
                            <span className="text-xs text-gray-400">({columnWidths.issues}px)</span>
                          </div>
                          <div 
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                            onMouseDown={(e) => handleMouseDown(e, 'issues')}
                            onDoubleClick={() => handleDoubleClick('issues')}
                            title="드래그하여 컬럼 크기 조절 / 더블클릭으로 자동 조절"
                          />
                        </th>

                        {/* 관련 상세 업무 컬럼 */}
                        <th 
                          className="relative px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300 select-none"
                          style={{ width: `${columnWidths.detailedTasks}px` }}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span>관련 상세 업무</span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                연동
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">({columnWidths.detailedTasks}px)</span>
                          </div>
                          <div 
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                            onMouseDown={(e) => handleMouseDown(e, 'detailedTasks')}
                            onDoubleClick={() => handleDoubleClick('detailedTasks')}
                            title="드래그하여 컬럼 크기 조절 / 더블클릭으로 자동 조절"
                          />
                        </th>
                        
                        {/* 수정일 컬럼 */}
                        <th 
                          className="relative px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300 select-none"
                          style={{ width: `${columnWidths.updated}px` }}
                        >
                          <div className="flex items-center justify-between">
                            <span>수정일</span>
                            <span className="text-xs text-gray-400">({columnWidths.updated}px)</span>
                          </div>
                          <div 
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-400 transition-colors"
                            onMouseDown={(e) => handleMouseDown(e, 'updated')}
                            onDoubleClick={() => handleDoubleClick('updated')}
                            title="드래그하여 컬럼 크기 조절 / 더블클릭으로 자동 조절"
                          />
                        </th>
                        
                        {/* 액션 컬럼 */}
                        <th 
                          className="relative px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider select-none"
                          style={{ width: `${columnWidths.actions}px` }}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <span>액션</span>
                            <span className="text-xs text-gray-400">({columnWidths.actions}px)</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Array.isArray(reports) && reports.map((report, index) => (
                        <tr key={report.id} className={`hover:bg-blue-50 transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                          {/* 주차 컬럼 */}
                          <td className="px-4 py-5 border-r border-gray-200" style={{ width: `${columnWidths.week}px` }}>
                            <div className="flex flex-col items-start">
                              <span className="text-sm font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-lg">
                                {report.week}
                              </span>
                              <span className="text-xs text-gray-500 mt-1">
                                {utilsAPI.getWeekDateRange(report.week)?.startString}
                              </span>
                            </div>
                          </td>
                          
                          {/* 프로젝트 컬럼 */}
                          <td className="px-4 py-5 border-r border-gray-200" style={{ width: `${columnWidths.project}px` }}>
                            <div className="text-sm font-semibold text-gray-900 break-words overflow-hidden">
                              {report.project}
                            </div>
                          </td>
                          
                          {/* 단계 컬럼 */}
                          <td className="px-4 py-5 border-r border-gray-200" style={{ width: `${columnWidths.stage}px` }}>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                              {report.stage}
                            </span>
                          </td>
                          
                          {/* 이번 주 한 일 컬럼 */}
                          <td className="px-4 py-5 border-r border-gray-200" style={{ width: `${columnWidths.thisWeek}px` }}>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              {renderEditableCell(
                                report.this_week_work, 
                                report.id, 
                                'this_week_work', 
                                Math.max(100, Math.floor(columnWidths.thisWeek / 4)), // 동적 텍스트 길이
                                'text-gray-900', 
                                'gray'
                              )}
                            </div>
                          </td>
                          
                          {/* 다음 주 계획 컬럼 */}
                          <td className="px-4 py-5 border-r border-gray-200" style={{ width: `${columnWidths.nextWeek}px` }}>
                            <div className="bg-blue-50 p-3 rounded-lg">
                              {renderEditableCell(
                                report.next_week_plan, 
                                report.id, 
                                'next_week_plan', 
                                Math.max(100, Math.floor(columnWidths.nextWeek / 4)), // 동적 텍스트 길이
                                'text-blue-700', 
                                'blue'
                              )}
                            </div>
                          </td>
                          
                          {/* 이슈/리스크 컬럼 */}
                          <td className="px-4 py-5 border-r border-gray-200" style={{ width: `${columnWidths.issues}px` }}>
                            <div className="bg-red-50 p-3 rounded-lg">
                              {renderEditableCell(
                                report.issues_risks, 
                                report.id, 
                                'issues_risks', 
                                Math.max(80, Math.floor(columnWidths.issues / 3)), // 동적 텍스트 길이
                                'text-red-700', 
                                'red'
                              )}
                            </div>
                          </td>

                          {/* 관련 상세 업무 컬럼 */}
                          <td className="px-4 py-5 border-r border-gray-200" style={{ width: `${columnWidths.detailedTasks}px` }}>
                            <div className="bg-purple-50 p-3 rounded-lg">
                              {renderDetailedTaskSelector(report)}
                            </div>
                          </td>
                          
                          {/* 수정일 컬럼 */}
                          <td className="px-4 py-5 text-xs text-gray-500 border-r border-gray-200" style={{ width: `${columnWidths.updated}px` }}>
                            <div className="overflow-hidden text-ellipsis">
                              {new Date(report.updated_at).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          </td>
                          
                          {/* 액션 컬럼 */}
                          <td className="px-4 py-5" style={{ width: `${columnWidths.actions}px` }}>
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => handleEdit(report)}
                                className="p-1 text-blue-600 hover:text-white hover:bg-blue-600 rounded-lg transition-all duration-200"
                                title="수정"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(report.id)}
                                className="p-1 text-red-600 hover:text-white hover:bg-red-600 rounded-lg transition-all duration-200"
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
              </div>
            </div>
          )}

          {/* 카드 뷰 */}
          {viewMode === 'card' && (
            <div className="space-y-4">
              {Array.isArray(reports) && reports.map((report) => (
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
                        onClick={() => handleEdit(report)}
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

                  {/* 이번 주 한 일 */}
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">이번 주 한 일</h4>
                    <div className="bg-gray-50 p-3 rounded">
                      {renderEditableCell(report.this_week_work, report.id, 'this_week_work', 300, 'text-gray-700', 'gray')}
                    </div>
                  </div>

                  {/* 다음 주 계획 & 이슈/리스크 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">다음 주 계획</h4>
                      <div className="bg-blue-50 p-3 rounded">
                        {renderEditableCell(report.next_week_plan, report.id, 'next_week_plan', 200, 'text-blue-700', 'blue')}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">이슈/리스크</h4>
                      <div className="bg-red-50 p-3 rounded">
                        {renderEditableCell(report.issues_risks, report.id, 'issues_risks', 200, 'text-red-700', 'red')}
                      </div>
                    </div>
                  </div>

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