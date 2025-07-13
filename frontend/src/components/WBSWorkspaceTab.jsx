import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    format, eachDayOfInterval, getWeek, getMonth, getYear,
    startOfWeek, endOfWeek, parseISO, addWeeks, subWeeks,
    startOfMonth, endOfMonth, startOfYear, endOfYear, isWeekend,
    addMonths, subMonths, addYears, subYears, max as dateMax, min as dateMin, isValid,
    isSameDay, isSameMonth, isSameYear
} from 'date-fns';
import { ko } from 'date-fns/locale';

// --- Mock Data ---
const initialTasks = [
    { id: 1, parentId: null, text: '화면 기획', start: '2025-07-09', end: '2025-07-15', progress: 20, level: 1, deliverables: '화면 기획서', remarks: '초기 기획 단계' },
    { id: 2, parentId: 1, text: '화면설계', start: '2025-07-09', end: '2025-07-15', progress: 30, level: 2, deliverables: '화면 설계서', remarks: '상세 화면 정의' },
    { id: 3, parentId: 2, text: '전체일정', start: '2025-07-09', end: '2025-07-12', progress: 40, level: 3, deliverables: '전체 일정표', remarks: '프로젝트 초기 일정 수립' },
    { id: 4, parentId: null, text: '화면 디자인', start: '2025-07-10', end: '2025-07-25', progress: 50, level: 1, deliverables: 'UI/UX 디자인 시안', remarks: '메인 화면 디자인 중' },
    { id: 5, parentId: 4, text: '상세화면 디자인', start: '2025-07-12', end: '2025-07-20', progress: 60, level: 2, deliverables: '상세 디자인 가이드', remarks: '컴포넌트별 디자인 확정' },
    { id: 6, parentId: 5, text: '디자인 시스템 정의', start: '2025-07-12', end: '2025-07-18', progress: 70, level: 3, deliverables: '디자인 시스템 문서', remarks: '재사용 가능한 컴포넌트 정의' },
    { id: 7, parentId: null, text: '퍼블리싱', start: '2025-07-14', end: '2025-08-05', progress: 0, level: 1, deliverables: '', remarks: '프론트엔드 개발 시작' },
    { id: 8, parentId: 7, text: '컴포넌트 마크업', start: '2025-07-14', end: '2025-07-28', progress: 10, level: 2, deliverables: '', remarks: '기본 컴포넌트 마크업 진행 중' },
    { id: 9, parentId: 8, text: '공통 컴포넌트', start: '2025-07-14', end: '2025-07-22', progress: 20, level: 3, deliverables: '', remarks: '버튼, 입력 필드 등 공통 요소 개발' },
    { id: 10, parentId: null, text: '프로젝트 관리', start: '2025-07-09', end: '2025-08-10', progress: 100, level: 1, deliverables: '주간 보고서', remarks: '전체 프로젝트 진행 상황 관리' },
    { id: 11, parentId: 10, text: '중간 보고', start: '2025-07-18', end: '2025-07-18', progress: 100, level: 2, deliverables: '중간 보고서', remarks: '주요 이해관계자 대상 보고' }, // Milestone
];

// --- Helper Functions ---
const buildTaskTree = (tasks) => {
    const taskMap = new Map(tasks.map(t => [t.id, { ...t, children: [] }]));
    const tree = [];
    for (const task of taskMap.values()) {
        if (task.parentId && taskMap.has(task.parentId)) {
            taskMap.get(task.parentId).children.push(task);
        } else {
            tree.push(task);
        }
    }
    return tree;
};

// New helper function to calculate task level
const calculateTaskLevel = (parentId, allTasks) => {
    if (parentId === null) {
        return 1; // Top-level task
    }
    const parent = allTasks.find(t => t.id === parentId);
    if (parent) {
        return parent.level + 1;
    }
    return 1; // Fallback, should not happen if parentId is valid
};

// --- Sub-components ---

const TaskModal = ({ task, tasks, onSave, onClose, allTasks, isAddingSubTask = false }) => {
    const [formData, setFormData] = useState(
        task || { parentId: null, text: '', start: '', end: '', progress: 0, deliverables: '', remarks: '', highlightStart: '', highlightEnd: '' }
    );

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.text || !formData.start || !formData.end) {
            alert('업무명, 시작일, 종료일은 필수 항목입니다.');
            return;
        }
        onSave({ ...formData, progress: Number(formData.progress) });
    };

    const parentTaskOptions = tasks.filter(t => t.id !== (task && task.id) && t.level < 5);

    // Calculate effective min/max dates based on parent and children
    const { effectiveMinDate, effectiveMaxDate } = useMemo(() => {
        let min = null;
        let max = null;

        // 1. Consider parent task's dates
        if (formData.parentId) {
            const parent = allTasks.find(t => t.id === formData.parentId);
            if (parent) {
                min = parseISO(parent.start);
                max = parseISO(parent.end);
            }
        }

        // 2. Consider children tasks' dates (if current task is a parent)
        const children = allTasks.filter(t => t.parentId === formData.id);
        if (children.length > 0) {
            const childrenMin = children.reduce((acc, curr) => {
                const childStart = parseISO(curr.start);
                return acc === null || childStart < acc ? childStart : acc;
            }, null);
            const childrenMax = children.reduce((acc, curr) => {
                const childEnd = parseISO(curr.end);
                return acc === null || childEnd > acc ? childEnd : acc;
            }, null);

            if (childrenMin) {
                min = min === null || childrenMin < min ? childrenMin : min;
            }
            if (childrenMax) {
                max = max === null || childrenMax > max ? childrenMax : max;
            }
        }

        // 3. If no parent or children, use current task's dates as initial bounds
        if (min === null && max === null && formData.start && formData.end) {
            min = parseISO(formData.start);
            max = parseISO(formData.end);
        }

        return {
            effectiveMinDate: min ? format(min, 'yyyy-MM-dd') : '',
            effectiveMaxDate: max ? format(max, 'yyyy-MM-dd') : ''
        };
    }, [formData.parentId, formData.id, formData.start, formData.end, allTasks]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-bold mb-4">{task ? '업무 수정' : '새 업무 추가'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">상위 업무</label>
                            <select name="parentId" value={formData.parentId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" disabled={isAddingSubTask}>
                                <option value="">없음</option>
                                {parentTaskOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.text}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">업무명</label>
                            <input type="text" name="text" value={formData.text} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="flex space-x-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700">시작일</label>
                                <input type="date" name="start" value={formData.start} onChange={handleChange} min={effectiveMinDate} max={effectiveMaxDate} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700">종료일</label>
                                <input type="date" name="end" value={formData.end} onChange={handleChange} min={effectiveMinDate} max={effectiveMaxDate} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                            </div>
                        </div>
                        <div className="flex space-x-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700">강조 시작일 (선택)</label>
                                <input type="date" name="highlightStart" value={formData.highlightStart} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700">강조 종료일 (선택)</label>
                                <input type="date" name="highlightEnd" value={formData.highlightEnd} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">진행률 ({formData.progress}%)</label>
                            <input type="range" name="progress" min="0" max="100" value={formData.progress} onChange={handleChange} className="mt-1 block w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">산출물</label>
                            <textarea name="deliverables" value={formData.deliverables} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">비고</label>
                            <textarea name="remarks" value={formData.remarks} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"></textarea>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">취소</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
}


    





const AddModeChoiceModal = ({ onClose, onSelect }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-bold mb-4">업무 추가 방식 선택</h2>
                <p className="mb-4">어떤 방식으로 업무를 추가하시겠습니까?</p>
                <div className="flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={() => onSelect('simple')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        단일 업무 추가
                    </button>
                    <button
                        type="button"
                        onClick={() => onSelect('hierarchical')}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                        계층적 업무 추가
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                    >
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
};

const TimelineHeader = ({ dates, showWeekends, dayWidth }) => {

    // dates가 배열이 아닐 경우 빈 배열로 대체
    const safeDates = Array.isArray(dates) ? dates : [];

    const headerData = useMemo(() => {
        const years = {};
        // Ensure safeDates is an array before calling forEach
        if (!Array.isArray(safeDates)) {
            return { yearHeaders: [], monthHeaders: [], weekHeaders: [] };
        }

        safeDates.forEach(date => {
            const year = getYear(date);
            const month = getMonth(date);
            const week = getWeek(date, { weekStartsOn: 1 });

            if (!years[year]) years[year] = { months: {}, count: 0 };
            if (!years[year].months[month]) years[year].months[month] = { weeks: {}, count: 0 };
            if (!years[year].months[month].weeks[week]) years[year].months[month].weeks[week] = { dates: [], count: 0 };

            years[year].months[month].weeks[week].dates.push(date);
            years[year].months[month].weeks[week].count++;
            years[year].months[month].count++;
            years[year].count++;
        });

        const yearHeaders = Object.entries(years).map(([year, data]) => ({
            label: year,
            span: data.count,
            key: year
        }));

        const monthHeaders = Object.entries(years).flatMap(([year, yearData]) =>
            Object.entries(yearData.months).map(([month, data]) => ({
                label: format(new Date(0, month), 'MMM', { locale: ko }),
                span: data.count,
                key: `${year}-${month}`
            }))
        );

        const weekHeaders = Object.entries(years).flatMap(([year, yearData]) =>
            Object.entries(yearData.months).flatMap(([month, monthData]) =>
                Object.entries(monthData.weeks).map(([week, data]) => ({
                    label: `W${week}`,
                    span: data.count,
                    key: `${year}-${month}-${week}`
                }))
            )
        );

        return { yearHeaders, monthHeaders, weekHeaders };
    }, [safeDates]);

    return (
        <div className="sticky top-0 z-20 bg-gray-100">
            {/* Year Headers */}
            <div className="flex border-b border-gray-300">
                {headerData.yearHeaders.map(header => (
                    <div key={header.key} className="text-center font-bold p-1 border-r border-gray-300" style={{ width: header.span * dayWidth }}>
                        {header.label}
                    </div>
                ))}
            </div>
            {/* Month Headers */}
            <div className="flex border-b border-gray-300">
                {headerData.monthHeaders.map(header => (
                    <div key={header.key} className="text-center font-semibold p-1 border-r border-gray-300" style={{ width: header.span * dayWidth }}>
                        {header.label}
                    </div>
                ))}
            </div>
            {/* Week Headers */}
            <div className="flex border-b border-gray-300">
                {headerData.weekHeaders.map(header => (
                    <div key={header.key} className="text-center text-sm p-1 border-r border-gray-300" style={{ width: header.span * dayWidth }}>
                        {header.label}
                    </div>
                ))}
            </div>
            {/* Day Headers */}
            <div className="flex border-b-2 border-gray-400">
                {safeDates.map(date => {
                    const day = format(date, 'd', { locale: ko });
                    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    const isWeekendDay = isWeekend(date);
                    return (
                        <div
                            key={date.toString()}
                            className={`w-8 text-center text-xs p-1 border-r border-gray-300 flex-shrink-0
                                ${isWeekendDay ? 'bg-gray-200' : 'bg-white'}
                                ${isToday ? 'bg-blue-200 font-bold' : ''}`
                            }
                            style={{ width: dayWidth }}
                        >
                            {day}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Move formatTaskDates outside TaskRow
const formatTaskDates = (startDate, endDate) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    if (!isValid(start) || !isValid(end)) {
        return '날짜 오류';
    }

    if (isSameDay(start, end)) {
        return format(start, 'yyyy-MM-dd', { locale: ko });
    } else if (isSameMonth(start, end) && isSameYear(start, end)) {
        return `${format(start, 'yyyy-MM-dd', { locale: ko })} ~ ${format(end, 'dd', { locale: ko })}`;
    } else if (isSameYear(start, end)) {
        return `${format(start, 'yyyy-MM-dd', { locale: ko })} ~ ${format(end, 'MM-dd', { locale: ko })}`;
    } else {
        return `${format(start, 'yyyy-MM-dd', { locale: ko })} ~ ${format(end, 'yyyy-MM-dd', { locale: ko })}`;
    }
};

const TaskNameCell = ({ task, level, isExpanded, onToggleExpand, onAddSubTask, onEdit, onDelete, style }) => {
    return (
        <div className="sticky left-0 bg-white border-b border-r border-gray-200 flex items-center group-hover:bg-yellow-50 z-10" style={style}>
            <div style={{ paddingLeft: `${level * 20 + 10}px` }} className="py-2 flex-grow flex items-start break-words relative">
                <div className="flex items-center flex-shrink-0 mr-1">
                    {task.children.length > 0 ? (
                        <button onClick={() => onToggleExpand(task.id)} className="text-gray-500 focus:outline-none">
                            {isExpanded ? '▼' : '▶'}
                        </button>
                    ) : (
                        <span className="text-gray-500"> • </span>
                    )}
                    {(task.deliverables && task.deliverables.trim() !== '') && (
                        <span className="ml-1 text-gray-500" title={`산출물: ${task.deliverables}`}>📄</span>
                    )}
                    {(task.remarks && task.remarks.trim() !== '') && (
                        <span className="ml-1 text-gray-500" title={`비고: ${task.remarks}`}>💬</span>
                    )}
                </div>
                <div className="flex-grow">
                    <div>{task.text}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                        {formatTaskDates(task.start, task.end)}
                    </div>
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onAddSubTask(task.id)} className="p-1 text-green-500 hover:text-green-700" title="하위 업무 추가">➕</button>
                    <button onClick={() => onEdit(task)} className="p-1 text-blue-500 hover:text-blue-700">✏️</button>
                    <button onClick={() => onDelete(task.id)} className="p-1 text-red-500 hover:text-red-700">🗑️</button>
                </div>
            </div>
        </div>
    );
};

const GanttBarCell = ({ task, dates, dayWidth, taskStart, taskEnd, isMilestone, style }) => {
    // timelineStart는 dates 배열의 첫 번째 날짜
    const timelineStart = dates[0];

    // taskStart와 timelineStart 간의 일수 차이 계산 (픽셀 위치)
    const daysFromTimelineStartToTaskStart = isValid(taskStart) && isValid(timelineStart)
        ? Math.max(0, (taskStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const leftPosition = daysFromTimelineStartToTaskStart * dayWidth;

    // task의 기간 (일수) 계산 (막대 너비)
    const taskDurationDays = isValid(taskStart) && isValid(taskEnd)
        ? Math.max(0, (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24) + 1) // +1 for inclusive end date
        : 0;
    const barWidth = taskDurationDays * dayWidth;

    // 강조 기간 계산
    let highlightLeft = 0;
    let highlightWidth = 0;
    if (task.highlightStart && task.highlightEnd && isValid(parseISO(task.highlightStart)) && isValid(parseISO(task.highlightEnd))) {
        const highlightStartDate = parseISO(task.highlightStart);
        const highlightEndDate = parseISO(task.highlightEnd);

        const daysFromTaskStartToHighlightStart = Math.max(0, (highlightStartDate.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24));
        highlightLeft = daysFromTaskStartToHighlightStart * dayWidth;

        const highlightDurationDays = Math.max(0, (highlightEndDate.getTime() - highlightStartDate.getTime()) / (1000 * 60 * 60 * 24) + 1);
        highlightWidth = highlightDurationDays * dayWidth;
    }

    return (
        <div className="relative border-b border-gray-200" style={style}>
            <div
                className="absolute h-5/6 top-1/2 -translate-y-1/2"
                style={{
                    left: `${leftPosition}px`,
                    width: `${barWidth}px`,
                }}
            >
                {isMilestone ? (
                    <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-4 bg-purple-500 transform rotate-45" title={`${task.text} (Milestone)`}></div>
                ) : (
                    <div className="relative h-full bg-blue-200 rounded-md overflow-hidden border border-blue-400">
                        <div className="h-full bg-blue-500" style={{ width: `${task.progress}%` }}></div>
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-800 font-semibold">{task.progress}%</span>
                        {task.highlightStart && task.highlightEnd && (
                            <div
                                className="absolute top-0 h-full bg-green-300 opacity-75"
                                style={{
                                    left: `${highlightLeft}px`,
                                    width: `${highlightWidth}px`,
                                }}
                                title={`강조 기간: ${task.highlightStart} ~ ${task.highlightEnd}`}
                            ></div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};



const TaskListRecursive = ({ tasks, level, dates, onEdit, onDelete, onAddSubTask, dayWidth, expandedTaskIds, onToggleExpand }) => {
    return (
        <>
            {tasks.map(task => (
                <React.Fragment key={task.id}>
                    <TaskNameCell
                        task={task}
                        level={level}
                        isExpanded={expandedTaskIds.has(task.id)}
                        onToggleExpand={onToggleExpand}
                        onAddSubTask={onAddSubTask}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        style={{ gridColumn: '1 / 2' }}
                    />
                    <div className="resizer-placeholder" style={{ gridColumn: '2 / 3' }}></div>
                    <GanttBarCell
                        task={task}
                        dates={dates}
                        dayWidth={dayWidth}
                        taskStart={parseISO(task.start)}
                        taskEnd={parseISO(task.end)}
                        isMilestone={task.start === task.end}
                        style={{ gridColumn: `3 / ${dates.length + 3}` }}
                    />
                    {task.children.length > 0 && expandedTaskIds.has(task.id) && (
                        <TaskListRecursive
                            tasks={task.children}
                            level={level + 1}
                            dates={dates}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onAddSubTask={onAddSubTask}
                            dayWidth={dayWidth}
                            expandedTaskIds={expandedTaskIds}
                            onToggleExpand={onToggleExpand}
                        />
                    )}
                </React.Fragment>
            ))}
        </>
    );
};

// New ProjectDateRangeModal Component
const ProjectDateRangeModal = ({ projectStartDate, projectEndDate, onSave, onClose }) => {
    const [start, setStart] = useState(projectStartDate);
    const [end, setEnd] = useState(projectEndDate);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Validate dates before saving
        const parsedStart = parseISO(start);
        const parsedEnd = parseISO(end);

        if (start && end && (!isValid(parsedStart) || !isValid(parsedEnd) || parsedStart > parsedEnd)) {
            alert('유효하지 않은 프로젝트 기간입니다. 시작일과 종료일을 올바르게 설정해주세요.');
            return;
        }
        onSave(start, end);
    };

    const handleClear = () => {
        setStart('');
        setEnd('');
        onSave('', ''); // Clear dates in parent component
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-bold mb-4">프로젝트 일정 설정</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">시작일</label>
                            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">종료일</label>
                            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">취소</button>
                        <button type="button" onClick={handleClear} className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">초기화</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// New HierarchicalTaskModal Component
const HierarchicalTaskModal = ({ onSave, onClose, allTasks }) => {
    const [taskInput, setTaskInput] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setError('');
        const lines = taskInput.split('\n').filter(line => line.trim() !== '');
        let currentParentId = null;
        const taskStack = []; // To keep track of parent tasks for indentation

        for (const line of lines) {
            const indentMatch = line.match(/^(-*)\s*(.*)/);
            if (!indentMatch) {
                setError('잘못된 형식입니다. 각 줄은 \'-\'로 시작해야 합니다.');
                return;
            }
            const indentLevel = indentMatch[1].length;
            const taskText = indentMatch[2].trim();

            if (taskText === '') {
                continue;
            }

            // Adjust taskStack based on current indentLevel
            while (taskStack.length > indentLevel) {
                taskStack.pop();
            }

            currentParentId = taskStack.length > 0 ? taskStack[taskStack.length - 1].id : null;

            try {
                const savedTask = await onSave({
                    parentId: currentParentId,
                    text: taskText,
                    start: '', // Will be set by user later or derived
                    end: '',   // Will be set by user later or derived
                    progress: 0,
                    deliverables: '',
                    remarks: ''
                });
                taskStack.push(savedTask); // Add the newly saved task to the stack
            } catch (e) {
                setError(`업무 저장 중 오류 발생: ${e.message}`);
                return;
            }
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-bold mb-4">계층적 업무 추가</h2>
                <p className="mb-2 text-sm text-gray-600">
                    각 줄에 업무를 입력하고, 하위 업무는 앞에 \'-\'를 추가하여 들여쓰기하세요.
                </p>
                <p className="mb-4 text-xs text-gray-500">
                    예시:<br/>
                    - 상위 업무 1<br/>
                    -- 하위 업무 1-1<br/>
                    --- 하위 업무 1-1-1<br/>
                    - 상위 업무 2
                </p>
                <textarea
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm h-48"
                    placeholder="업무 목록을 입력하세요..."
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                ></textarea>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">취소</button>
                    <button type="button" onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">업무 추가</button>
                </div>
            </div>
        </div>
    );
};


// --- Main Component ---
const WBSWorkspaceTab = ({ project }) => {
    const [tasks, setTasks] = useState(initialTasks);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [isModalForSubTask, setIsModalForSubTask] = useState(false);
    const [expandedTaskIds, setExpandedTaskIds] = useState(new Set(initialTasks.filter(t => t.children && t.children.length > 0).map(t => t.id)));

    const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
    const [isHierarchicalModalOpen, setIsHierarchicalModalOpen] = useState(false);
    const [isProjectDateModalOpen, setIsProjectDateModalOpen] = useState(false); // New state for project date modal

    const [viewMode, setViewMode] = useState('week'); // 'week', 'month', 'year'
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showWeekends, setShowWeekends] = useState(true);

    const [dayWidth, setDayWidth] = useState(32); // px, for Gantt chart zoom

    // New states for project-level date filtering
    const [projectStartDate, setProjectStartDate] = useState('');
    const [projectEndDate, setProjectEndDate] = useState('');

    const [taskListWidth, setTaskListWidth] = useState(350); // Initial width for task list
    const [isResizing, setIsResizing] = useState(false);
    const initialMouseX = useRef(0);
    const initialTaskListWidth = useRef(0);

    const taskTree = useMemo(() => buildTaskTree(tasks), [tasks]);

    const filteredDates = useMemo(() => {
        let start = new Date();
        let end = new Date();

        if (viewMode === 'week') {
            start = startOfWeek(currentDate, { weekStartsOn: 1 });
            end = endOfWeek(currentDate, { weekStartsOn: 1 });
        } else if (viewMode === 'month') {
            start = startOfMonth(currentDate);
            end = endOfMonth(currentDate);
        } else if (viewMode === 'year') {
            start = startOfYear(currentDate);
            end = endOfYear(currentDate);
        }

        // Apply project-level date filtering if set
        let effectiveStart = start;
        let effectiveEnd = end;

        if (projectStartDate) {
            const parsedProjectStartDate = parseISO(projectStartDate);
            if (isValid(parsedProjectStartDate)) {
                effectiveStart = dateMax([effectiveStart, parsedProjectStartDate]);
            }
        }
        if (projectEndDate) {
            const parsedProjectEndDate = parseISO(projectEndDate);
            if (isValid(parsedProjectEndDate)) {
                effectiveEnd = dateMin([effectiveEnd, parsedProjectEndDate]);
            }
        }

        // 유효성 체크: 시작/종료일이 유효하지 않거나, 시작이 종료보다 늦으면 빈 배열 반환
        if (!isValid(effectiveStart) || !isValid(effectiveEnd) || effectiveStart > effectiveEnd) {
            return [];
        }

        let allDates = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });

        if (!showWeekends) {
            allDates = allDates.filter(date => !isWeekend(date));
        }
        return allDates;
    }, [currentDate, viewMode, showWeekends, projectStartDate, projectEndDate]);

    const handleOpenModal = useCallback((task = null) => {
        setEditingTask(task);
        setIsModalForSubTask(false);
        setIsModalOpen(true);
    }, []);

    const handleAddSubTask = useCallback((parentId) => {
        setEditingTask({ parentId: parentId, text: '', start: '', end: '', progress: 0, deliverables: '', remarks: '' });
        setIsModalForSubTask(true);
        setIsModalOpen(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingTask(null);
    }, []);

    const handleSaveTask = useCallback((taskData) => {
        setTasks(prevTasks => {
            const newLevel = calculateTaskLevel(taskData.parentId, prevTasks);

            if (newLevel > 5) {
                alert('업무 계층은 최대 5단계까지만 허용됩니다.');
                return prevTasks; // Prevent saving
            }

            if (taskData.id) {
                return prevTasks.map(t => t.id === taskData.id ? { ...t, ...taskData, level: newLevel } : t);
            } else {
                const newId = Math.max(0, ...prevTasks.map(t => t.id)) + 1;
                return [...prevTasks, { ...taskData, id: newId, level: newLevel }];
            }
        });
        handleCloseModal();
    }, [handleCloseModal]);

    const handleHierarchicalSaveTask = useCallback((taskData) => {
        return new Promise((resolve, reject) => {
            setTasks(prevTasks => {
                const newLevel = calculateTaskLevel(taskData.parentId, prevTasks);

                if (newLevel > 5) {
                    alert('업무 계층은 최대 5단계까지만 허용됩니다.');
                    reject(new Error('Max level exceeded'));
                    return prevTasks; // Prevent saving
                }

                const newId = Math.max(0, ...prevTasks.map(t => t.id)) + 1;
                const savedTask = { ...taskData, id: newId, level: newLevel };
                const updatedTasks = [...prevTasks, savedTask];
                resolve(savedTask);
                return updatedTasks;
            });
        });
    }, []);

    const handleDeleteTask = useCallback((taskId) => {
        if (window.confirm('이 업무와 모든 하위 업무를 삭제하시겠습니까?')) {
            setTasks(prevTasks => {
                const tasksToDelete = new Set([taskId]);
                let changed = true;
                while(changed) {
                    changed = false;
                    const sizeBefore = tasksToDelete.size;
                    prevTasks.forEach(t => {
                        if(t.parentId && tasksToDelete.has(t.parentId)) {
                            tasksToDelete.add(t.id);
                        }
                    });
                    if (tasksToDelete.size > sizeBefore) changed = true;
                }
                return prevTasks.filter(t => !tasksToDelete.has(t.id));
            });
        }
    }, []);

    const handleToggleExpand = useCallback((taskId) => {
        setExpandedTaskIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) {
                newSet.delete(taskId);
            } else {
                newSet.add(taskId);
            }
            return newSet;
        });
    }, []);

    const handleExpandAll = useCallback(() => {
        const allExpandableTaskIds = new Set();
        const collectExpandableIds = (tasks) => {
            tasks.forEach(task => {
                if (task.children && task.children.length > 0) {
                    allExpandableTaskIds.add(task.id);
                    collectExpandableIds(task.children);
                }
            });
        };
        collectExpandableIds(taskTree);
        setExpandedTaskIds(allExpandableTaskIds);
    }, [taskTree]);

    const handleCollapseAll = useCallback(() => {
        setExpandedTaskIds(new Set());
    }, []);

    const handlePrevPeriod = () => {
        setCurrentDate(prev => {
            if (viewMode === 'week') return subWeeks(prev, 1);
            if (viewMode === 'month') return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
            if (viewMode === 'year') return new Date(prev.getFullYear() - 1, 0, 1);
            return prev;
        });
    };

    const handleNextPeriod = () => {
        setCurrentDate(prev => {
            if (viewMode === 'week') return addWeeks(prev, 1);
            if (viewMode === 'month') return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
            if (viewMode === 'year') return new Date(prev.getFullYear() + 1, 0, 1);
            return prev;
        });
    };

    const handleZoomIn = () => {
        setDayWidth(prev => Math.min(prev + 4, 64)); // Max zoom
    };

    const handleZoomOut = () => {
        setDayWidth(prev => Math.max(prev - 4, 16)); // Min zoom
    };

    const handleSaveProjectDates = useCallback((start, end) => {
        setProjectStartDate(start);
        setProjectEndDate(end);
        setIsProjectDateModalOpen(false);
    }, []);

    const handleMouseDown = useCallback((e) => {
        setIsResizing(true);
        initialMouseX.current = e.clientX;
        initialTaskListWidth.current = taskListWidth;
    }, [taskListWidth]);

    const handleMouseMove = useCallback((e) => {
        if (!isResizing) return;
        const dx = e.clientX - initialMouseX.current;
        const newWidth = Math.max(200, initialTaskListWidth.current + dx); // Min width 200px
        setTaskListWidth(newWidth);
    }, [isResizing]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    return (
        <div className="w-full h-full flex flex-col bg-gray-50 p-4">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-800">WBS - {project?.name || 'Gantt Chart'}</h1>
                <div className="flex items-center space-x-2">
                    <button onClick={handlePrevPeriod} className="px-3 py-1 bg-gray-300 rounded-md hover:bg-gray-400">{'<'}</button>
                    <span className="font-semibold">
                        {viewMode === 'week' && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy.MM.dd', { locale: ko })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy.MM.dd', { locale: ko })}`}
                        {viewMode === 'month' && format(currentDate, 'yyyy년 MM월', { locale: ko })}
                        {viewMode === 'year' && format(currentDate, 'yyyy년', { locale: ko })}
                    </span>
                    <button onClick={handleNextPeriod} className="px-3 py-1 bg-gray-300 rounded-md hover:bg-gray-400">{'>'}</button>

                    <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}
                            className="p-1 border border-gray-300 rounded-md">
                        <option value="week">주간</option>
                        <option value="month">월간</option>
                        <option value="year">연간</option>
                    </select>
                    <label className="flex items-center space-x-1">
                        <input type="checkbox" checked={showWeekends} onChange={(e) => setShowWeekends(e.target.checked)}
                               className="form-checkbox" />
                        <span>주말 포함</span>
                    </label>
                    <button onClick={handleZoomOut} className="px-3 py-1 bg-gray-300 rounded-md hover:bg-gray-400">-</button>
                    <button onClick={handleZoomIn} className="px-3 py-1 bg-gray-300 rounded-md hover:bg-gray-400">+</button>
                    <button onClick={() => setIsProjectDateModalOpen(true)} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow">
                        프로젝트 일정 설정
                    </button>
                    <button onClick={() => setIsChoiceModalOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow">
                        + 새 업무 추가
                    </button>
                </div>
            </div>

            <div className="flex-grow w-full overflow-auto border border-gray-300 rounded-lg shadow-md">
                <div className="grid" style={{ gridTemplateColumns: `${taskListWidth}px 4px repeat(${filteredDates.length}, ${dayWidth}px)` }}>
                    {/* Header Row */}
                    <div className="sticky top-0 left-0 z-30 bg-gray-200 p-2 border-b-2 border-r border-gray-400 font-bold text-gray-700 flex justify-between items-center"
                         style={{ gridColumn: '1 / 2' }}>
                        <span>업무 목록</span>
                        <div className="flex space-x-2">
                            <button onClick={handleExpandAll} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 shadow-sm">모두 펼치기</button>
                            <button onClick={handleCollapseAll} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 shadow-sm">모두 접기</button>
                        </div>
                    </div>
                    <div
                        className="sticky top-0 z-30 bg-gray-200 border-b-2 border-gray-400 cursor-ew-resize"
                        style={{ width: '4px', gridColumn: '2 / 3' }}
                        onMouseDown={handleMouseDown}
                    ></div>
                    <div className="overflow-x-hidden" style={{ gridColumn: `3 / ${filteredDates.length + 3}` }}>
                        <TimelineHeader dates={filteredDates} showWeekends={showWeekends} dayWidth={dayWidth} />
                    </div>

                    {/* Body Rows */}
                    <div className="grid-body" style={{ display: "contents" }}>
                        <TaskListRecursive
                            tasks={taskTree}
                            level={0}
                            dates={filteredDates}
                            onEdit={handleOpenModal}
                            onDelete={handleDeleteTask}
                            onAddSubTask={handleAddSubTask}
                            dayWidth={dayWidth}
                            expandedTaskIds={expandedTaskIds}
                            onToggleExpand={handleToggleExpand}
                        />
                    </div>
                </div>
            </div>

            {isChoiceModalOpen && (
                <AddModeChoiceModal
                    onClose={() => setIsChoiceModalOpen(false)}
                    onSelect={(mode) => {
                        setIsChoiceModalOpen(false);
                        if (mode === 'simple') {
                            handleOpenModal();
                        }
                        else {
                            setIsHierarchicalModalOpen(true);
                        }
                    }}
                />
            )}

            {isHierarchicalModalOpen && (
                <HierarchicalTaskModal
                    onSave={handleHierarchicalSaveTask}
                    onClose={() => setIsHierarchicalModalOpen(false)}
                    allTasks={tasks}
                />
            )}

            {isModalOpen && (
                <TaskModal
                    task={editingTask}
                    tasks={tasks}
                    onSave={handleSaveTask}
                    onClose={handleCloseModal}
                    allTasks={tasks}
                    isAddingSubTask={isModalForSubTask}
                />
            )}

            {isProjectDateModalOpen && (
                <ProjectDateRangeModal
                    projectStartDate={projectStartDate}
                    projectEndDate={projectEndDate}
                    onSave={handleSaveProjectDates}
                    onClose={() => setIsProjectDateModalOpen(false)}
                />
            )}
        </div>
    );
};

export default WBSWorkspaceTab;
