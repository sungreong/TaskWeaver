import React from 'react';
import { format } from 'date-fns';
import { safeParseISO, calculateDday } from './utils/taskHelpers';

const TaskRow = ({ task, onToggleExpand, isExpanded, showWeekends, dragHandlers, draggedTaskId, dragOverTaskId, onEdit, onDelete, onAddSubTask }) => {
    const dDayInfo = calculateDday(task, showWeekends);
    const taskStart = safeParseISO(task.start_date);
    const taskEnd = safeParseISO(task.end_date);

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
                    {task.children && task.children.length > 0 ? (
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

export default TaskRow;
