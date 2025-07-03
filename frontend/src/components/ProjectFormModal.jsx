import React, { useState, useEffect } from 'react';
import { projectAPI } from '../services/api';

const ProjectFormModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  editProject = null,
  title = "새 프로젝트 등록"
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'planning',
    priority: 'medium',
    manager: '',
    team_members: '',
    budget: '',
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // 편집 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (editProject) {
      setFormData({
        name: editProject.name || '',
        description: editProject.description || '',
        start_date: editProject.start_date || '',
        end_date: editProject.end_date || '',
        status: editProject.status || 'planning',
        priority: editProject.priority || 'medium',
        manager: editProject.manager || '',
        team_members: editProject.team_members || '',
        budget: editProject.budget ? editProject.budget.toString() : '',
        notes: editProject.notes || ''
      });
    } else {
      // 새 프로젝트일 때 초기화
      setFormData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'planning',
        priority: 'medium',
        manager: '',
        team_members: '',
        budget: '',
        notes: ''
      });
    }
    setErrors({});
  }, [editProject, isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 에러 메시지 클리어
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = '프로젝트명은 필수입니다';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = '프로젝트 설명은 필수입니다';
    }
    
    if (!formData.manager.trim()) {
      newErrors.manager = '담당자는 필수입니다';
    }
    
    if (formData.start_date && formData.end_date) {
      if (new Date(formData.start_date) > new Date(formData.end_date)) {
        newErrors.end_date = '종료일은 시작일보다 늦어야 합니다';
      }
    }
    
    if (formData.budget && isNaN(parseFloat(formData.budget))) {
      newErrors.budget = '올바른 숫자를 입력하세요';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const submitData = {
        ...formData,
        budget: formData.budget ? parseFloat(formData.budget) : null
      };
      
      if (editProject) {
        // 편집 모드
        await projectAPI.updateProject(editProject.id, submitData);
      } else {
        // 생성 모드
        await projectAPI.createProject(submitData);
      }
      
      onSuccess && onSuccess();
      onClose();
    } catch (error) {
      console.error('프로젝트 저장 오류:', error);
      setErrors({ 
        general: error.response?.data?.detail || '프로젝트 저장 중 오류가 발생했습니다.' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 일반 오류 메시지 */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {errors.general}
            </div>
          )}
          
          {/* 프로젝트 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                프로젝트명 *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="프로젝트 이름을 입력하세요"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                프로젝트 설명 *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="프로젝트에 대한 설명을 입력하세요"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시작일
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                종료일
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.end_date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.end_date && (
                <p className="mt-1 text-sm text-red-600">{errors.end_date}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상태
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="planning">계획중</option>
                <option value="active">진행중</option>
                <option value="on_hold">보류</option>
                <option value="completed">완료</option>
                <option value="cancelled">취소</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                우선순위
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
                <option value="critical">긴급</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                담당자 *
              </label>
              <input
                type="text"
                name="manager"
                value={formData.manager}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.manager ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="프로젝트 담당자 이름"
              />
              {errors.manager && (
                <p className="mt-1 text-sm text-red-600">{errors.manager}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                예산 (원)
              </label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.budget ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="1000000"
              />
              {errors.budget && (
                <p className="mt-1 text-sm text-red-600">{errors.budget}</p>
              )}
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                팀원
              </label>
              <input
                type="text"
                name="team_members"
                value={formData.team_members}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="김철수, 이영희, 박민수 (쉼표로 구분)"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                메모
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="추가 메모사항을 입력하세요"
              />
            </div>
          </div>
          
          {/* 버튼 영역 */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '저장 중...' : (editProject ? '수정' : '등록')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectFormModal; 