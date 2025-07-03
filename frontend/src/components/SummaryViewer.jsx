import React, { useState, useEffect } from 'react';
import { summaryAPI, detailedTaskAPI } from '../services/api';

const SummaryViewer = ({ refreshTrigger }) => {
  const [activeTab, setActiveTab] = useState('enhanced');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 🆕 종합 대시보드 데이터 (상세 업무 포함)
  const [enhancedDashboard, setEnhancedDashboard] = useState(null);
  
  // 기존 대시보드 데이터
  const [dashboard, setDashboard] = useState(null);
  
  // 프로젝트별 요약
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectSummary, setProjectSummary] = useState(null);
  const [enhancedProjectSummary, setEnhancedProjectSummary] = useState(null);
  
  // 주차별 요약
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [weeklySummary, setWeeklySummary] = useState(null);
  
  // 🆕 담당자별 요약
  const [assignees, setAssignees] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [assigneeSummary, setAssigneeSummary] = useState(null);

  // 🆕 종합 대시보드 데이터 조회 (상세 업무 포함)
  const fetchEnhancedDashboard = async () => {
    try {
      setLoading(true);
      const response = await summaryAPI.getEnhancedDashboard();
      setEnhancedDashboard(response.data);
      setError('');
    } catch (err) {
      setError('종합 대시보드 정보를 불러오는 중 오류가 발생했습니다.');
      console.error('Fetch enhanced dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 기존 대시보드 데이터 조회
  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await summaryAPI.getDashboard();
      setDashboard(response.data);
      setError('');
    } catch (err) {
      setError('대시보드 정보를 불러오는 중 오류가 발생했습니다.');
      console.error('Fetch dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 프로젝트 목록 조회
  const fetchProjects = async () => {
    try {
      const response = await summaryAPI.getProjects();
      setProjects(response.data || []);
    } catch (err) {
      console.error('Fetch projects error:', err);
    }
  };

  // 주차 목록 조회
  const fetchWeeks = async () => {
    try {
      const response = await summaryAPI.getWeeks();
      setWeeks(response.data || []);
    } catch (err) {
      console.error('Fetch weeks error:', err);
    }
  };

  // 프로젝트별 요약 조회
  const fetchProjectSummary = async (projectName) => {
    if (!projectName) return;
    
    try {
      setLoading(true);
      const response = await summaryAPI.getProjectSummary(projectName);
      setProjectSummary(response.data);
      setError('');
    } catch (err) {
      setError('프로젝트 요약 정보를 불러오는 중 오류가 발생했습니다.');
      console.error('Fetch project summary error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 🆕 프로젝트별 상세 요약 조회 (상세 업무 포함)
  const fetchEnhancedProjectSummary = async (projectName) => {
    if (!projectName) return;
    
    try {
      setLoading(true);
      const response = await summaryAPI.getEnhancedProjectSummary(projectName);
      setEnhancedProjectSummary(response.data);
      setError('');
    } catch (err) {
      setError('프로젝트 상세 요약 정보를 불러오는 중 오류가 발생했습니다.');
      console.error('Fetch enhanced project summary error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 🆕 담당자별 요약 조회
  const fetchAssigneeSummary = async (assigneeName) => {
    if (!assigneeName) return;
    
    try {
      setLoading(true);
      const response = await summaryAPI.getAssigneeSummary(assigneeName);
      setAssigneeSummary(response.data);
      setError('');
    } catch (err) {
      setError('담당자 요약 정보를 불러오는 중 오류가 발생했습니다.');
      console.error('Fetch assignee summary error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 🆕 담당자 목록 조회 (상세 업무에서 추출)
  const fetchAssignees = async () => {
    try {
      const response = await detailedTaskAPI.getAllDetailedTasks();
      const allTasks = response.data || [];
      const uniqueAssignees = [...new Set(
        allTasks
          .map(task => task.assignee)
          .filter(assignee => assignee && assignee.trim() !== '')
      )].sort();
      setAssignees(uniqueAssignees);
    } catch (err) {
      console.error('Fetch assignees error:', err);
    }
  };

  // 주차별 요약 조회
  const fetchWeeklySummary = async (week) => {
    if (!week) return;
    
    try {
      setLoading(true);
      const response = await summaryAPI.getWeeklySummary(week);
      setWeeklySummary(response.data);
      setError('');
    } catch (err) {
      setError('주차별 요약 정보를 불러오는 중 오류가 발생했습니다.');
      console.error('Fetch weekly summary error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchWeeks();
    fetchAssignees(); // 🆕 담당자 목록 조회
    if (activeTab === 'enhanced') {
      fetchEnhancedDashboard();
    } else if (activeTab === 'dashboard') {
      fetchDashboard();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    if (activeTab === 'enhanced') {
      fetchEnhancedDashboard();
    } else if (activeTab === 'dashboard') {
      fetchDashboard();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'project' && selectedProject) {
      fetchProjectSummary(selectedProject);
      fetchEnhancedProjectSummary(selectedProject); // 🆕 상세 요약도 함께 조회
    }
  }, [selectedProject, activeTab]);

  useEffect(() => {
    if (activeTab === 'weekly' && selectedWeek) {
      fetchWeeklySummary(selectedWeek);
    }
  }, [selectedWeek, activeTab]);

  useEffect(() => {
    if (activeTab === 'assignee' && selectedAssignee) {
      fetchAssigneeSummary(selectedAssignee);
    }
  }, [selectedAssignee, activeTab]);

  // 탭 변경 핸들러
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
  };

  // 텍스트 줄여서 표시
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => handleTabChange('enhanced')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'enhanced'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 종합 대시보드
            </button>
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📝 주간 보고서
            </button>
            <button
              onClick={() => handleTabChange('project')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'project'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🏗️ 프로젝트 분석
            </button>
            <button
              onClick={() => handleTabChange('weekly')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'weekly'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📆 주차별 분석
            </button>
            <button
              onClick={() => handleTabChange('assignee')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'assignee'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              👥 팀원 성과 분석
            </button>
          </nav>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">로딩 중...</span>
          </div>
        )}

        {/* 🆕 종합 대시보드 탭 (상세 업무 포함) */}
        {activeTab === 'enhanced' && !loading && enhancedDashboard && (
          <div className="mt-6 space-y-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              📊 종합 프로젝트 현황 대시보드
              <span className="text-sm font-normal text-gray-500">(주간 보고서 + 상세 업무 통합)</span>
            </h3>
            
            {/* 전체 개요 통계 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-600 font-medium">🏗️ 총 프로젝트</div>
                <div className="text-2xl font-bold text-blue-900">{enhancedDashboard.overview.total_projects}</div>
              </div>
              
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                <div className="text-sm text-green-600 font-medium">✅ 총 상세 업무</div>
                <div className="text-2xl font-bold text-green-900">{enhancedDashboard.overview.total_detailed_tasks}</div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                <div className="text-sm text-purple-600 font-medium">📈 평균 진행률</div>
                <div className="text-2xl font-bold text-purple-900">{enhancedDashboard.overview.avg_task_progress}%</div>
              </div>
              
              <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                <div className="text-sm text-red-600 font-medium">🚨 리스크 업무</div>
                <div className="text-2xl font-bold text-red-900">{enhancedDashboard.overview.tasks_with_risk}</div>
              </div>
            </div>

            {/* 상세 업무 통계 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 업무 상태 분포 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">⚡ 업무 상태 분포</h4>
                <div className="space-y-3">
                  {Object.entries(enhancedDashboard.task_statistics.status_distribution).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {status === 'not_started' && '⏳ 시작 전'}
                        {status === 'in_progress' && '⚡ 진행 중'}
                        {status === 'completed' && '✅ 완료'}
                        {status === 'on_hold' && '⏸️ 보류'}
                        {status === 'cancelled' && '❌ 취소'}
                      </span>
                      <span className="font-medium text-gray-900">{count}개</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 진행률 분포 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">📊 진행률 분포</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">⏳ 시작 전 (0%)</span>
                    <span className="font-medium text-gray-900">{enhancedDashboard.task_statistics.progress_distribution.not_started}개</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">⚡ 진행 중 (1-99%)</span>
                    <span className="font-medium text-gray-900">{enhancedDashboard.task_statistics.progress_distribution.in_progress}개</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">✅ 완료 (100%)</span>
                    <span className="font-medium text-gray-900">{enhancedDashboard.task_statistics.progress_distribution.completed}개</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 담당자별 업무 분포 */}
            {enhancedDashboard.task_statistics.assignee_distribution.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">👥 팀원 업무 성과 현황 (상위 10명)</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">담당자</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">업무 수</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">평균 진행률</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {enhancedDashboard.task_statistics.assignee_distribution.map((assignee, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {assignee.assignee}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {assignee.task_count}개
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${assignee.avg_progress}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium">{assignee.avg_progress}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 프로젝트별 업무 현황 */}
            {enhancedDashboard.task_statistics.project_overview.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">📁 프로젝트별 업무 현황 (상위 5개)</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">프로젝트</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 업무</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">평균 진행률</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">리스크 업무</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {enhancedDashboard.task_statistics.project_overview.map((project, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {project.project}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {project.total_tasks}개
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-full" 
                                  style={{ width: `${project.avg_progress}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium">{project.avg_progress}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {project.risk_tasks > 0 ? (
                              <span className="text-red-600 font-medium">⚠️ {project.risk_tasks}개</span>
                            ) : (
                              <span className="text-green-600">✅ 없음</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 최근 업무 활동 */}
            {enhancedDashboard.recent_activities.task_updates.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">🔄 최근 업무 활동</h4>
                <div className="space-y-3">
                  {enhancedDashboard.recent_activities.task_updates.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{activity.task_item}</div>
                        <div className="text-sm text-gray-600">
                          {activity.project} • {activity.assignee || '미할당'}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">{activity.progress_rate}%</span>
                        <span className="text-xs text-gray-500">
                          {new Date(activity.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 기존 대시보드 탭 */}
        {activeTab === 'dashboard' && !loading && dashboard && (
          <div className="mt-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">전체 현황</h3>
            
            {/* 전체 통계 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">총 프로젝트 수</div>
                <div className="text-2xl font-bold text-blue-900">{dashboard.total_projects}</div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">총 보고서 수</div>
                <div className="text-2xl font-bold text-green-900">{dashboard.total_reports}</div>
              </div>
              
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-yellow-600 font-medium">활성 주차 수</div>
                <div className="text-2xl font-bold text-yellow-900">{dashboard.active_weeks}</div>
              </div>
              
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 font-medium">이슈가 있는 보고서</div>
                <div className="text-2xl font-bold text-red-900">{dashboard.reports_with_issues}</div>
              </div>
            </div>

            {/* 최근 활동 */}
            {dashboard.recent_reports && dashboard.recent_reports.length > 0 && (
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">최근 보고서 (최신 5개)</h4>
                <div className="space-y-2">
                  {dashboard.recent_reports.map((report, index) => (
                    <div key={index} className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium text-gray-900">{report.project}</span>
                        <span className="text-gray-400 mx-2">•</span>
                        <span className="text-sm text-gray-600">{report.week}</span>
                        <span className="text-gray-400 mx-2">•</span>
                        <span className="text-sm text-gray-600">{report.stage}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(report.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 프로젝트별 요약 탭 */}
        {activeTab === 'project' && (
          <div className="mt-6 space-y-6">
            <div>
              <label htmlFor="projectSelect" className="block text-sm font-medium text-gray-700 mb-2">
                프로젝트 선택
              </label>
              <select
                id="projectSelect"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="form-select w-full md:w-1/2"
              >
                <option value="">프로젝트를 선택하세요</option>
                {projects.map((project) => (
                  <option key={project.name} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {!loading && projectSummary && selectedProject && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">{selectedProject} - 프로젝트 요약</h3>
                
                {/* 프로젝트 통계 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 font-medium">총 주차 수</div>
                    <div className="text-2xl font-bold text-blue-900">{projectSummary.total_weeks}</div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-green-600 font-medium">진행 중인 단계</div>
                    <div className="text-2xl font-bold text-green-900">{projectSummary.active_stages}</div>
                  </div>
                  
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-sm text-red-600 font-medium">현재 이슈 수</div>
                    <div className="text-2xl font-bold text-red-900">{projectSummary.current_issues}</div>
                  </div>
                </div>

                {/* 최신 주차 및 단계 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 font-medium">최신 주차</div>
                    <div className="text-lg font-bold text-gray-900">{projectSummary.latest_week}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 font-medium">진행 단계</div>
                    <div className="text-sm text-gray-900">{projectSummary.stages?.join(', ')}</div>
                  </div>
                </div>

                {/* 최근 보고서 */}
                {projectSummary.recent_reports && projectSummary.recent_reports.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3">최근 보고서</h4>
                    <div className="space-y-3">
                      {projectSummary.recent_reports.map((report, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                                {report.week}
                              </span>
                              <span className="ml-2 text-gray-600">{report.stage}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(report.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-sm text-gray-700">
                            {truncateText(report.this_week_work, 150)}
                          </div>
                          {report.issues_risks && (
                            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                              이슈: {truncateText(report.issues_risks, 100)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 주차별 요약 탭 */}
        {activeTab === 'weekly' && (
          <div className="mt-6 space-y-6">
            <div>
              <label htmlFor="weekSelect" className="block text-sm font-medium text-gray-700 mb-2">
                주차 선택
              </label>
              <select
                id="weekSelect"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="form-select w-full md:w-1/2"
              >
                <option value="">주차를 선택하세요</option>
                {weeks.map((week) => (
                  <option key={week} value={week}>
                    {week}
                  </option>
                ))}
              </select>
            </div>

            {!loading && weeklySummary && selectedWeek && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">{selectedWeek} - 주차별 요약</h3>
                
                {/* 주차별 통계 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 font-medium">참여 프로젝트 수</div>
                    <div className="text-2xl font-bold text-blue-900">{weeklySummary.total_projects}</div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-green-600 font-medium">총 보고서 수</div>
                    <div className="text-2xl font-bold text-green-900">{weeklySummary.total_reports}</div>
                  </div>
                  
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-sm text-red-600 font-medium">이슈가 있는 프로젝트</div>
                    <div className="text-2xl font-bold text-red-900">{weeklySummary.projects_with_issues}</div>
                  </div>
                </div>

                {/* 프로젝트 목록 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 font-medium">참여 프로젝트</div>
                  <div className="text-sm text-gray-900 mt-1">{weeklySummary.project_list?.join(', ')}</div>
                </div>

                {/* 주차별 보고서 목록 */}
                {weeklySummary.reports && weeklySummary.reports.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3">이 주차의 모든 보고서</h4>
                    <div className="space-y-3">
                      {weeklySummary.reports.map((report, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium text-gray-900">{report.project}</span>
                              <span className="text-gray-400 mx-2">•</span>
                              <span className="text-gray-600">{report.stage}</span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-700">
                            {truncateText(report.this_week_work, 150)}
                          </div>
                          {report.issues_risks && (
                            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                              이슈: {truncateText(report.issues_risks, 100)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 🆕 담당자별 요약 탭 */}
        {activeTab === 'assignee' && (
          <div className="mt-6 space-y-6">
            <div>
              <label htmlFor="assigneeSelect" className="block text-sm font-medium text-gray-700 mb-2">
                담당자 선택
              </label>
              <select
                id="assigneeSelect"
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="form-select w-full md:w-1/2"
              >
                <option value="">담당자를 선택하세요</option>
                {assignees.map((assignee) => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
            </div>

            {!loading && assigneeSummary && selectedAssignee && assigneeSummary.found && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  👤 {selectedAssignee} - 담당 업무 현황
                </h3>
                
                {/* 담당자 업무 통계 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 font-medium">총 업무 수</div>
                    <div className="text-2xl font-bold text-blue-900">{assigneeSummary.overview.total_tasks}</div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-green-600 font-medium">완료된 업무</div>
                    <div className="text-2xl font-bold text-green-900">{assigneeSummary.overview.completed_tasks}</div>
                  </div>
                  
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="text-sm text-yellow-600 font-medium">진행 중인 업무</div>
                    <div className="text-2xl font-bold text-yellow-900">{assigneeSummary.overview.in_progress_tasks}</div>
                  </div>
                  
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-sm text-red-600 font-medium">리스크 업무</div>
                    <div className="text-2xl font-bold text-red-900">{assigneeSummary.overview.tasks_with_risk}</div>
                  </div>
                </div>

                {/* 평균 진행률 */}
                <div className="bg-purple-50 rounded-lg p-6">
                  <div className="text-sm text-purple-600 font-medium mb-2">전체 평균 진행률</div>
                  <div className="flex items-center">
                    <div className="flex-1 bg-purple-200 rounded-full h-4 mr-4">
                      <div 
                        className="bg-purple-600 h-4 rounded-full" 
                        style={{ width: `${assigneeSummary.overview.avg_progress}%` }}
                      ></div>
                    </div>
                    <span className="text-2xl font-bold text-purple-900">{assigneeSummary.overview.avg_progress}%</span>
                  </div>
                </div>

                {/* 프로젝트별 업무 분포 */}
                {Object.keys(assigneeSummary.project_distribution).length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">📁 프로젝트별 업무 분포</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">프로젝트</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 업무</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">완료</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">진행 중</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">평균 진행률</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">리스크</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.entries(assigneeSummary.project_distribution).map(([project, stats]) => (
                            <tr key={project} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {project}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {stats.total}개
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span className="text-green-600">{stats.completed}개</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span className="text-yellow-600">{stats.in_progress}개</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                    <div 
                                      className="bg-blue-600 h-2 rounded-full" 
                                      style={{ width: `${stats.avg_progress}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-medium">{stats.avg_progress}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {stats.with_risk > 0 ? (
                                  <span className="text-red-600 font-medium">⚠️ {stats.with_risk}개</span>
                                ) : (
                                  <span className="text-green-600">✅ 없음</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 최근 업무 목록 */}
                {assigneeSummary.recent_tasks && assigneeSummary.recent_tasks.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">🔄 최근 업무 목록 (최신 10개)</h4>
                    <div className="space-y-3">
                      {assigneeSummary.recent_tasks.map((task, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{task.task_item}</div>
                            <div className="text-sm text-gray-600">
                              {task.project} • {task.stage || '단계 미정'}
                              {task.planned_end_date && (
                                <span className="ml-2 text-xs text-gray-500">
                                  예정일: {task.planned_end_date}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-center">
                              <div className="text-sm font-medium text-gray-900">{task.progress_rate}%</div>
                              <div className="text-xs text-gray-500">
                                {task.current_status === 'not_started' && '시작 전'}
                                {task.current_status === 'in_progress' && '진행 중'}
                                {task.current_status === 'completed' && '완료'}
                                {task.current_status === 'on_hold' && '보류'}
                                {task.current_status === 'cancelled' && '취소'}
                              </div>
                            </div>
                            {task.has_risk && (
                              <span className="text-red-500 text-sm">⚠️</span>
                            )}
                            <div className="text-xs text-gray-500">
                              {new Date(task.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loading && assigneeSummary && selectedAssignee && !assigneeSummary.found && (
              <div className="text-center py-8">
                <div className="text-gray-500 text-lg">해당 담당자의 업무를 찾을 수 없습니다.</div>
                <div className="text-gray-400 text-sm mt-2">{assigneeSummary.message}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryViewer; 