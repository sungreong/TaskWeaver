import React, { useState, useEffect } from 'react';
import { detailedTaskAPI, projectAPI } from '../services/api';

const DetailedTaskFormModal = ({ isOpen, onClose, onSave, defaultProject, defaultStage, isFieldsEditable = false, initialData = null }) => {
  const [formData, setFormData] = useState({
    project: defaultProject || '',
    stage: defaultStage || '',
    task_item: '',
    assignee: '',
    current_status: 'not_started',
    has_risk: false,
    description: '',
    planned_end_date: '',
    actual_end_date: '',
    progress_rate: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectStages, setProjectStages] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  
  // 프로젝트 목록 로딩
  useEffect(() => {
    const loadProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const response = await projectAPI.getProjectNames();
        setProjects(response.data);
      } catch (err) {
        console.error('Error loading projects:', err);
      } finally {
        setIsLoadingProjects(false);
      }
    };
    
    if (isOpen && isFieldsEditable) {
      loadProjects();
    }
  }, [isOpen, isFieldsEditable]);
  
  // 프로젝트 변경 시 해당 프로젝트의 단계 목록 로딩
  useEffect(() => {
    const loadProjectStages = async () => {
      if (!formData.project) {
        setProjectStages([]);
        return;
      }
      
      try {
        const response = await projectAPI.getProjectByName(formData.project);
        if (response.data && response.data.stages) {
          setProjectStages(response.data.stages);
          
          // 현재 선택된 단계가 새 프로젝트의 단계 목록에 없으면 첫 번째 단계로 설정
          if (response.data.stages.length > 0 && !response.data.stages.includes(formData.stage)) {
            setFormData(prev => ({
              ...prev,
              stage: response.data.stages[0]
            }));
          }
        }
      } catch (err) {
        console.error('Error loading project stages:', err);
      }
    };
    
    if (isFieldsEditable && formData.project) {
      loadProjectStages();
    }
  }, [formData.project, isFieldsEditable]);
  
  // initialData가 변경될 때 폼 데이터 업데이트
  useEffect(() => {
    if (initialData) {
      setFormData({
        project: initialData.project || defaultProject || '',
        stage: initialData.stage || defaultStage || '',
        task_item: initialData.task_item || '',
        assignee: initialData.assignee || '',
        current_status: initialData.current_status || 'not_started',
        has_risk: initialData.has_risk || false,
        description: initialData.description || '',
        planned_end_date: initialData.planned_end_date || '',
        actual_end_date: initialData.actual_end_date || '',
        progress_rate: initialData.progress_rate || 0
      });
    } else {
      setFormData({
        project: defaultProject || '',
        stage: defaultStage || '',
        task_item: '',
        assignee: '',
        current_status: 'not_started',
        has_risk: false,
        description: '',
        planned_end_date: '',
        actual_end_date: '',
        progress_rate: 0
      });
    }
  }, [initialData, defaultProject, defaultStage]);

  // defaultProject와 defaultStage가 변경될 때 폼 데이터 업데이트 (initialData가 없을 때만)
  useEffect(() => {
    if (!initialData) {
      setFormData(prev => ({
        ...prev,
        project: defaultProject || '',
        stage: defaultStage || ''
      }));
    }
  }, [defaultProject, defaultStage, initialData]);

  // 폼 데이터 변경 핸들러
  const handleChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 필수 필드 검증
    if (!formData.task_item.trim()) {
      setError('업무명을 입력해주세요.');
      return;
    }
    
    if (!formData.project.trim()) {
      setError('프로젝트명을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      
      let response;
      
      if (initialData) {
        // 기존 업무 수정
        response = await detailedTaskAPI.updateDetailedTask(initialData.id, formData);
      } else {
        // 새 업무 생성
        response = await detailedTaskAPI.createDetailedTask(formData);
      }
      
      onSave(response.data);
      handleClose();
    } catch (err) {
      // 에러 메시지 처리
      let errorMessage = initialData 
        ? '상세 업무 수정 중 오류가 발생했습니다.' 
        : '상세 업무 생성 중 오류가 발생했습니다.';
      
      if (err.response?.data?.detail) {
        // FastAPI validation error가 배열 형태일 때
        if (Array.isArray(err.response.data.detail)) {
          const errors = err.response.data.detail.map(error => 
            `${error.loc?.[error.loc.length - 1] || 'field'}: ${error.msg}`
          ).join(', ');
          errorMessage = `입력 오류: ${errors}`;
        } else if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        }
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      
      setError(errorMessage);
      console.error('Task operation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 모달 닫기
  const handleClose = () => {
    setFormData({
      project: defaultProject || '',
      stage: defaultStage || '',
      task_item: '',
      assignee: '',
      current_status: 'not_started',
      has_risk: false,
      description: '',
      planned_end_date: '',
      actual_end_date: '',
      progress_rate: 0
    });
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                {initialData ? '상세 업무 수정' : '새 상세 업무 추가'}
              </h2>
              <p className="text-blue-100 text-sm">
                {formData.project && `${formData.project} - ${formData.stage}`}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 p-1"
              disabled={isSubmitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 오류 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 프로젝트 (조건부 드롭다운/읽기 전용) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                프로젝트 *
              </label>
              {isFieldsEditable ? (
                <select
                  value={formData.project}
                  onChange={(e) => handleChange('project', e.target.value)}
                  disabled={isLoadingProjects}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">프로젝트 선택</option>
                  {projects.map(projectName => (
                    <option key={projectName} value={projectName}>{projectName}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.project}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                />
              )}
            </div>

            {/* 단계 (조건부 드롭다운/읽기 전용) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                단계 *
              </label>
              {isFieldsEditable && projectStages.length > 0 ? (
                <select
                  value={formData.stage}
                  onChange={(e) => handleChange('stage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {projectStages.map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.stage}
                  readOnly={!isFieldsEditable || projectStages.length === 0}
                  onChange={(e) => handleChange('stage', e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${!isFieldsEditable ? 'bg-gray-50' : 'focus:ring-2 focus:ring-blue-500 focus:border-transparent'} text-gray-700`}
                />
              )}
            </div>

            {/* 업무명 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                업무명 *
              </label>
              <input
                type="text"
                value={formData.task_item}
                onChange={(e) => handleChange('task_item', e.target.value)}
                placeholder="상세 업무명을 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* 담당자 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                담당자
              </label>
              <input
                type="text"
                value={formData.assignee}
                onChange={(e) => handleChange('assignee', e.target.value)}
                placeholder="담당자명"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 상태와 리스크 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상태
              </label>
              <select
                value={formData.current_status}
                onChange={(e) => handleChange('current_status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="not_started">시작 전</option>
                <option value="in_progress">진행 중</option>
                <option value="on_hold">보류</option>
                <option value="completed">완료</option>
                <option value="cancelled">취소</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                리스크 여부
              </label>
              <div className="flex items-center space-x-4 mt-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="has_risk"
                    checked={!formData.has_risk}
                    onChange={() => handleChange('has_risk', false)}
                    className="mr-2"
                  />
                  <span>없음</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="has_risk"
                    checked={formData.has_risk}
                    onChange={() => handleChange('has_risk', true)}
                    className="mr-2"
                  />
                  <span>있음</span>
                </label>
              </div>
            </div>
          </div>

          {/* 날짜 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                계획 종료일
              </label>
              <input
                type="date"
                value={formData.planned_end_date}
                onChange={(e) => handleChange('planned_end_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                실제 완료일
              </label>
              <input
                type="date"
                value={formData.actual_end_date}
                onChange={(e) => handleChange('actual_end_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 진행률 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              진행률: {formData.progress_rate}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={formData.progress_rate}
              onChange={(e) => handleChange('progress_rate', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* 설명/메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명/메모
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="업무 설명이나 추가 메모사항을 입력하세요..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* 버튼 */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>저장 중...</span>
                </>
              ) : (
                <span>저장</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DetailedTaskFormModal; 
