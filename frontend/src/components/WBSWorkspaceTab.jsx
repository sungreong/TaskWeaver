import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    format, eachDayOfInterval,
    startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
    isWeekend, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears
} from 'date-fns';
import { ko } from 'date-fns/locale';

import TaskModal from './TaskModal';
import TimelineHeader from './TimelineHeader';
import TaskRow from './TaskRow';
import GanttBar from './GanttBar';
import { wbsTaskAPI } from '../services/api'; // API 임포트
import { getVisibleTasks } from './utils/taskHelpers'; // 일부 헬퍼는 계속 사용

// 트리 구조를 평탄화하는 헬퍼 함수
const flattenTree = (taskTree) => {
    const flat = [];
    const traverse = (tasks, level) => {
        tasks.forEach(task => {
            const { children, ...rest } = task;
            flat.push({ ...rest, level });
            if (children && children.length > 0) {
                traverse(children, level + 1);
            }
        });
    };
    traverse(taskTree, 1);
    return flat;
};

const WBSWorkspaceTab = ({ project }) => {
    const [tasks, setTasks] = useState([]); // 초기 상태는 빈 배열
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [isModalForSubTask, setIsModalForSubTask] = useState(false);
    const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());
    const [viewMode, setViewMode] = useState('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showWeekends, setShowWeekends] = useState(true);
    const [dayWidth, setDayWidth] = useState(32);
    const [taskListWidth, setTaskListWidth] = useState(450);
    const [draggedTaskId, setDraggedTaskId] = useState(null);
    const [dragOverTaskId, setDragOverTaskId] = useState(null);
    const timelineContainerRef = useRef(null);
    const taskListContainerRef = useRef(null);
    const activePane = useRef(null);

    // API로부터 태스크를 로드하는 함수
    const fetchTasks = useCallback(async () => {
        if (!project || !project.id) {
            setTasks([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await wbsTaskAPI.getTasks(project.id);
            const taskTree = response.data || [];
            setTasks(taskTree);
            // 기본적으로 최상위 태스크는 펼친 상태로 시작
            setExpandedTaskIds(new Set(taskTree.map(t => t.id)));
        } catch (err) {
            setError("WBS 데이터를 불러오는 데 실패했습니다.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [project]);

    // 프로젝트가 변경될 때마다 태스크를 다시 로드
    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const flatTasks = useMemo(() => flattenTree(tasks), [tasks]);
    const visibleTasks = useMemo(() => getVisibleTasks(tasks, expandedTaskIds), [tasks, expandedTaskIds]);

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
        setEditingTask({ parent_id: parentId, text: '', start_date: format(new Date(), 'yyyy-MM-dd'), end_date: format(new Date(), 'yyyy-MM-dd'), progress: 0 });
        setIsModalForSubTask(true);
        setIsModalOpen(true);
    }, []);

    const handleCloseModal = useCallback(() => setIsModalOpen(false), []);

    const handleSaveTask = useCallback(async (taskData) => {
        const { id, ...dataToSave } = taskData;
        const payload = { ...dataToSave, project_id: project.id };
        
        // Ensure parent_id is null if it's an empty string or undefined
        if (payload.parent_id === '' || payload.parent_id === undefined) {
            payload.parent_id = null;
        }

        try {
            if (id) {
                await wbsTaskAPI.updateTask(id, payload);
            } else {
                await wbsTaskAPI.createTask(payload);
            }
            fetchTasks(); // 데이터 리프레시
        } catch (err) {
            console.error("Task save error:", err);
            setError("업무 저장에 실패했습니다.");
        }
        handleCloseModal();
    }, [project, fetchTasks, handleCloseModal]);

    const handleDeleteTask = useCallback(async (taskId) => {
        if (window.confirm('이 업무와 모든 하위 업무를 삭제하시겠습니까?')) {
            try {
                await wbsTaskAPI.deleteTask(taskId);
                fetchTasks(); // 데이터 리프레시
            } catch (err) {
                console.error("Task delete error:", err);
                setError("업무 삭제에 실패했습니다.");
            }
        }
    }, [fetchTasks]);

    const handleToggleExpand = useCallback((taskId) => {
        setExpandedTaskIds(prev => {
            const newSet = new Set(prev);
            newSet.has(taskId) ? newSet.delete(taskId) : newSet.add(taskId);
            return newSet;
        });
    }, []);
    
    const handleExpandAll = useCallback(() => setExpandedTaskIds(new Set(flatTasks.map(t => t.id))), [flatTasks]);
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
        onDrop: async (e, dropTargetTask) => {
            e.preventDefault();
            const draggedId = Number(e.dataTransfer.getData('text/plain'));
            setDragOverTaskId(null);
            setDraggedTaskId(null);
            if (draggedId === dropTargetTask.id) return;

            try {
                await wbsTaskAPI.updateTask(draggedId, { parent_id: dropTargetTask.id });
                fetchTasks();
            } catch (err) {
                console.error("Drag drop error:", err);
                setError("업무 이동에 실패했습니다.");
            }
        },
        onDragEnd: () => {
            setDraggedTaskId(null);
            setDragOverTaskId(null);
        }
    };
    
    useEffect(() => {
        const taskListEl = taskListContainerRef.current;
        const timelineEl = timelineContainerRef.current;

        const syncScroll = (source, target) => () => {
            if (activePane.current === source) {
                target.scrollTop = source.scrollTop;
            }
        };

        const taskListScroll = syncScroll(taskListEl, timelineEl);
        const timelineScroll = syncScroll(timelineEl, taskListEl);

        if (taskListEl && timelineEl) {
            taskListEl.addEventListener('scroll', taskListScroll);
            timelineEl.addEventListener('scroll', timelineScroll);

            const setTaskListActive = () => activePane.current = taskListEl;
            const setTimelineActive = () => activePane.current = timelineEl;

            taskListEl.addEventListener('mouseenter', setTaskListActive);
            timelineEl.addEventListener('mouseenter', setTimelineActive);

            return () => {
                taskListEl.removeEventListener('scroll', taskListScroll);
                timelineEl.removeEventListener('scroll', timelineScroll);
                taskListEl.removeEventListener('mouseenter', setTaskListActive);
                timelineEl.removeEventListener('mouseenter', setTimelineActive);
            };
        }
    }, [activePane]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div className="text-red-500">Error: {error}</div>;

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
                    <div ref={taskListContainerRef} className="overflow-auto">
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
                <div ref={timelineContainerRef} className="flex-grow overflow-auto">
                    <div style={{ width: filteredDates.length * dayWidth, position: 'relative' }}>
                        <TimelineHeader dates={filteredDates} dayWidth={dayWidth} />
                        {visibleTasks.map(task => (
                            <div key={task.id} style={{ height: '3rem', position: 'relative' }}>
                                <GanttBar task={task} dates={filteredDates} dayWidth={dayWidth} showWeekends={showWeekends} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isModalOpen && <TaskModal task={editingTask} onSave={handleSaveTask} onClose={handleCloseModal} allTasks={flatTasks} isAddingSubTask={isModalForSubTask} />}
        </div>
    );
};

export default WBSWorkspaceTab;
