import React, { useState } from 'react';
import './App.css';
import WeeklyReportForm from './components/WeeklyReportForm';
import WeeklyReportList from './components/WeeklyReportList';
import SummaryViewer from './components/SummaryViewer';
import CSVDownloadButton from './components/CSVDownloadButton';
import ProjectManager from './components/ProjectManager';
import DetailedTaskSheet from './components/DetailedTaskSheet';
import ProjectWorkspace from './components/ProjectWorkspace';

function App() {
  const [activeTab, setActiveTab] = useState('form');
  const [activeSubTab, setActiveSubTab] = useState('list');
  const [editingReport, setEditingReport] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleDataChange = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSaveReport = () => {
    setEditingReport(null);
    handleDataChange();
    setActiveTab('management');
    setActiveSubTab('list');
  };

  const handleEditReport = (report) => {
    setEditingReport(report);
    setActiveTab('form');
  };

  const handleCancelEdit = () => {
    setEditingReport(null);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'management') {
      setActiveSubTab('list');
    }
  };

  const tabs = [
    {
      id: 'form',
      name: '보고서 작성',
      description: '새로운 주차별 보고서 작성 및 편집',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      primary: true
    },
    {
      id: 'workspace',
      name: '프로젝트 워크스페이스',
      description: '프로젝트 중심의 집중 관리 환경',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      primary: true
    },
    {
      id: 'management',
      name: '보고서 관리',
      description: '보고서 목록 조회 및 상세 업무 시트',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 4h6m-6 4h6m-6 4h6" />
        </svg>
      ),
      primary: true,
      subTabs: [
        { id: 'list', name: '보고서 목록', icon: '📋' },
        { id: 'tasks', name: '상세 업무 시트', icon: '📊' }
      ]
    },
    {
      id: 'dashboard',
      name: '요약 대시보드',
      description: '프로젝트 현황 및 통계 요약',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      primary: true
    },
    {
      id: 'settings',
      name: '프로젝트 설정',
      description: '프로젝트 관리 및 시스템 설정',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      primary: true
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'form':
        return <WeeklyReportForm
          editingReport={editingReport}
          onSave={handleSaveReport}
          onCancel={editingReport ? handleCancelEdit : null}
        />;
      case 'workspace':
        return <ProjectWorkspace 
          refreshTrigger={refreshTrigger}
          onDataChange={handleDataChange}
        />;
      case 'management':
        return (
          <div className="space-y-4">
            {activeSubTab === 'list' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">보고서 목록</h2>
                  <CSVDownloadButton variant="compact" />
                </div>
                <WeeklyReportList 
                  onEdit={handleEditReport} 
                  refreshTrigger={refreshTrigger}
                />
              </div>
            )}
            {activeSubTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">상세 업무 시트</h2>
                  <CSVDownloadButton variant="compact" />
                </div>
                <DetailedTaskSheet />
              </div>
            )}
          </div>
        );
      case 'dashboard':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">요약 대시보드</h2>
              <CSVDownloadButton variant="compact" />
            </div>
            <SummaryViewer refreshTrigger={refreshTrigger} />
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">프로젝트 설정</h2>
            <ProjectManager onProjectChange={handleDataChange} />
          </div>
        );
      default:
        return <WeeklyReportForm
          editingReport={editingReport}
          onSave={handleSaveReport}
          onCancel={editingReport ? handleCancelEdit : null}
        />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 사이드바 */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white shadow-lg border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-3 ${sidebarCollapsed ? 'hidden' : ''}`}>
              <div className="p-2 bg-blue-600 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Project Tracker
                </h1>
                <p className="text-xs text-gray-600">
                  프로젝트 관리 시스템
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              title={sidebarCollapsed ? '사이드바 확장' : '사이드바 축소'}
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
              </svg>
            </button>
          </div>
        </div>

        {/* 네비게이션 메뉴 */}
        <nav className="flex-1 p-4 space-y-2">
          {tabs.map((tab) => (
            <div key={tab.id}>
              <button
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                title={sidebarCollapsed ? tab.name : tab.description}
              >
                {tab.icon}
                <span className={`font-medium ${sidebarCollapsed ? 'hidden' : ''}`}>
                  {tab.name}
                </span>
                {tab.subTabs && !sidebarCollapsed && (
                  <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              
              {/* 서브메뉴 */}
              {tab.subTabs && activeTab === tab.id && !sidebarCollapsed && (
                <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-200 pl-4">
                  {tab.subTabs.map((subTab) => (
                    <button
                      key={subTab.id}
                      onClick={() => setActiveSubTab(subTab.id)}
                      className={`w-full flex items-center space-x-2 px-3 py-1 rounded text-sm text-left transition-colors ${
                        activeSubTab === subTab.id
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{subTab.icon}</span>
                      <span>{subTab.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* 푸터 */}
        <div className={`p-4 border-t border-gray-200 ${sidebarCollapsed ? 'hidden' : ''}`}>
          <div className="text-xs text-gray-500 space-y-1">
            <div>{new Date().toLocaleDateString('ko-KR', { 
              year: 'numeric', 
              month: '2-digit', 
              day: '2-digit',
              weekday: 'short'
            })}</div>
            <div className="text-gray-400">v1.0.0</div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 상단 헤더 */}
        <header className="bg-white shadow-sm border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {tabs.find(tab => tab.id === activeTab)?.name || '대시보드'}
              </h2>
              <div className="text-sm text-gray-500">
                {tabs.find(tab => tab.id === activeTab)?.description}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500 hidden sm:block">
                Weekly Project Tracker
              </div>
            </div>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-none">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;