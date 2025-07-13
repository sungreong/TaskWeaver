import React, { useState, useEffect } from 'react';
import WeeklyReportForm from './WeeklyReportForm';
import WeeklyReportList from './WeeklyReportList';
import DetailedTaskSheet from './DetailedTaskSheet';
import SummaryViewer from './SummaryViewer';
import ProjectTimeline from './ProjectTimeline';
import WBSWorkspaceTab from './WBSWorkspaceTab';
import { projectAPI, summaryAPI } from '../services/api';

const ProjectWorkspace = ({ refreshTrigger, onDataChange }) => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('overview');
  const [editingReport, setEditingReport] = useState(null);
  const [fullscreenWorkspace, setFullscreenWorkspace] = useState(false);
  const [projectStats, setProjectStats] = useState({
    totalReports: 0,
    completedTasks: 0,
    totalTasks: 0,
    avgProgress: 0,
    loading: true
  });

  useEffect(() => {
    fetchProjects();
  }, [refreshTrigger]);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectStats(selectedProject.name);
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      console.log('🔍 프로젝트 목록 조회 시작...');
      const response = await projectAPI.getProjects();
      console.log('📊 API 응답:', response);
      console.log('📋 프로젝트 데이터:', response.data);
      
      setProjects(response.data || []);
      if (response.data && response.data.length > 0 && !selectedProject) {
        console.log('🎯 기본 프로젝트 선택:', response.data[0]);
        setSelectedProject(response.data[0]);
      } else if (!response.data || response.data.length === 0) {
        console.log('⚠️ 프로젝트 데이터가 없습니다.');
      }
    } catch (error) {
      console.error('❌ 프로젝트 목록 로드 실패:', error);
      console.error('상세 오류:', error.response?.data || error.message);
    }
  };

  const fetchProjectStats = async (projectName) => {
    try {
      setProjectStats(prev => ({ ...prev, loading: true }));
      console.log('📊 프로젝트 통계 조회 시작:', projectName);
      
      const response = await summaryAPI.getEnhancedProjectSummary(projectName);
      console.log('📈 통계 데이터:', response.data);
      
      if (response.data && response.data.found) {
        const { weekly_summary, task_summary } = response.data;
        
        setProjectStats({
          totalReports: weekly_summary.total_reports || 0,
          completedTasks: task_summary.completed_tasks || 0,
          totalTasks: task_summary.total_tasks || 0,
          avgProgress: task_summary.avg_progress || 0,
          loading: false
        });
      } else {
        setProjectStats({
          totalReports: 0,
          completedTasks: 0,
          totalTasks: 0,
          avgProgress: 0,
          loading: false
        });
      }
    } catch (error) {
      console.error('❌ 프로젝트 통계 로드 실패:', error);
      setProjectStats({
        totalReports: 0,
        completedTasks: 0,
        totalTasks: 0,
        avgProgress: 0,
        loading: false
      });
    }
  };

  const handleProjectChange = (project) => {
    setSelectedProject(project);
    setEditingReport(null);
    setActiveWorkspaceTab('overview');
  };

  const handleEditReport = (report) => {
    setEditingReport(report);
    setActiveWorkspaceTab('reports');
  };

  const handleSaveReport = () => {
    setEditingReport(null);
    onDataChange();
    if (selectedProject) {
      fetchProjectStats(selectedProject.name);
    }
  };

  const handleCancelEdit = () => {
    setEditingReport(null);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && fullscreenWorkspace) {
        setFullscreenWorkspace(false);
      }
    };

    if (fullscreenWorkspace) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [fullscreenWorkspace]);

  const workspaceTabs = [
    { id: 'overview', name: '프로젝트 개요', icon: '📊' },
    { id: 'reports', name: '주간 보고서', icon: '📝' },
    { id: 'tasks', name: '상세 업무', icon: '📋' },
    { id: 'timeline', name: '진행 타임라인', icon: '📅' },
    { id: 'wbs', name: 'WBS', icon: '🗂️' }, // WBS 탭 추가
  ];

  const renderWorkspaceContent = () => {
    if (!selectedProject) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-gray-400 text-6xl mb-4">🏗️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">프로젝트를 선택해주세요</h3>
            <p className="text-gray-500">워크스페이스를 시작하려면 프로젝트를 선택하거나 새로 생성하세요.</p>
          </div>
        </div>
      );
    }

    switch (activeWorkspaceTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📊 {selectedProject.name} 프로젝트 개요
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {projectStats.loading ? (
                      <div className="animate-pulse">
                        <div className="h-8 bg-blue-200 rounded w-8"></div>
                      </div>
                    ) : (
                      projectStats.totalReports
                    )}
                  </div>
                  <div className="text-sm text-blue-800">총 보고서 수</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {projectStats.loading ? (
                      <div className="animate-pulse">
                        <div className="h-8 bg-green-200 rounded w-8"></div>
                      </div>
                    ) : (
                      `${projectStats.completedTasks}/${projectStats.totalTasks}`
                    )}
                  </div>
                  <div className="text-sm text-green-800">완료된 업무</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {projectStats.loading ? (
                      <div className="animate-pulse">
                        <div className="h-8 bg-orange-200 rounded w-8"></div>
                      </div>
                    ) : (
                      `${projectStats.avgProgress}%`
                    )}
                  </div>
                  <div className="text-sm text-orange-800">전체 진행률</div>
                </div>
              </div>
            </div>
            <SummaryViewer 
              refreshTrigger={refreshTrigger} 
              projectFilter={selectedProject.name}
            />
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                📝 {selectedProject.name} 주간 보고서
              </h3>
                <button
                onClick={() => setEditingReport({})}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>새 보고서 작성</span>
                </button>
            </div>
            
            {editingReport !== null && (
              <div className="bg-white rounded-lg shadow mb-6">
                <WeeklyReportForm
                  editingReport={editingReport}
                  onSave={handleSaveReport}
                  onCancel={handleCancelEdit}
                  defaultProject={selectedProject?.name}
                />
              </div>
            )}
            
            <WeeklyReportList 
              onEdit={handleEditReport}
              refreshTrigger={refreshTrigger}
              projectFilter={selectedProject.name}
            />
          </div>
        );

      case 'tasks':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              📋 {selectedProject.name} 상세 업무
            </h3>
            <DetailedTaskSheet projectFilter={selectedProject.name} />
          </div>
        );

      case 'timeline':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              📅 {selectedProject.name} 진행 타임라인
            </h3>
            <ProjectTimeline 
              projectName={selectedProject.name} 
              refreshTrigger={refreshTrigger}
              />
          </div>
        );

      case 'wbs':
        return (
          <WBSWorkspaceTab project={selectedProject} />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">프로젝트 워크스페이스</h2>
                <p className="text-sm text-gray-600">프로젝트 중심의 집중 관리 환경</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={selectedProject?.id || ''}
                onChange={(e) => {
                  const projectId = parseInt(e.target.value);
                  const project = projects.find(p => p.id === projectId);
                  console.log('🔄 프로젝트 선택:', projectId, project);
                  handleProjectChange(project);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">프로젝트 선택</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {projects.length === 0 && (
                <div className="text-sm text-gray-500">
                  📋 프로젝트가 없습니다. 프로젝트 설정에서 먼저 프로젝트를 생성해주세요.
                </div>
              )}
              {selectedProject && (
                <button
                  onClick={() => setFullscreenWorkspace(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                  title="워크스페이스 풀스크린 보기 (ESC)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <span>풀스크린 보기</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {selectedProject && (
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {workspaceTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveWorkspaceTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeWorkspaceTab === tab.id
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      <span>{tab.icon}</span>
                      <span>{tab.name}</span>
                    </span>
                  </button>
                ))}
              </nav>
            </div>
            <div className="p-6">
              {renderWorkspaceContent()}
            </div>
          </div>
        )}
      </div>

      {fullscreenWorkspace && selectedProject && (
        <div className="fixed inset-0 bg-white z-50 overflow-auto">
          <div className="min-h-screen flex flex-col">
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 flex-shrink-0">
              <div className="w-full px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-4">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">
                        {selectedProject.name} 워크스페이스
                      </h1>
                      <p className="text-sm text-gray-600">
                        풀스크린 프로젝트 관리 환경
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFullscreenWorkspace(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="풀스크린 모드 종료 (ESC)"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full overflow-auto">
              <div className="w-full max-w-none">
                <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                  <div className="px-4 sm:px-6 lg:px-8">
                    <nav className="flex space-x-8">
                      {workspaceTabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveWorkspaceTab(tab.id)}
                          className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                            activeWorkspaceTab === tab.id
                              ? 'border-purple-500 text-purple-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <span className="flex items-center space-x-2">
                            <span>{tab.icon}</span>
                            <span>{tab.name}</span>
                          </span>
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>

                <div className="px-4 sm:px-6 lg:px-8 py-8">
                  {renderWorkspaceContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectWorkspace; 