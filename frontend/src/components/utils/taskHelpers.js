import { format, eachDayOfInterval, getWeek, getMonth, getYear, parseISO, isWeekend, isValid, isSameDay, differenceInDays, startOfToday } from 'date-fns';

export const safeParseISO = (dateString) => {
    if (!dateString) return null;
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
};

export const buildTaskTree = (tasks) => {
    const taskMap = new Map(tasks.map(t => [t.id, { ...t, children: [] }]));
    const tree = [];
    tasks.forEach(task => {
        const currentTask = taskMap.get(task.id);
        if (task.parent_id && taskMap.has(task.parent_id)) {
            taskMap.get(task.parent_id).children.push(currentTask);
        } else {
            tree.push(currentTask);
        }
    });
    return tree;
};

export const getVisibleTasks = (taskTree, expandedTaskIds) => {
    const visible = [];
    const traverse = (tasks, level, parentIsExpanded) => {
        tasks.forEach(task => {
            if (parentIsExpanded) {
                visible.push({ ...task, level });
            }
            if (task.children && task.children.length > 0) {
                traverse(task.children, level + 1, parentIsExpanded && expandedTaskIds.has(task.id));
            }
        });
    };
    traverse(taskTree, 1, true);
    return visible;
};

export const calculateDday = (task, showWeekends) => {
    const startDate = safeParseISO(task.start_date);
    const endDate = safeParseISO(task.end_date);

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

export const calculateTimeProgress = (task, showWeekends) => {
    const startDate = safeParseISO(task.start_date);
    const endDate = safeParseISO(task.end_date);
    const today = startOfToday();

    if (!startDate || !endDate || startDate > endDate) return 0;

    let totalDays;
    let elapsedDays;

    if (showWeekends) {
        totalDays = differenceInDays(endDate, startDate) + 1;
        elapsedDays = differenceInDays(today, startDate);
    } else {
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        totalDays = allDays.filter(d => !isWeekend(d)).length;

        const elapsedInterval = { start: startDate, end: today > endDate ? endDate : today };
        elapsedDays = eachDayOfInterval(elapsedInterval).filter(d => !isWeekend(d)).length;

        if (today < startDate) elapsedDays = 0;
        if (today > endDate) elapsedDays = totalDays;
    }

    if (totalDays <= 0) return 0;
    const progress = (elapsedDays / totalDays) * 100;
    return Math.min(100, Math.max(0, progress));
};