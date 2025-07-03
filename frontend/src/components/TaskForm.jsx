import React, { useState, useEffect } from 'react';
import { weeklyReportAPI, utilsAPI } from '../services/api';

const WeeklyReportForm = ({ onReportChange, editingReport, onCancelEdit }) => {
  const [formData, setFormData] = useState({
    project: '',
    week: '',
    stage: '',
    this_week_work: '',
    next_week_plan: '',
    issues_risks: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [allWeeks, setAllWeeks] = useState([]);
  const [recentWeeks, setRecentWeeks] = useState([]);
  const [currentWeek, setCurrentWeek] = useState('');

  // 주차 목록 및 현재 주차 설정
  useEffect(() => {
    const current = utilsAPI.getCurrentWeek();
    const recent = utilsAPI.getRecentWeeks();
    const all = utilsAPI.getAllRecentWeeks();
    
    setCurrentWeek(current);
    setRecentWeeks(recent);
    setAllWeeks(all);
    
    // 현재 주차를 기본값으로 설정 (새로 작성할 때만)
    if (!editingReport) {
      setFormData(prev => ({
        ...prev,
        week: current
      }));
    }
  }, [editingReport]);

  // 편집 모드일 때 폼 데이터 설정
  useEffect(() => {
    if (editingReport) {
      setFormData({
        project: editingReport.project || '',
        week: editingReport.week || '',
        stage: editingReport.stage || '',
        this_week_work: editingReport.this_week_work || '',
        next_week_plan: editingReport.next_week_plan || '',
        issues_risks: editingReport.issues_risks || ''
      });
    } else {
      resetForm();
    }
  }, [editingReport]);

  const resetForm = () => {
    setFormData({
      project: '',
      week: currentWeek,
      stage: '',
      this_week_work: '',
      next_week_plan: '',
      issues_risks: ''
    });
    setError('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // 주차 형식 검증
    if (!utilsAPI.isValidWeekFormat(formData.week)) {
      setError('주차는 YYYY-WXX 형식으로 입력해주세요 (예: 2024-W01)');
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingReport) {
        await weeklyReportAPI.updateWeeklyReport(editingReport.id, formData);
      } else {
        await weeklyReportAPI.createWeeklyReport(formData);
      }
      
      onReportChange();
      if (editingReport && onCancelEdit) {
        onCancelEdit();
      } else {
        resetForm();
      }
    } catch (err) {
      setError(err.response?.data?.detail || '주차별 보고서 저장 중 오류가 발생했습니다.');
      console.error('Weekly report save error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancelEdit) {
      onCancelEdit();
    } else {
      resetForm();
    }
  };

  const setToCurrentWeek = () => {
    setFormData(prev => ({
      ...prev,
      week: currentWeek
    }));
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {editingReport ? '주차별 보고서 수정' : '새 주차별 보고서 등록'}
        </h2>
        {!editingReport && (
          <div className="text-sm text-gray-500">
            현재 주차: <span className="font-medium text-blue-600">{utilsAPI.formatWeekDisplay(currentWeek)}</span>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 첫 번째 행: 프로젝트, 주차, 단계 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-2">
              프로젝트 *
            </label>
            <input
              type="text"
              id="project"
              name="project"
              required
              value={formData.project}
              onChange={handleChange}
              className="form-input"
              placeholder="프로젝트명을 입력하세요"
            />
          </div>

          <div>
            <label htmlFor="week" className="block text-sm font-medium text-gray-700 mb-2">
              주차 *
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  id="week"
                  name="week"
                  value={formData.week}
                  onChange={handleChange}
                  className="form-select flex-1"
                >
                  <optgroup label="최근 주차">
                    {recentWeeks.map(week => (
                      <option key={week} value={week}>
                        {utilsAPI.formatWeekDisplay(week)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="올해 전체">
                    {allWeeks.filter(week => week.startsWith(new Date().getFullYear().toString())).map(week => (
                      <option key={week} value={week}>
                        {utilsAPI.formatWeekDisplay(week)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="내년">
                    {allWeeks.filter(week => week.startsWith((new Date().getFullYear() + 1).toString())).map(week => (
                      <option key={week} value={week}>
                        {utilsAPI.formatWeekDisplay(week)}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  onClick={setToCurrentWeek}
                  className="px-3 py-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors whitespace-nowrap"
                  title="현재 주차로 설정"
                >
                  현재
                </button>
              </div>
              <input
                type="text"
                name="week"
                value={formData.week}
                onChange={handleChange}
                className="form-input text-sm"
                placeholder="또는 직접 입력 (예: 2024-W01)"
                pattern="\d{4}-W\d{2}"
              />
            </div>
          </div>

          <div>
            <label htmlFor="stage" className="block text-sm font-medium text-gray-700 mb-2">
              단계/단위 *
            </label>
            <input
              type="text"
              id="stage"
              name="stage"
              required
              value={formData.stage}
              onChange={handleChange}
              className="form-input"
              placeholder="예: 설계, 개발, 테스트"
            />
          </div>
        </div>

        {/* 두 번째 행: 이번 주 한 일 */}
        <div>
          <label htmlFor="this_week_work" className="block text-sm font-medium text-gray-700 mb-2">
            이번 주 한 일 *
          </label>
          <textarea
            id="this_week_work"
            name="this_week_work"
            required
            rows={5}
            value={formData.this_week_work}
            onChange={handleChange}
            className="form-input"
            placeholder="이번 주에 수행한 작업 내용을 자세히 입력하세요&#10;&#10;• 마크다운 형식 지원 (*, -, #, ** 등)&#10;• 여러 작업은 리스트로 정리&#10;• 구체적인 성과나 결과물 포함"
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 마크다운 형식으로 작성 가능합니다. (* 리스트, ** 볼드, # 제목 등)
          </p>
        </div>

        {/* 세 번째 행: 다음 주 계획, 이슈/리스크 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label htmlFor="next_week_plan" className="block text-sm font-medium text-gray-700 mb-2">
              다음 주 계획
            </label>
            <textarea
              id="next_week_plan"
              name="next_week_plan"
              rows={4}
              value={formData.next_week_plan}
              onChange={handleChange}
              className="form-input"
              placeholder="다음 주에 계획하고 있는 작업&#10;&#10;• 구체적인 목표 설정&#10;• 우선순위 표시&#10;• 예상 소요 시간"
            />
          </div>

          <div>
            <label htmlFor="issues_risks" className="block text-sm font-medium text-gray-700 mb-2">
              이슈/리스크
            </label>
            <textarea
              id="issues_risks"
              name="issues_risks"
              rows={4}
              value={formData.issues_risks}
              onChange={handleChange}
              className="form-input"
              placeholder="발생한 이슈나 예상되는 리스크&#10;&#10;• 기술적 문제점&#10;• 일정 지연 요인&#10;• 리소스 부족&#10;• 외부 의존성"
            />
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleCancel}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? '저장 중...' : (editingReport ? '수정 완료' : '등록')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default WeeklyReportForm; 