import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    format, eachDayOfInterval, getWeek, getMonth, getYear,
    startOfWeek, endOfWeek, parseISO, addWeeks, subWeeks,
    startOfMonth, endOfMonth, startOfYear, endOfYear, isWeekend,
    addMonths, subMonths, addYears, subYears, isValid,
    isSameDay, differenceInDays, startOfToday
} from 'date-fns';
import { ko } from 'date-fns/locale';

// --- Mock Data ---
const initialTasks = [
    { id: 1, parentId: null, text: '화면 기획', start: '2025-07-09', end: '2025-07-15', progress: 20, deliverables: '화면 기획서', remarks: '초기 기획 단계' },
    { id: 2, parentId: 1, text: '화면설계', start: '2025-07-09', end: '2025-07-15', progress: 30, deliverables: '화면 설계서', remarks: '상세 화면 정의' },
    { id: 3, parentId: 2, text: '전체일정', start: '2025-07-09', end: '2025-07-12', progress: 40, deliverables: '전체 일정표', remarks: '프로젝트 초기 일정 수립' },
    { id: 4, parentId: null, text: '화면 디자인', start: '2025-07-10', end: '2025-07-25', progress: 50, deliverables: 'UI/UX 디자인 시안', remarks: '메인 화면 디자인 중' },
    { id: 5, parentId: 4, text: '상세화면 디자인', start: '2025-07-12', end: '2025-07-20', progress: 60, deliverables: '상세 디자인 가이드', remarks: '컴포넌트별 디자인 확정' },
    { id: 6, parentId: 5, text: '디자인 시스템 정의', start: '2025-07-12', end: '2025-07-18', progress: 70, deliverables: '디자인 시스템 문서', remarks: '재사용 가능한 컴포넌트 정의' },
    { id: 7, parentId: null, text: '퍼블리싱', start: '2025-07-14', end: '2025-08-05', progress: 0, deliverables: '', remarks: '프론트엔드 개발 시작' },
    { id: 8, parentId: 7, text: '컴포넌트 마크업', start: '2025-07-14', end: '2025-07-28', progress: 10, deliverables: '', remarks: '기본 컴포넌트 마크업 진행 중' },
    { id: 9, parentId: 8, text: '공통 컴포넌트', start: '2025-07-14', end: '2025-07-22', progress: 20, deliverables: '', remarks: '버튼, 입력 필드 등 공통 요소 개발' },
    { id: 10, parentId: null, text: '프로젝트 관리', start: '2025-07-09', end: '2025-08-10', progress: 100, deliverables: '주간 보고서', remarks: '전체 프로젝트 진행 상황 관리' },
    { id: 11, parentId: 10, text: '중간 보고', start: '2025-07-18', end: '2025-07-18', progress: 100, deliverables: '중간 보고서', remarks: '주요 이해관계자 대상 보고' }, // Milestone
];

// --- Helper Functions ---
const safeParseISO = (dateString) => {
    if (!dateString) return null;
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
};

const buildTaskTree = (tasks) => {
    const taskMap = new Map(tasks.map(t => [t.id, { ...t, children: [] }]));
    const tree = [];
    tasks.forEach(task => {
        const currentTask = taskMap.get(task.id);
        if (task.parentId && taskMap.has(task.parentId)) {
            taskMap.get(task.parentId).children.push(currentTask);
        } else {
            tree.push(currentTask);
        }
    });
    return tree;
};

const getVisibleTasks = (taskTree, expandedTaskIds) => {
    const visible = [];
    const traverse = (tasks, level, parentIsExpanded) => {
        tasks.forEach(task => {
            if (parentIsExpanded) {
                visible.push({ ...task, level });
            }
            if (task.children.length > 0) {
                traverse(task.children, level + 1, parentIsExpanded && expandedTaskIds.has(task.id));
            }
        });
    };
    traverse(taskTree, 1, true);
    return visible;
};

const recalculateAllTaskLevels = (tasks) => {
    const taskTree = buildTaskTree(tasks);
    const flatTasks = [];
    const traverse = (tree, level) => {
        tree.forEach(task => {
            const { children, ...rest } = task;
            flatTasks.push({ ...rest, level });
            if (children.length > 0) {
                traverse(children, level + 1);
            }
        });
    };
    traverse(taskTree, 1);
    return flatTasks;
};

const calculateDday = (task, showWeekends) => {
    const startDate = safeParseISO(task.start);
    const endDate = safeParseISO(task.end);

    if (!startDate || !endDate) return null;
    if (task.progress === 100) return { text: '완료', color: 'text-green-600 font-semibold' };

    const today = startOfToday();
    if (today < startDate) return null;

    let remainingDays;
    if (showWeekends) {
        remainingDays = differenceInDays(endDate, today);
    } else {
        const isPast = today > endDate;
        const interval = isPast ? { start: endDate, end: today } : { start: today, end: endDate };
        let businessDays = eachDayOfInterval(interval).filter(d => !isWeekend(d)).length;
        if (isPast) {
            if (!isWeekend(endDate)) businessDays -= 1;
            remainingDays = -businessDays;
        } else {
            if (!isWeekend(today)) businessDays -= 1;
            remainingDays = businessDays;
        }
    }

    if (remainingDays < 0) return { text: `D+${Math.abs(remainingDays)}`, color: 'text-red-500 font-semibold' };
    if (remainingDays === 0) return { text: 'D-Day', color: 'text-yellow-500 font-semibold' };
    return { text: `D-${remainingDays}`, color: 'text-blue-500 font-semibold' };
};

// --- Sub-components ---

const TaskModal = ({ task, onSave, onClose, allTasks, isAddingSubTask = false }) => {
    const [formData, setFormData] = useState(
        task || { parentId: null, text: '', start: '', end: '', progress: 0, deliverables: '', remarks: '' }
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

    const parentTaskOptions = allTasks.filter(t => t.id !== (task && task.id) && (!task || t.level < 5));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-bold mb-4">{task && task.id ? '업무 수정' : '새 업무 추가'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">상위 업무</label>
                            <select name="parentId" value={formData.parentId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" disabled={isAddingSubTask}>
                                <option value="">없음 (최상위 업무)</option>
                                {parentTaskOptions.map(opt => <option key={opt.id} value={opt.id}>{'--'.repeat(opt.level-1) + opt.text}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">업무명</label>
                            <input type="text" name="text" value={formData.text} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="flex space-x-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700">시작일</label>
                                <input type="date" name="start" value={formData.start} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700">종료일</label>
                                <input type="date" name="end" value={formData.end} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">진행률 ({formData.progress}%)</label>
                            <input type="range" name="progress" min="0" max="100" value={formData.progress} onChange={handleChange} className="mt-1 block w-full" />
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

const TimelineHeader = ({ dates, dayWidth }) => {
    const headerData = useMemo(() => {
        if (!dates || dates.length === 0) return { yearHeaders: [], monthHeaders: [], weekHeaders: [] };
        const years = {}, months = {}, weeks = {};
        dates.forEach(date => {
            const year = getYear(date), month = getMonth(date), week = getWeek(date, { weekStartsOn: 1 });
            const yearKey = year, monthKey = `${year}-${month}`, weekKey = `${year}-${week}`;
            if (!years[yearKey]) years[yearKey] = 0;
            if (!months[monthKey]) months[monthKey] = 0;
            if (!weeks[weekKey]) weeks[weekKey] = 0;
            years[yearKey]++; months[monthKey]++; weeks[weekKey]++;
        });
        return {
            yearHeaders: Object.entries(years).map(([label, span]) => ({ label, span, key: label })),
            monthHeaders: Object.entries(months).map(([key, span]) => ({ label: format(safeParseISO(key), 'MMM', { locale: ko }), span, key })),
            weekHeaders: Object.entries(weeks).map(([key, span]) => ({ label: `W${key.split('-')[1]}`, span, key }))
        };
    }, [dates, dayWidth]);

    return (
        <div className="sticky top-0 z-20 bg-gray-100 select-none">
            <div className="flex border-b border-gray-300">
                {headerData.yearHeaders.map(h => <div key={h.key} className="text-center font-bold p-1 border-r border-gray-300" style={{ width: h.span * dayWidth }}>{h.label}</div>)}
            </div>
            <div className="flex border-b border-gray-300">
                {headerData.monthHeaders.map(h => <div key={h.key} className="text-center font-semibold p-1 border-r border-gray-300" style={{ width: h.span * dayWidth }}>{h.label}</div>)}
            </div>
            <div className="flex border-b-2 border-gray-400">
                {dates.map(date => (
                    <div key={date.toString()} className={`text-center text-xs p-1 border-r border-gray-300 flex-shrink-0 ${isWeekend(date) ? 'bg-gray-200' : 'bg-white'} ${isSameDay(date, new Date()) ? 'bg-blue-200 font-bold' : ''}`} style={{ width: dayWidth }}>
                        {format(date, 'd')}
                    </div>
                ))}
            </div>
        </div>
    );
};

const TaskRow = ({ task, onToggleExpand, isExpanded, showWeekends, dragHandlers, draggedTaskId, dragOverTaskId, onEdit, onDelete, onAddSubTask }) => {
    const dDayInfo = calculateDday(task, showWeekends);
    const taskStart = safeParseISO(task.start);
    const taskEnd = safeParseISO(task.end);

    return (
        <div
            className={`flex items-center border-b border-gray-200 bg-white hover:bg-yellow-50 h-12 group ${draggedTaskId === task.id ? 'opacity-50' : ''} ${dragOverTaskId === task.id ? 'border-2 border-blue-500' : ''}`}
            draggable="true"
            onDragStart={(e) => dragHandlers.onDragStart(e, task)}
            onDragOver={(e) => dragHandlers.onDragOver(e, task)}
            onDrop={(e) => dragHandlers.onDrop(e, task)}
            onDragEnd={dragHandlers.onDragEnd}
        >
            <div style={{ paddingLeft: `${task.level * 20 + 5}px`, width: '100%' }} className="py-2 flex-grow flex items-center break-words relative">
                <span className="cursor-move mr-2 text-gray-400 select-none">⠿</span>
                <div className="flex items-center flex-shrink-0 mr-1">
                    {task.children.length > 0 ? (
                        <button onClick={() => onToggleExpand(task.id)} className="text-gray-500 focus:outline-none w-4">{isExpanded ? '▼' : '▶'}</button>
                    ) : (
                        <span className="text-gray-500 w-4 inline-block text-center">•</span>
                    )}
                </div>
                <div className="flex-grow">
                    <div>{task.text}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center space-x-2">
                        <span>{taskStart && taskEnd ? `${format(taskStart, 'yy-MM-dd')}~${format(taskEnd, 'yy-MM-dd')}` : ''}</span>
                        {dDayInfo && <span className={`px-2 py-0.5 rounded-full text-xs ${dDayInfo.color} bg-gray-100`}>{dDayInfo.text}</span>}
                    </div>
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onAddSubTask(task.id)} className="p-1 text-green-500 hover:text-green-700" title="하위 업무 추가">➕</button>
                    <button onClick={() => onEdit(task)} className="p-1 text-blue-500 hover:text-blue-700" title="수정">✏️</button>
                    <button onClick={() => onDelete(task.id)} className="p-1 text-red-500 hover:text-red-700" title="삭제">🗑️</button>
                </div>
            </div>
        </div>
    );
};

const GanttBar = ({ task, dates, dayWidth }) => {
    const taskStart = safeParseISO(task.start);
    const taskEnd = safeParseISO(task.end);
    const isMilestone = taskStart && taskEnd && isSameDay(taskStart, taskEnd);

    const style = useMemo(() => {
        if (!taskStart || !taskEnd || !dates || dates.length === 0) return { display: 'none' };
        const timelineStart = dates[0];
        const left = differenceInDays(taskStart, timelineStart) * dayWidth;
        const width = (differenceInDays(taskEnd, taskStart) + 1) * dayWidth;
        return { left: `${left}px`, width: `${width}px` };
    }, [taskStart, taskEnd, dates, dayWidth]);

    return (
        <div className="absolute h-5/6 top-1/2 -translate-y-1/2" style={style}>
            {isMilestone ? (
                <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-4 bg-purple-500 transform rotate-45" title={`${task.text} (Milestone)`}></div>
            ) : (
                <div className="relative h-full bg-blue-200 rounded-md overflow-hidden border border-blue-400">
                    <div className="h-full bg-blue-500" style={{ width: `${task.progress}%` }}></div>
                    <span className="absolute px-2 top-1/2 -translate-y-1/2 text-xs text-white font-semibold mix-blend-difference">{task.progress}%</span>
                </div>
            )}
        </div>
    );
};

// --- Main Component ---
const WBSWorkspaceTab = ({ project }) => {
    const [tasks, setTasks] = useState(() => recalculateAllTaskLevels(initialTasks));
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [isModalForSubTask, setIsModalForSubTask] = useState(false);
    const [expandedTaskIds, setExpandedTaskIds] = useState(new Set(tasks.filter(t => t.level === 1).map(t => t.id)));
    const [viewMode, setViewMode] = useState('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showWeekends, setShowWeekends] = useState(true);
    const [dayWidth, setDayWidth] = useState(32);
    const [taskListWidth, setTaskListWidth] = useState(450);
    const [draggedTaskId, setDraggedTaskId] = useState(null);
    const [dragOverTaskId, setDragOverTaskId] = useState(null);
    const timelineContainerRef = useRef(null);
    const taskListContainerRef = useRef(null);
    const scrollSyncRef = useRef(null);

    const taskTree = useMemo(() => buildTaskTree(tasks), [tasks]);
    const visibleTasks = useMemo(() => getVisibleTasks(taskTree, expandedTaskIds), [taskTree, expandedTaskIds]);

    const filteredDates = useMemo(() => {
        let start, end;
        if (viewMode === 'week') {
            start = startOfWeek(currentDate, { weekStartsOn: 1 });
            end = endOfWeek(currentDate, { weekStartsOn: 1 });
        } else if (viewMode === 'month') {
            start = startOfMonth(currentDate);
            end = endOfMonth(currentDate);
        } else {
            start = startOfYear(currentDate);
            end = endOfYear(currentDate);
        }
        let allDates = eachDayOfInterval({ start, end });
        return showWeekends ? allDates : allDates.filter(date => !isWeekend(date));
    }, [currentDate, viewMode, showWeekends]);

    const handleOpenModal = useCallback((task = null) => {
        setEditingTask(task);
        setIsModalForSubTask(false);
        setIsModalOpen(true);
    }, []);

    const handleAddSubTask = useCallback((parentId) => {
        setEditingTask({ parentId, text: '', start: format(new Date(), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd'), progress: 0 });
        setIsModalForSubTask(true);
        setIsModalOpen(true);
    }, []);

    const handleCloseModal = useCallback(() => setIsModalOpen(false), []);

    const handleSaveTask = useCallback((taskData) => {
        setTasks(prevTasks => {
            const newTasks = taskData.id
                ? prevTasks.map(t => t.id === taskData.id ? { ...t, ...taskData } : t)
                : [...prevTasks, { ...taskData, id: Math.max(0, ...prevTasks.map(t => t.id)) + 1 }];
            return recalculateAllTaskLevels(newTasks);
        });
        handleCloseModal();
    }, [handleCloseModal]);

    const handleDeleteTask = useCallback((taskId) => {
        if (window.confirm('이 업무와 모든 하위 업무를 삭제하시겠습니까?')) {
            setTasks(prevTasks => {
                const tasksToDelete = new Set();
                const queue = [taskId];
                tasksToDelete.add(taskId);
                while(queue.length > 0) {
                    const currentId = queue.shift();
                    const children = prevTasks.filter(t => t.parentId === currentId);
                    children.forEach(child => {
                        tasksToDelete.add(child.id);
                        queue.push(child.id);
                    });
                }
                return prevTasks.filter(t => !tasksToDelete.has(t.id));
            });
        }
    }, []);

    const handleToggleExpand = useCallback((taskId) => {
        setExpandedTaskIds(prev => {
            const newSet = new Set(prev);
            newSet.has(taskId) ? newSet.delete(taskId) : newSet.add(taskId);
            return newSet;
        });
    }, []);
    
    const handleExpandAll = useCallback(() => setExpandedTaskIds(new Set(tasks.map(t => t.id))), [tasks]);
    const handleCollapseAll = useCallback(() => setExpandedTaskIds(new Set()), []);

    const handleNavigate = (direction) => {
        const newDate = {
            week: direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1),
            month: direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1),
            year: direction === 'prev' ? subYears(currentDate, 1) : addYears(currentDate, 1),
        }[viewMode];
        setCurrentDate(newDate);
    };

    const handleZoom = (direction) => setDayWidth(prev => Math.max(16, Math.min(64, prev + (direction === 'in' ? 4 : -4))));

    const handleResize = useCallback((e) => {
        const startX = e.clientX;
        const startWidth = taskListWidth;
        const handleMouseMove = (me) => setTaskListWidth(Math.max(200, startWidth + me.clientX - startX));
        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [taskListWidth]);

    const isAncestor = (ancestorId, childId, taskMap) => {
        let current = taskMap.get(childId);
        while (current && current.parentId !== null) {
            if (current.parentId === ancestorId) return true;
            current = taskMap.get(current.parentId);
        }
        return false;
    };

    const dragHandlers = {
        onDragStart: (e, task) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', task.id);
            setDraggedTaskId(task.id);
        },
        onDragOver: (e, task) => {
            e.preventDefault();
            if (task.id !== draggedTaskId) setDragOverTaskId(task.id);
        },
        onDrop: (e, dropTargetTask) => {
            e.preventDefault();
            const draggedId = Number(e.dataTransfer.getData('text/plain'));
            setDragOverTaskId(null);
            setDraggedTaskId(null);
            if (draggedId === dropTargetTask.id) return;
            const taskMap = new Map(tasks.map(t => [t.id, t]));
            if (isAncestor(draggedId, dropTargetTask.id, taskMap)) {
                alert('자신의 하위 업무로 이동할 수 없습니다.');
                return;
            }
            const updatedTasks = tasks.map(t => t.id === draggedId ? { ...t, parentId: dropTargetTask.id } : t);
            setTasks(recalculateAllTaskLevels(updatedTasks));
        },
        onDragEnd: () => {
            setDraggedTaskId(null);
            setDragOverTaskId(null);
        }
    };
    
    const handleScroll = (source, e) => {
        if (scrollSyncRef.current === source) {
            scrollSyncRef.current = null;
            return;
        }
        const targetRef = source === 'taskList' ? timelineContainerRef : taskListContainerRef;
        if (targetRef.current) {
            scrollSyncRef.current = source === 'taskList' ? 'timeline' : 'taskList';
            targetRef.current.scrollTop = e.target.scrollTop;
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-gray-50 p-4">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-800">WBS - {project?.name || 'Gantt Chart'}</h1>
                <div className="flex items-center space-x-2">
                    <button onClick={() => handleNavigate('prev')} className="px-3 py-1 bg-gray-300 rounded-md hover:bg-gray-400">{'<'}</button>
                    <span className="font-semibold w-48 text-center">
                        {viewMode === 'month' && format(currentDate, 'yyyy년 MM월', { locale: ko })}
                        {viewMode === 'year' && format(currentDate, 'yyyy년', { locale: ko })}
                        {viewMode === 'week' && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yy.MM.dd')}~${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yy.MM.dd')}`}
                    </span>
                    <button onClick={() => handleNavigate('next')} className="px-3 py-1 bg-gray-300 rounded-md hover:bg-gray-400">{'>'}</button>
                    <select value={viewMode} onChange={(e) => setViewMode(e.target.value)} className="p-1 border border-gray-300 rounded-md">
                        <option value="week">주</option>
                        <option value="month">월</option>
                        <option value="year">년</option>
                    </select>
                    <label className="flex items-center space-x-1"><input type="checkbox" checked={showWeekends} onChange={(e) => setShowWeekends(e.target.checked)} /><span>주말</span></label>
                    <button onClick={() => handleZoom('out')} className="px-3 py-1 bg-gray-300 rounded-md hover:bg-gray-400">-</button>
                    <button onClick={() => handleZoom('in')} className="px-3 py-1 bg-gray-300 rounded-md hover:bg-gray-400">+</button>
                    <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow">+ 새 업무</button>
                </div>
            </div>

            <div className="flex-grow w-full flex border border-gray-300 rounded-lg shadow-md overflow-hidden">
                {/* Task List Pane */}
                <div style={{ width: taskListWidth, flexShrink: 0 }} className="flex flex-col bg-white border-r border-gray-300">
                    <div className="sticky top-0 z-30 bg-gray-200 p-2 border-b-2 border-gray-400 font-bold text-gray-700 flex justify-between items-center h-[88px]">
                        <span>업무 목록</span>
                        <div className="flex space-x-2">
                            <button onClick={handleExpandAll} className="px-2 py-1 text-xs bg-gray-100 rounded-md hover:bg-gray-200">모두 펼치기</button>
                            <button onClick={handleCollapseAll} className="px-2 py-1 text-xs bg-gray-100 rounded-md hover:bg-gray-200">모두 접기</button>
                        </div>
                    </div>
                    <div ref={taskListContainerRef} className="overflow-auto" onScroll={(e) => handleScroll('taskList', e)}>
                        {visibleTasks.map(task => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                onEdit={handleOpenModal}
                                onDelete={handleDeleteTask}
                                onAddSubTask={handleAddSubTask}
                                isExpanded={expandedTaskIds.has(task.id)}
                                onToggleExpand={handleToggleExpand}
                                showWeekends={showWeekends}
                                dragHandlers={dragHandlers}
                                draggedTaskId={draggedTaskId}
                                dragOverTaskId={dragOverTaskId}
                            />
                        ))}
                    </div>
                </div>

                <div className="cursor-ew-resize w-1.5 bg-gray-200 hover:bg-gray-400 transition-colors" onMouseDown={handleResize}></div>

                {/* Timeline Pane */}
                <div ref={timelineContainerRef} className="flex-grow overflow-auto" onScroll={(e) => handleScroll('timeline', e)}>
                    <div style={{ width: filteredDates.length * dayWidth, position: 'relative' }}>
                        <TimelineHeader dates={filteredDates} dayWidth={dayWidth} />
                        {visibleTasks.map(task => (
                            <div key={task.id} style={{ height: '3rem', position: 'relative' }}>
                                <GanttBar task={task} dates={filteredDates} dayWidth={dayWidth} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isModalOpen && <TaskModal task={editingTask} onSave={handleSaveTask} onClose={handleCloseModal} allTasks={tasks} isAddingSubTask={isModalForSubTask} />}
        </div>
    );
};

export default WBSWorkspaceTab;
