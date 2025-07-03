import React, { useState, useEffect } from 'react';
import { projectAPI } from '../services/api';
import ProjectFormModal from './ProjectFormModal';

const ProjectManager = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 모달 상태
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // 파일 업로드 상태
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStep, setUploadStep] = useState('select'); // select -> validate -> confirm -> result
  const [validationResult, setValidationResult] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadGuide, setUploadGuide] = useState(null);

  // 필터 및 정렬 상태
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    manager: ''
  });

  useEffect(() => {
    loadProjects();
  }, [filters]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await projectAPI.getAllProjects(filters);
      setProjects(response.data || []);
    } catch (error) {
      console.error('프로젝트 로딩 오류:', error);
      setError('프로젝트 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    setEditingProject(null);
    setShowFormModal(true);
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setShowFormModal(true);
  };

  const handleDeleteProject = (project) => {
    setDeleteTarget(project);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await projectAPI.deleteProject(deleteTarget.id);
      setSuccess(`프로젝트 "${deleteTarget.name}"이(가) 삭제되었습니다.`);
      loadProjects();
    } catch (error) {
      console.error('프로젝트 삭제 오류:', error);
      setError('프로젝트 삭제 중 오류가 발생했습니다.');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleFormSuccess = () => {
    setSuccess(`프로젝트가 성공적으로 ${editingProject ? "수정" : "생성"}되었습니다.`);
    loadProjects();
  };

  // 파일 업로드 관련 함수들
  const handleFileUpload = () => {
    setShowUploadModal(true);
    setUploadStep('select');
    setUploadFile(null);
    setValidationResult(null);
    setUploadResult(null);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setUploadFile(file);
  };

  const handleFileDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    setUploadFile(file);
  };

  const handleFileValidate = async () => {
    if (!uploadFile) return;

    try {
      setLoading(true);
      const response = await projectAPI.validateUploadFile(uploadFile);
      setValidationResult(response.data);
      setUploadStep('confirm');
    } catch (error) {
      console.error('파일 검증 오류:', error);
      setValidationResult({
        valid: false,
        errors: error.response?.data?.detail || ['파일 검증 중 오류가 발생했습니다.'],
        preview: []
      });
      setUploadStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async () => {
    if (!uploadFile || !validationResult?.valid) return;

    try {
      setLoading(true);
      const response = await projectAPI.importProjects(uploadFile);
      setUploadResult(response.data);
      setUploadStep('result');
      loadProjects();
    } catch (error) {
      console.error('파일 임포트 오류:', error);
      setUploadResult({
        success: false,
        message: error.response?.data?.detail || '파일 임포트 중 오류가 발생했습니다.',
        imported_count: 0
      });
      setUploadStep('result');
    } finally {
      setLoading(false);
    }
  };

  const loadUploadGuide = async () => {
    try {
      const response = await projectAPI.getUploadGuide();
      setUploadGuide(response.data);
      setShowUploadGuide(true);
    } catch (error) {
      console.error('업로드 가이드 로딩 오류:', error);
    }
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      planning: '계획중',
      active: '진행중',
      on_hold: '보류',
      completed: '완료',
      cancelled: '취소'
    };
    return statusMap[status] || status;
  };

  const getPriorityLabel = (priority) => {
    const priorityMap = {
      low: '낮음',
      medium: '보통',
      high: '높음',
      critical: '긴급'
    };
    return priorityMap[priority] || priority;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      planning: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      on_hold: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colorMap = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colorMap[priority] || 'bg-gray-100 text-gray-800';
  };

  // 알림 자동 숨김
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">프로젝트 관리</h2>
      </div>

      {/* 알림 메시지 */}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* 액션 버튼들 */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleCreateProject}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 프로젝트
        </button>
        
        <button
          onClick={handleFileUpload}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          파일 업로드
        </button>

        <button
          onClick={loadUploadGuide}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          업로드 가이드
        </button>
      </div>

      {/* 필터 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체</option>
            <option value="planning">계획중</option>
            <option value="active">진행중</option>
            <option value="on_hold">보류</option>
            <option value="completed">완료</option>
            <option value="cancelled">취소</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
          <select
            value={filters.priority}
            onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체</option>
            <option value="low">낮음</option>
            <option value="medium">보통</option>
            <option value="high">높음</option>
            <option value="critical">긴급</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">담당자</label>
          <input
            type="text"
            value={filters.manager}
            onChange={(e) => setFilters(prev => ({ ...prev, manager: e.target.value }))}
            placeholder="담당자 이름으로 검색"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 프로젝트 목록 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">프로젝트가 없습니다</h3>
          <p className="mt-1 text-sm text-gray-500">새 프로젝트를 등록하거나 파일을 업로드해보세요.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  프로젝트명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  우선순위
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  담당자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  일정
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  예산
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{project.name}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {project.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                      {getStatusLabel(project.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(project.priority)}`}>
                      {getPriorityLabel(project.priority)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.manager}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      {project.start_date && (
                        <div>시작: {project.start_date}</div>
                      )}
                      {project.end_date && (
                        <div>종료: {project.end_date}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.budget ? `₩${project.budget.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditProject(project)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="편집"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="삭제"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

      {/* 프로젝트 생성/편집 모달 */}
      <ProjectFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSuccess={handleFormSuccess}
        editProject={editingProject}
        title={editingProject ? "프로젝트 편집" : "새 프로젝트 등록"}
      />

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">프로젝트 삭제</h3>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              "{deleteTarget?.name}" 프로젝트를 삭제하시겠습니까?<br />
              이 작업은 되돌릴 수 없습니다.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 파일 업로드 모달 */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* 파일 업로드 모달 내용... (기존 코드 유지) */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">프로젝트 파일 업로드</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* 업로드 단계 표시 */}
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    ['select', 'validate', 'confirm', 'result'].indexOf(uploadStep) >= 0 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    1
                  </div>
                  <span className="ml-2 text-sm text-gray-600">파일 선택</span>
                  <div className="w-16 h-px bg-gray-300 mx-4"></div>
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    ['validate', 'confirm', 'result'].indexOf(uploadStep) >= 0 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    2
                  </div>
                  <span className="ml-2 text-sm text-gray-600">검증</span>
                  <div className="w-16 h-px bg-gray-300 mx-4"></div>
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    ['confirm', 'result'].indexOf(uploadStep) >= 0 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    3
                  </div>
                  <span className="ml-2 text-sm text-gray-600">확인</span>
                  <div className="w-16 h-px bg-gray-300 mx-4"></div>
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    uploadStep === 'result' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    4
                  </div>
                  <span className="ml-2 text-sm text-gray-600">완료</span>
                </div>
              </div>

              {/* 단계별 내용 */}
              {uploadStep === 'select' && (
                <div>
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
                    onDrop={handleFileDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-2 text-sm text-gray-600">
                      <span className="font-semibold">파일을 선택하거나</span> 여기로 드래그하세요
                    </p>
                    <p className="text-xs text-gray-500 mb-4">CSV, JSON 파일만 지원됩니다</p>
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      파일 선택
                    </label>
                  </div>
                  
                  {uploadFile && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <svg className="w-8 h-8 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                          <p className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end mt-6">
                    <button
                      onClick={handleFileValidate}
                      disabled={!uploadFile || loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? '검증 중...' : '다음 단계'}
                    </button>
                  </div>
                </div>
              )}

              {uploadStep === 'confirm' && validationResult && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">검증 결과</h3>
                  
                  {validationResult.valid ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <div className="flex">
                        <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div>
                          <h4 className="font-medium text-green-800">검증 성공</h4>
                          <p className="text-sm text-green-700">
                            {validationResult.total_rows}개의 프로젝트가 확인되었습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <div className="flex">
                        <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <div>
                          <h4 className="font-medium text-red-800">검증 실패</h4>
                          <ul className="text-sm text-red-700 mt-2 space-y-1">
                            {validationResult.errors.map((error, index) => (
                              <li key={index}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {validationResult.preview && validationResult.preview.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">데이터 미리보기</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              {validationResult.preview[0] && Object.keys(validationResult.preview[0]).map(key => (
                                <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {validationResult.preview.map((row, index) => (
                              <tr key={index}>
                                {Object.values(row).map((value, cellIndex) => (
                                  <td key={cellIndex} className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                    {String(value || '-')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <button
                      onClick={() => setUploadStep('select')}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      이전
                    </button>
                    <button
                      onClick={handleFileImport}
                      disabled={!validationResult.valid || loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? '업로드 중...' : '업로드 실행'}
                    </button>
                  </div>
                </div>
              )}

              {uploadStep === 'result' && uploadResult && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">업로드 결과</h3>
                  
                  {uploadResult.success ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <div className="flex">
                        <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div>
                          <h4 className="font-medium text-green-800">업로드 완료</h4>
                          <p className="text-sm text-green-700">
                            {uploadResult.imported_count}개의 프로젝트가 성공적으로 등록되었습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <div className="flex">
                        <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <div>
                          <h4 className="font-medium text-red-800">업로드 실패</h4>
                          <p className="text-sm text-red-700">{uploadResult.message}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadStep('select');
                        setUploadFile(null);
                        setValidationResult(null);
                        setUploadResult(null);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      완료
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 업로드 가이드 모달 */}
      {showUploadGuide && uploadGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">프로젝트 업로드 가이드</h3>
                <button
                  onClick={() => setShowUploadGuide(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">📋 필수 컬럼</h4>
                  <div className="space-y-3">
                    {uploadGuide.required_columns?.map((column, index) => (
                      <div key={index} className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded-r-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-red-800">{column.name}</span>
                          {column.options && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                              옵션: {column.options.join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-red-700">{column.description}</div>
                        {column.example && (
                          <div className="text-xs text-red-600 mt-1">
                            예시: <code className="bg-red-100 px-1 rounded">{column.example}</code>
                          </div>
                        )}
                        {column.format && (
                          <div className="text-xs text-red-600 mt-1">
                            형식: <code className="bg-red-100 px-1 rounded">{column.format}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">⚙️ 선택 컬럼</h4>
                  <div className="space-y-3">
                    {uploadGuide.optional_columns?.map((column, index) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-blue-800">{column.name}</span>
                          {column.options && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              옵션: {column.options.join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-blue-700">{column.description}</div>
                        {column.example && (
                          <div className="text-xs text-blue-600 mt-1">
                            예시: <code className="bg-blue-100 px-1 rounded">{column.example}</code>
                          </div>
                        )}
                        {column.format && (
                          <div className="text-xs text-blue-600 mt-1">
                            형식: <code className="bg-blue-100 px-1 rounded">{column.format}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 mb-4">💡 사용 가이드</h4>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-yellow-800">
                      <span>📄</span>
                      <span><strong>지원 형식:</strong> {uploadGuide.supported_formats?.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-yellow-800">
                      <span>📊</span>
                      <span><strong>파일 크기 제한:</strong> {uploadGuide.file_size_limit}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-yellow-800">
                      <span>🔤</span>
                      <span><strong>인코딩:</strong> {uploadGuide.encoding}</span>
                    </div>
                  </div>
                  
                  {uploadGuide.tips && (
                    <div className="mt-4">
                      <h5 className="font-medium text-yellow-800 mb-2">📝 주요 팁</h5>
                      <ul className="space-y-1 text-sm text-yellow-700">
                        {uploadGuide.tips.map((tip, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-yellow-500 mr-2 mt-0.5">•</span>
                            <span>{typeof tip === 'string' ? tip : JSON.stringify(tip)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 mb-4">📥 템플릿 다운로드</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-3">
                    샘플 데이터가 포함된 템플릿을 다운로드하여 업로드 형식을 확인하세요.
                  </p>
                  <div className="flex gap-3">
                    <a
                      href={projectAPI.getTemplateDownloadUrl('csv')}
                      download
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      📊 CSV 템플릿
                    </a>
                    <a
                      href={projectAPI.getTemplateDownloadUrl('json')}
                      download
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      📋 JSON 템플릿
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManager;
