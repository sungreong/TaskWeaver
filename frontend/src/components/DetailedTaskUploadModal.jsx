import React, { useState, useRef } from 'react';
import { detailedTaskAPI } from '../services/api';

const DetailedTaskUploadModal = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [step, setStep] = useState('select'); // 'select', 'validate', 'upload', 'result'
  const fileInputRef = useRef(null);

  // 모달 초기화
  const resetModal = () => {
    setFile(null);
    setValidationResult(null);
    setUploadResult(null);
    setStep('select');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationResult(null);
      setUploadResult(null);
      setStep('select');
    }
  };

  // 파일 검증
  const handleValidateFile = async () => {
    if (!file) return;

    setLoading(true);
    setStep('validate');
    
    try {
      const response = await detailedTaskAPI.validateUploadFile(file);
      setValidationResult(response.data);
      
      if (response.data.success) {
        setStep('validated');
      }
    } catch (err) {
      setValidationResult({
        success: false,
        message: err.response?.data?.detail || '파일 검증 중 오류가 발생했습니다.',
        error: err.response?.data?.detail || err.message
      });
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // 파일 업로드
  const handleUploadFile = async () => {
    if (!file || !validationResult?.success) return;

    setLoading(true);
    setStep('upload');
    
    try {
      const response = await detailedTaskAPI.importDetailedTasks(file);
      setUploadResult(response.data);
      setStep('result');
      
      // 성공 시 부모 컴포넌트에 알림
      if (response.data.success && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setUploadResult({
        success: false,
        message: err.response?.data?.detail || '파일 업로드 중 오류가 발생했습니다.',
        error: err.response?.data?.detail || err.message
      });
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // 모달 닫기
  const handleClose = () => {
    if (!loading) {
      resetModal();
      onClose();
    }
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* 배경 오버레이 */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        />

        {/* 모달 콘텐츠 */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* 헤더 */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                📤 상세 업무 파일 업로드
              </h3>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 본문 */}
          <div className="px-6 py-4">
            {/* 파일 선택 단계 */}
            {(step === 'select' || step === 'validated') && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <div className="text-4xl mb-2">📁</div>
                      <div className="text-sm text-gray-600">
                        클릭하여 파일을 선택하거나 드래그 앤 드롭
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        지원 형식: CSV, Excel (.xlsx, .xls) | 최대 10MB
                      </div>
                    </label>
                  </div>

                  {file && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-blue-900">{file.name}</div>
                          <div className="text-sm text-blue-600">
                            {formatFileSize(file.size)} | {file.type || '알 수 없음'}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setFile(null);
                            setValidationResult(null);
                            setStep('select');
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 필수 컬럼 안내 */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-800 mb-2">📋 필수 컬럼</h4>
                  <div className="text-sm text-yellow-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>project</strong>: 프로젝트명</li>
                      <li><strong>stage</strong>: 단계</li>
                      <li><strong>task_item</strong>: 업무 항목</li>
                    </ul>
                  </div>
                </div>

                {/* 선택 컬럼 안내 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-2">⚙️ 선택 컬럼</h4>
                  <div className="text-sm text-blue-700">
                    <div className="grid grid-cols-2 gap-2">
                      <div>assignee (담당자)</div>
                      <div>current_status (현재 상태)</div>
                      <div>has_risk (리스크 여부)</div>
                      <div>description (설명)</div>
                      <div>planned_end_date (종료 예정일)</div>
                      <div>actual_end_date (실제 완료일)</div>
                      <div>progress_rate (진행률)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 검증 중 */}
            {step === 'validate' && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <div className="text-lg font-medium text-gray-900">파일 검증 중...</div>
                <div className="text-sm text-gray-500">파일 형식과 데이터를 확인하고 있습니다.</div>
              </div>
            )}

            {/* 검증 결과 */}
            {step === 'validated' && validationResult && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-2">✅ 파일 검증 완료</h4>
                  <div className="text-sm text-green-700">
                    <div>총 {validationResult.data.total_rows}개 행이 발견되었습니다.</div>
                    {validationResult.data.duplicate_count > 0 && (
                      <div className="text-yellow-600">
                        ⚠️ {validationResult.data.duplicate_count}개의 중복 데이터가 있습니다.
                      </div>
                    )}
                  </div>
                </div>

                {/* 샘플 데이터 */}
                {validationResult.data.sample_data.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">📊 샘플 데이터</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-gray-100">
                            {validationResult.data.columns.map(col => (
                              <th key={col} className="px-2 py-1 text-left font-medium text-gray-700 border">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {validationResult.data.sample_data.map((row, idx) => (
                            <tr key={idx} className="border-b">
                              {validationResult.data.columns.map(col => (
                                <td key={col} className="px-2 py-1 border text-gray-600">
                                  {String(row[col] || '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 업로드 중 */}
            {step === 'upload' && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <div className="text-lg font-medium text-gray-900">파일 업로드 중...</div>
                <div className="text-sm text-gray-500">데이터를 시스템에 등록하고 있습니다.</div>
              </div>
            )}

            {/* 업로드 결과 */}
            {step === 'result' && uploadResult && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-2">🎉 업로드 완료</h4>
                  <div className="text-sm text-green-700">
                    <div>✅ 성공: {uploadResult.data.successful_imports}개</div>
                    <div>❌ 실패: {uploadResult.data.failed_imports}개</div>
                    <div>📊 전체: {uploadResult.data.total_rows}개</div>
                  </div>
                </div>

                {/* 실패 상세 정보 */}
                {uploadResult.data.failed_details && uploadResult.data.failed_details.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-800 mb-2">❌ 실패 상세</h4>
                    <div className="space-y-2 text-sm text-red-700">
                      {uploadResult.data.failed_details.map((fail, idx) => (
                        <div key={idx} className="border-l-2 border-red-300 pl-2">
                          <div><strong>행 {fail.row}:</strong> {fail.project} - {fail.task_item}</div>
                          <div className="text-red-600">{fail.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 오류 표시 */}
            {step === 'error' && (validationResult?.error || uploadResult?.error) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">❌ 오류 발생</h4>
                <div className="text-sm text-red-700">
                  {validationResult?.error || uploadResult?.error}
                </div>
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {file && `선택된 파일: ${file.name}`}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
              >
                {step === 'result' ? '닫기' : '취소'}
              </button>
              
              {step === 'select' && file && (
                <button
                  onClick={handleValidateFile}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  파일 검증
                </button>
              )}
              
              {step === 'validated' && validationResult?.success && (
                <button
                  onClick={handleUploadFile}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                >
                  업로드 실행
                </button>
              )}
              
              {(step === 'error' || step === 'result') && (
                <button
                  onClick={resetModal}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  다시 업로드
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailedTaskUploadModal; 