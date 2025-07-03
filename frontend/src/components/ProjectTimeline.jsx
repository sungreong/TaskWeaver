import React, { useState, useEffect } from 'react';
import { summaryAPI } from '../services/api';

const ProjectTimeline = ({ projectName, refreshTrigger }) => {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    showMilestones: true,
    showReports: true,
    showTasks: true,
    showIssues: true
  });
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    if (projectName) {
      fetchTimelineData();
    }
  }, [projectName, refreshTrigger]);

  const fetchTimelineData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('📅 타임라인 데이터 로드 시작:', projectName);
      const response = await summaryAPI.getProjectTimeline(projectName);
      console.log('📊 타임라인 데이터:', response.data);
      
      if (response.data && response.data.found) {
        setTimelineData(response.data);
      } else {
        setTimelineData(null);
        setError('타임라인 데이터를 찾을 수 없습니다.');
      }
    } catch (err) {
      console.error('❌ 타임라인 데이터 로드 실패:', err);
      setError('타임라인 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (event) => {
    const colorMap = {
      green: 'bg-green-100 text-green-800 border-green-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colorMap[event.color] || colorMap.gray;
  };

  const getEventDotColor = (event) => {
    const dotColorMap = {
      green: 'bg-green-500',
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500',
      gray: 'bg-gray-500'
    };
    return dotColorMap[event.color] || dotColorMap.gray;
  };

  const shouldShowEvent = (event) => {
    if (!filters.showMilestones && event.type === 'milestone') return false;
    if (!filters.showReports && event.type === 'report') return false;
    if (!filters.showTasks && event.type === 'task') return false;
    if (!filters.showIssues && (event.color === 'orange' || event.color === 'red')) return false;
    return true;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const filteredEvents = timelineData?.timeline_events?.filter(shouldShowEvent) || [];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-8 h-8 bg-gray-200 rounded"></div>
            <div className="h-6 bg-gray-200 rounded w-48"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-4 h-4 bg-gray-200 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !timelineData) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📅</div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">타임라인 데이터 없음</h4>
          <p className="text-gray-500">{error || '표시할 타임라인 데이터가 없습니다.'}</p>
          <button
            onClick={fetchTimelineData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 프로젝트 정보 헤더 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                📅 {timelineData.project_info.name} 프로젝트 타임라인
              </h3>
              <p className="text-sm text-gray-600">
                {timelineData.project_info.description || '프로젝트 진행 상황을 시간순으로 확인'}
              </p>
            </div>
          </div>

          {/* 필터 토글 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">필터:</span>
              {[
                { key: 'showMilestones', label: '마일스톤', color: 'green' },
                { key: 'showReports', label: '보고서', color: 'blue' },
                { key: 'showTasks', label: '업무', color: 'gray' },
                { key: 'showIssues', label: '이슈', color: 'orange' }
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setFilters(prev => ({ ...prev, [filter.key]: !prev[filter.key] }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filters[filter.key]
                      ? `bg-${filter.color}-100 text-${filter.color}-800 border border-${filter.color}-200`
                      : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 프로젝트 요약 정보 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{timelineData.summary.total_events}</div>
            <div className="text-sm text-gray-600">총 이벤트</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{timelineData.summary.completed_tasks}</div>
            <div className="text-sm text-gray-600">완료 업무</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{timelineData.summary.issues_count}</div>
            <div className="text-sm text-gray-600">이슈/리스크</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {timelineData.summary.date_range.start && timelineData.summary.date_range.end
                ? Math.ceil((new Date(timelineData.summary.date_range.end) - new Date(timelineData.summary.date_range.start)) / (1000 * 60 * 60 * 24))
                : 0}일
            </div>
            <div className="text-sm text-gray-600">프로젝트 기간</div>
          </div>
        </div>
      </div>

      {/* 타임라인 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-6">타임라인 이벤트</h4>
        
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">🔍</div>
            <p className="text-gray-500">필터 조건에 맞는 이벤트가 없습니다.</p>
          </div>
        ) : (
          <div className="relative">
            {/* 타임라인 선 */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
            
            {/* 타임라인 이벤트들 */}
            <div className="space-y-6">
              {filteredEvents.map((event, index) => (
                <div key={index} className="relative flex items-start space-x-4">
                  {/* 타임라인 점 */}
                  <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 border-white shadow-sm ${getEventDotColor(event)}`}>
                    <span className="text-white text-lg">{event.icon}</span>
                  </div>
                  
                  {/* 이벤트 내용 */}
                  <div className="flex-1 min-w-0">
                    <div 
                      onClick={() => setSelectedEvent(selectedEvent === index ? null : index)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${getEventColor(event)} ${
                        selectedEvent === index ? 'ring-2 ring-purple-300' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h5 className="font-semibold">{event.title}</h5>
                            <span className="text-xs px-2 py-1 bg-white bg-opacity-50 rounded">
                              {event.type}
                            </span>
                          </div>
                          <p className="text-sm mb-2">{event.description}</p>
                          <div className="text-xs text-gray-600">
                            📅 {formatDate(event.date)}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <svg 
                            className={`w-5 h-5 transform transition-transform ${selectedEvent === index ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* 확장된 세부 정보 */}
                      {selectedEvent === index && event.metadata && (
                        <div className="mt-4 pt-4 border-t border-white border-opacity-30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {Object.entries(event.metadata).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>
                                <span>{typeof value === 'boolean' ? (value ? '예' : '아니오') : value || '없음'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 진행률 추이 그래프 (간단한 버전) */}
      {timelineData.progress_trend && timelineData.progress_trend.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">진행률 추이</h4>
          <div className="space-y-2">
            {timelineData.progress_trend.map((trend, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="text-sm text-gray-600 w-24">
                  {formatDate(trend.date)}
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-2 relative">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${trend.progress}%` }}
                  ></div>
                </div>
                <div className="text-sm font-medium text-gray-900 w-12">
                  {trend.progress}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectTimeline; 