import React, { useState, useEffect } from 'react';
import { exportAPI, summaryAPI } from '../services/api';

const CSVDownloadButton = ({ className = '', variant = 'default' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [downloadType, setDownloadType] = useState('weekly-reports');
  const [isLoading, setIsLoading] = useState(false);
  
  // 필터 옵션들
  const [filters, setFilters] = useState({
    project: '',
    week: '',
    stage: '',
    start_week: '',
    end_week: ''
  });
  
  const [filterOptions, setFilterOptions] = useState({
    projects: [],
    weeks: [],
    stages: []
  });

  // 필터 옵션 로드
  useEffect(() => {
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
        console.error('Filter options fetch error:', err);
      }
    };

    fetchFilterOptions();
  }, []);

  const handleDownload = async () => {
    setIsLoading(true);
    let url;
    let filename;
    
    try {
      switch (downloadType) {
        case 'weekly-reports':
          url = exportAPI.getWeeklyReportsCSVUrl(filters);
          filename = 'weekly_reports.csv';
          break;
        case 'project-summary':
          url = exportAPI.getProjectSummaryCSVUrl();
          filename = 'project_summary.csv';
          break;
        case 'weekly-summary':
          url = exportAPI.getWeeklySummaryCSVUrl();
          filename = 'weekly_summary.csv';
          break;
        default:
          url = exportAPI.getWeeklyReportsCSVUrl();
          filename = 'weekly_reports.csv';
      }

      // 다운로드 실행
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsOpen(false);
    } catch (error) {
      console.error('Download error:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      project: '',
      week: '',
      stage: '',
      start_week: '',
      end_week: ''
    });
  };

  const getDownloadTypeLabel = (type) => {
    switch (type) {
      case 'weekly-reports':
        return '주차별 보고서';
      case 'project-summary':
        return '프로젝트 요약';
      case 'weekly-summary':
        return '주차별 요약';
      default:
        return '주차별 보고서';
    }
  };

  return (
    <div className="relative">
      {/* 메인 다운로드 버튼 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`${
            variant === 'compact' 
              ? 'px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm' 
              : 'btn-success'
          } ${className} flex items-center`}
          disabled={isLoading}
        >
          <svg
            className={`${variant === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} mr-2`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {isLoading ? '다운로드 중...' : variant === 'compact' ? 'CSV' : 'CSV 다운로드'}
          <svg
            className={`${variant === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} ml-2 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className={`absolute top-full ${variant === 'compact' ? 'right-0' : 'left-0'} mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50`}>
          <div className="p-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">CSV 다운로드 설정</h3>
            
            {/* 다운로드 타입 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">다운로드 유형</label>
              <select
                value={downloadType}
                onChange={(e) => setDownloadType(e.target.value)}
                className="form-select w-full"
              >
                <option value="weekly-reports">주차별 보고서 (상세)</option>
                <option value="project-summary">프로젝트 요약</option>
                <option value="weekly-summary">주차별 요약</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {downloadType === 'weekly-reports' && '모든 주차별 보고서의 상세 내용'}
                {downloadType === 'project-summary' && '프로젝트별 통계 및 요약 정보'}
                {downloadType === 'weekly-summary' && '주차별 통계 및 요약 정보'}
              </p>
            </div>

            {/* 필터 옵션 (주차별 보고서인 경우에만 표시) */}
            {downloadType === 'weekly-reports' && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">필터 옵션 (선택사항)</h4>
                
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">프로젝트</label>
                    <select
                      value={filters.project}
                      onChange={(e) => handleFilterChange('project', e.target.value)}
                      className="form-select text-sm w-full"
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">주차</label>
                    <select
                      value={filters.week}
                      onChange={(e) => handleFilterChange('week', e.target.value)}
                      className="form-select text-sm w-full"
                    >
                      <option value="">전체</option>
                      {filterOptions.weeks.map(week => (
                        <option key={week} value={week}>{week}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">단계</label>
                    <select
                      value={filters.stage}
                      onChange={(e) => handleFilterChange('stage', e.target.value)}
                      className="form-select text-sm w-full"
                    >
                      <option value="">전체</option>
                      {filterOptions.stages.map(stage => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">시작 주차</label>
                      <input
                        type="text"
                        value={filters.start_week}
                        onChange={(e) => handleFilterChange('start_week', e.target.value)}
                        className="form-input text-sm w-full"
                        placeholder="2024-W01"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">종료 주차</label>
                      <input
                        type="text"
                        value={filters.end_week}
                        onChange={(e) => handleFilterChange('end_week', e.target.value)}
                        className="form-input text-sm w-full"
                        placeholder="2024-W12"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={resetFilters}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  >
                    필터 초기화
                  </button>
                </div>
              </div>
            )}

            {/* 액션 버튼들 */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                disabled={isLoading}
              >
                취소
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    다운로드 중...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                    </svg>
                    {getDownloadTypeLabel(downloadType)} 다운로드
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 백그라운드 클릭 시 닫기 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default CSVDownloadButton; 