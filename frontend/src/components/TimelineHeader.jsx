import React, { useMemo } from 'react';
import { format, getWeek, getMonth, getYear, isWeekend, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { safeParseISO } from './utils/taskHelpers';

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

export default TimelineHeader;
