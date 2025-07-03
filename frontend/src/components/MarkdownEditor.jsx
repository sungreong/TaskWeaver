import React, { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

const MarkdownEditor = ({ 
  value = '', 
  onChange, 
  placeholder = '마크다운을 입력하세요...', 
  label, 
  required = false,
  rows = 6,
  className = ''
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef(null);

  // 텍스트 변경 핸들러
  const handleTextChange = (e) => {
    onChange(e.target.value);
  };

  // Tab 키 처리 (들여쓰기 지원)
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      
      // 마크다운 리스트 중첩에 최적화된 2칸 들여쓰기
      const indentation = '  '; // 2칸 스페이스 (리스트 중첩 표준)
      const newValue = value.substring(0, start) + indentation + value.substring(end);
      onChange(newValue);
      
      // 커서 위치 조정
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + indentation.length;
      }, 0);
    }
  };

  // 마크다운 도구바 버튼 핸들러들
  const insertText = useCallback((before, after = '', placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newValue = 
      value.substring(0, start) + 
      before + textToInsert + after + 
      value.substring(end);
    
    onChange(newValue);
    
    // 커서 위치 조정
    setTimeout(() => {
      const newStart = start + before.length;
      const newEnd = newStart + textToInsert.length;
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    }, 0);
  }, [value, onChange]);

  const toolbarButtons = [
    {
      icon: 'B',
      title: '굵게',
      action: () => insertText('**', '**', '굵은 텍스트'),
      style: 'font-bold'
    },
    {
      icon: 'I',
      title: '기울임',
      action: () => insertText('*', '*', '기울임 텍스트'),
      style: 'italic'
    },
    {
      icon: '≡',
      title: '제목',
      action: () => insertText('## ', '', '제목'),
    },
    {
      icon: '•',
      title: '목록',
      action: () => insertText('- ', '', '목록 항목'),
    },
    {
      icon: '☑',
      title: '체크리스트',
      action: () => insertText('- [ ] ', '', '할 일'),
    },
    {
      icon: '<>',
      title: '코드',
      action: () => insertText('`', '`', '코드'),
    },
    {
      icon: '🔗',
      title: '링크',
      action: () => insertText('[', '](URL)', '링크 텍스트'),
    }
  ];

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 라벨 */}
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* 모드 전환 탭 */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setIsPreview(false)}
          className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            !isPreview
              ? 'border-blue-500 text-blue-600 bg-blue-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          ✏️ 편집
        </button>
        <button
          type="button"
          onClick={() => setIsPreview(true)}
          className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            isPreview
              ? 'border-blue-500 text-blue-600 bg-blue-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          👁️ 미리보기
        </button>
      </div>

      {/* 편집 모드 */}
      {!isPreview && (
        <div className="space-y-2">
          {/* 도구바 */}
          <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border border-gray-200 rounded-t-md">
            {toolbarButtons.map((button, index) => (
              <button
                key={index}
                type="button"
                onClick={button.action}
                title={button.title}
                className={`w-8 h-8 flex items-center justify-center text-sm border border-gray-300 bg-white rounded hover:bg-gray-100 transition-colors ${button.style || ''}`}
              >
                {button.icon}
              </button>
            ))}
            <div className="flex-1"></div>
            <div className="text-xs text-gray-500 flex items-center">
              💡 Tab으로 2칸 들여쓰기 (리스트 중첩)
            </div>
          </div>

          {/* 텍스트 에어리어 */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-3 py-2 border border-gray-300 rounded-b-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            style={{ resize: 'vertical' }}
          />
        </div>
      )}

      {/* 미리보기 모드 */}
      {isPreview && (
        <div className="min-h-32 p-4 border border-gray-300 rounded-b-md bg-white">
          {value.trim() ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                  // 체크박스 스타일링
                  input: ({ type, checked, ...props }) => {
                    if (type === 'checkbox') {
                      return (
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled
                          className="mr-2"
                          {...props}
                        />
                      );
                    }
                    return <input type={type} {...props} />;
                  },
                  // 코드 블록 스타일링
                  code: ({ inline, children, ...props }) => {
                    return inline ? (
                      <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-gray-100 p-2 rounded text-sm font-mono overflow-x-auto" style={{ whiteSpace: 'pre-wrap' }} {...props}>
                        {children}
                      </code>
                    );
                  },
                  // 코드 블록 전체 (pre 태그)
                  pre: ({ children, ...props }) => (
                    <pre className="bg-gray-100 p-2 rounded text-sm font-mono overflow-x-auto" style={{ whiteSpace: 'pre-wrap' }} {...props}>
                      {children}
                    </pre>
                  ),
                  // 리스트 스타일링 (중첩 지원)
                  ul: ({ children, ...props }) => (
                    <ul className="list-disc ml-4 space-y-1" style={{ whiteSpace: 'normal' }} {...props}>
                      {children}
                    </ul>
                  ),
                  ol: ({ children, ...props }) => (
                    <ol className="list-decimal ml-4 space-y-1" style={{ whiteSpace: 'normal' }} {...props}>
                      {children}
                    </ol>
                  ),
                  // 리스트 항목 스타일링
                  li: ({ children, ...props }) => (
                    <li className="mb-1" style={{ whiteSpace: 'normal' }} {...props}>
                      {children}
                    </li>
                  ),
                  // 제목 스타일링
                  h1: ({ children, ...props }) => (
                    <h1 className="text-xl font-bold mb-2" {...props}>{children}</h1>
                  ),
                  h2: ({ children, ...props }) => (
                    <h2 className="text-lg font-bold mb-2" {...props}>{children}</h2>
                  ),
                  h3: ({ children, ...props }) => (
                    <h3 className="text-base font-bold mb-2" {...props}>{children}</h3>
                  ),
                  // 링크 스타일링
                  a: ({ children, ...props }) => (
                    <a className="text-blue-600 hover:text-blue-800 underline" {...props}>
                      {children}
                    </a>
                  ),
                  // 구분선 스타일링
                  hr: (props) => <hr className="my-4 border-gray-300" {...props} />,
                  // 인용구 스타일링
                  blockquote: ({ children, ...props }) => (
                    <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600" {...props}>
                      {children}
                    </blockquote>
                  ),
                  // 문단 스타일링 
                  p: ({ children, ...props }) => (
                    <p className="mb-2" {...props}>
                      {children}
                    </p>
                  )
                }}
              >
                {value}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-gray-400 italic">
              미리보기할 내용이 없습니다. 편집 탭에서 마크다운을 입력해보세요.
            </div>
          )}
        </div>
      )}

      {/* 마크다운 가이드 */}
      {!isPreview && (
        <div className="text-xs text-gray-500 space-y-1">
          <div className="font-medium">💡 마크다운 문법 가이드:</div>
          <div className="flex flex-wrap gap-4">
            <span>**굵게**</span>
            <span>*기울임*</span>
            <span>## 제목</span>
            <span>- 목록</span>
            <span>- [ ] 체크리스트</span>
            <span>`코드`</span>
            <span>[링크](URL)</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownEditor; 