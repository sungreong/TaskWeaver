import React, { useMemo } from 'react';
import { differenceInDays, isSameDay, startOfToday } from 'date-fns';
import { safeParseISO, calculateTimeProgress } from './utils/taskHelpers';

const GanttBar = ({ task, dates, dayWidth, showWeekends }) => {
    const taskStart = safeParseISO(task.start_date);
    const taskEnd = safeParseISO(task.end_date);
    const isMilestone = taskStart && taskEnd && isSameDay(taskStart, taskEnd);

    const style = useMemo(() => {
        if (!taskStart || !taskEnd || !dates || dates.length === 0) return { display: 'none' };
        const timelineStart = dates[0];
        const left = differenceInDays(taskStart, timelineStart) * dayWidth;
        const width = (differenceInDays(taskEnd, taskStart) + 1) * dayWidth;
        return { left: `${left}px`, width: `${width}px` };
    }, [taskStart, taskEnd, dates, dayWidth]);

    const timeProgress = useMemo(() => {
        return calculateTimeProgress(task, showWeekends);
    }, [task, showWeekends]);

    return (
        <div className="absolute h-5/6 top-1/2 -translate-y-1/2" style={style}>
            {isMilestone ? (
                <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-4 bg-purple-500 transform rotate-45" title={`${task.text} (Milestone)`}></div>
            ) : (
                <div className="relative h-full bg-blue-200 rounded-md overflow-hidden border border-blue-400">
                    <div className="h-full bg-blue-500" style={{ width: `${task.progress}%` }}></div>
                    <div className="absolute top-0 left-0 h-full bg-gray-400 opacity-50" style={{ width: `${timeProgress}%` }}></div>
                    <span className="absolute px-2 top-1/2 -translate-y-1/2 text-xs text-white font-semibold" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}>{task.progress}%</span>
                </div>
            )}
        </div>
    );
};

export default GanttBar;
