
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

const EditReportModal = ({
  isOpen,
  onClose,
  onSave,
  content,
  setContent,
  columnLabel,
  reportInfo,
  isUpdating
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen && !isPreview) {
      // 모달이 열리고 편집 모드일 때, 텍스트 영역에 포커스 및 높이 조절
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      }, 100); // 애니메이션 시간 고려
    }
  }, [isOpen, isPreview]);

  // 고급 텍스트 에디터 기능들 (WeeklyReportList에서 가져옴)
  const insertTabAtCursor = useCallback((textarea, isShiftTab = false) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const lines = value.split('\n');
    
    let currentPos = 0;
    let startLine = -1, endLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1;
      if (start >= currentPos && start < currentPos + lineLength) {
        startLine = i;
      }
      if (end >= currentPos && end < currentPos + lineLength) {
        endLine = i;
      }
      if (startLine !== -1 && endLine !== -1) break;
      currentPos += lineLength;
    }

    if (startLine === -1) startLine = lines.length - 1;
    if (endLine === -1) endLine = lines.length - 1;

    const tabSize = 2;
    const tabString = ' '.repeat(tabSize);
    let newStart = start;
    let newEnd = end;

    for (let i = startLine; i <= endLine; i++) {
      if (isShiftTab) {
        if (lines[i].startsWith(tabString)) {
          lines[i] = lines[i].substring(tabSize);
          if (i === startLine) newStart = Math.max(start - tabSize, currentPos);
          newEnd -= tabSize;
        } else if (lines[i].startsWith(' ')) {
          lines[i] = lines[i].substring(1);
          if (i === startLine) newStart = Math.max(start - 1, currentPos);
          newEnd -= 1;
        }
      } else {
        lines[i] = tabString + lines[i];
        if (i === startLine) newStart = start + tabSize;
        newEnd += tabSize;
      }
    }
    
    const newValue = lines.join('\n');
    
    return {
      value: newValue,
      selectionStart: newStart,
      selectionEnd: newEnd
    };
  }, []);

  const handleAdvancedKeyDown = useCallback((e) => {
    const textarea = e.target;
    
    if (e.key === 'Tab') {
      e.preventDefault();
      const result = insertTabAtCursor(textarea, e.shiftKey);
      setContent(result.value);
      
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = result.selectionStart;
          textareaRef.current.selectionEnd = result.selectionEnd;
        }
      }, 0);
    } else if (e.key === 'Enter' && !e.ctrlKey) {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const lines = value.substring(0, start).split('\n');
      const currentLine = lines[lines.length - 1];
      
      const indentMatch = currentLine.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      
      let autoComplete = '';
      const listMatch = currentLine.match(/^(\s*([-*+]|\d+\.|-\s\[[ x\]])\s)/);
      if (listMatch) {
        if (currentLine.trim() === listMatch[1].trim()) {
          // 리스트 아이템 내용이 비어있으면 리스트 해제
          const lineStartPos = start - currentLine.length;
          const newValue = value.substring(0, lineStartPos) + value.substring(end);
          setContent(newValue);
          setTimeout(() => {
            if(textareaRef.current) {
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lineStartPos;
            }
          }, 0);
          return;
        } else {
          const numberedListMatch = listMatch[1].match(/^(\s*)(\d+)(\.\s)/);
          if (numberedListMatch) {
            const nextNumber = parseInt(numberedListMatch[2]) + 1;
            autoComplete = `${numberedListMatch[1]}${nextNumber}${numberedListMatch[3]}`;
          } else {
            autoComplete = listMatch[1];
          }
        }
      }
      
      const newValue = value.substring(0, start) + '\n' + (autoComplete || indent) + value.substring(end);
      setContent(newValue);
      
      const newCursorPos = start + 1 + (autoComplete || indent).length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
        }
      }, 0);
    }
  }, [insertTabAtCursor, setContent]);

  // 키보드 단축키 핸들러 (ESC로 닫기, Ctrl+Enter로 저장)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        onSave();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen, onClose, onSave]);

  if (!isOpen) return null;

  const handleTextareaInput = (e) => {
    // 내용 변경 시 높이 자동 조절
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const markdownComponents = {
    h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-3" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-lg font-bold mb-2" {...props} />,
    p: ({node, ...props}) => <p className="mb-4" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 pl-4" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-4 pl-4" {...props} />,
    li: ({node, ...props}) => <li className="mb-1" {...props} />,
    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4" {...props} />,
    code: ({node, inline, className, children, ...props}) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline ? (
        <pre className="bg-gray-100 p-3 rounded-lg my-4 overflow-x-auto">
          <code className={`language-${match ? match[1] : 'text'}`} {...props}>
            {String(children).replace(/\n$/, '')}
          </code>
        </pre>
      ) : (
        <code className="bg-gray-200 text-red-600 px-1 rounded" {...props}>
          {children}
        </code>
      );
    },
    a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
    input: ({ type, checked, ...props }) => {
      if (type === 'checkbox') {
        return <input type="checkbox" checked={checked} readOnly className="mr-2 accent-blue-600" {...props} />;
      }
      return <input type={type} {...props} />;
    },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300" onMouseDown={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col transform transition-transform duration-300 scale-95 animate-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">{columnLabel}</span>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{reportInfo?.project}</span>
              <span className="mx-2">|</span>
              <span>{reportInfo?.week}</span>
              <span className="mx-2">|</span>
              <span>{reportInfo?.stage}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPreview(!isPreview)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${ 
                isPreview 
                  ? 'bg-gray-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isPreview ? '📝 편집' : '👁️ 미리보기'}
            </button>
            <button onClick={onClose} className="w-8 h-8 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 flex items-center justify-center">
              &times;
            </button>
          </div>
        </header>

        {/* 컨텐츠 */}
        <main className="flex-1 p-6 overflow-y-auto">
          {isPreview ? (
            <div className="prose prose-lg max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={markdownComponents}
              >
                {content || '*내용을 입력하세요...'}
              </ReactMarkdown>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleAdvancedKeyDown}
              onInput={handleTextareaInput}
              className="w-full h-full p-2 border-none rounded-lg resize-none focus:outline-none focus:ring-0 bg-transparent text-base font-mono leading-relaxed"
              placeholder="마크다운을 지원합니다..."
            />
          )}
        </main>

        {/* 푸터 */}
        <footer className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-between items-center">
          <div className="text-xs text-gray-500">
            <strong>Ctrl+Enter</strong>: 저장 | <strong>ESC</strong>: 닫기 | <strong>Tab</strong>: 들여쓰기/내어쓰기
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              취소
            </button>
            <button
              onClick={onSave}
              disabled={isUpdating}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center w-24"
            >
              {isUpdating ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                '저장하기'
              )}
            </button>
          </div>
        </footer>
      </div>
      <style jsx>{`
        @keyframes scale-in {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default EditReportModal;
