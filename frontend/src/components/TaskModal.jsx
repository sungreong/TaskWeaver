import React, { useState, useMemo, useEffect } from 'react';
import { format, addDays, isWeekend, eachDayOfInterval, differenceInDays } from 'date-fns';
import { safeParseISO } from './utils/taskHelpers';

const TaskModal = ({ task, onSave, onClose, allTasks, isAddingSubTask = false }) => {
    const [formData, setFormData] = useState({});
    const [durationDays, setDurationDays] = useState('');
    const [useBusinessDays, setUseBusinessDays] = useState(false);
    const [hasDeliverables, setHasDeliverables] = useState(false);

    // Task 데이터가 변경될 때마다 formData 상태를 초기화합니다.
    useEffect(() => {
        const initialData = task || { parent_id: null, text: '', start_date: '', end_date: '', progress: 0, deliverables: '', remarks: '' };
        setFormData(initialData);
        setHasDeliverables(!!initialData.deliverables);

        // 기간(일) 필드 초기화
        if (initialData.start_date && initialData.end_date) {
            const start = safeParseISO(initialData.start_date);
            const end = safeParseISO(initialData.end_date);
            if (start && end) {
                const diff = differenceInDays(end, start) + 1;
                setDurationDays(diff > 0 ? diff : '');
            }
        } else {
            setDurationDays('');
        }
    }, [task]);

    // 기간(일) 또는 시작일이 변경되면 종료일을 자동 계산합니다.
    useEffect(() => {
        if (formData.start_date && durationDays) {
            const startDate = safeParseISO(formData.start_date);
            if (startDate) {
                let calculatedEndDate;
                const duration = parseInt(durationDays, 10);
                if (useBusinessDays) {
                    let daysAdded = 0;
                    let currentDay = startDate;
                    // 기간이 1일일 경우 당일을 종료일로 설정
                    if (duration === 1 && !isWeekend(currentDay)) {
                        calculatedEndDate = currentDay;
                    } else {
                        while (daysAdded < duration -1) {
                            currentDay = addDays(currentDay, 1);
                            if (!isWeekend(currentDay)) {
                                daysAdded++;
                            }
                        }
                        calculatedEndDate = currentDay;
                    }
                } else {
                    calculatedEndDate = addDays(startDate, duration - 1);
                }
                setFormData(prev => ({ ...prev, end_date: format(calculatedEndDate, 'yyyy-MM-dd') }));
            }
        }
    }, [formData.start_date, durationDays, useBusinessDays]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // 종료일을 직접 수정하면 기간(일) 필드를 초기화합니다.
        if (name === 'end_date') {
            setDurationDays('');
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDurationChange = (e) => {
        const value = e.target.value;
        setDurationDays(value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.text || !formData.start_date || !formData.end_date) {
            alert('업무명, 시작일, 종료일은 필수 항목입니다.');
            return;
        }
        onSave({ ...formData, progress: Number(formData.progress) });
    };

    const parentTaskOptions = allTasks.filter(t => t.id !== (task && task.id) && (!task || t.level < 5));

    // 상위 업무의 날짜 범위와 안내 텍스트를 계산합니다.
    const parentInfo = useMemo(() => {
        if (!formData.parent_id) return { minDate: '', maxDate: '', rangeText: '' };

        const parent = allTasks.find(t => t.id === formData.parent_id);
        if (!parent) return { minDate: '', maxDate: '', rangeText: '' };

        const minDate = parent.start_date ? format(safeParseISO(parent.start_date), 'yyyy-MM-dd') : '';
        const maxDate = parent.end_date ? format(safeParseISO(parent.end_date), 'yyyy-MM-dd') : '';
        const rangeText = minDate && maxDate ? `(상위 업무 기간: ${minDate} ~ ${maxDate})` : '';

        return { minDate, maxDate, rangeText };
    }, [formData.parent_id, allTasks]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-bold mb-4">{task && task.id ? '업무 수정' : '새 업무 추가'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">상위 업무</label>
                            <select name="parent_id" value={formData.parent_id || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" disabled={isAddingSubTask}>
                                <option value="">없음 (최상위 업무)</option>
                                {parentTaskOptions.map(opt => <option key={opt.id} value={opt.id}>{'--'.repeat(opt.level-1) + opt.text}</option>)}
                            </select>
                            {parentInfo.rangeText && <p className="text-xs text-blue-600 mt-1">{parentInfo.rangeText}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">업무명</label>
                            <input type="text" name="text" value={formData.text} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
                        </div>
                        <div className="flex space-x-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700">시작일</label>
                                <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} min={parentInfo.minDate} max={parentInfo.maxDate} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700">기간 (일)</label>
                                <input type="number" name="durationDays" value={durationDays} onChange={handleDurationChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="일수 입력 시 자동 계산" />
                            </div>
                        </div>
                        <div className="flex items-center mt-2">
                            <input type="checkbox" id="useBusinessDays" checked={useBusinessDays} onChange={(e) => setUseBusinessDays(e.target.checked)} className="mr-2" />
                            <label htmlFor="useBusinessDays" className="text-sm text-gray-700">주말 제외 (영업일)</label>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">종료일</label>
                            <input type="date" name="end_date" value={formData.end_date} onChange={handleChange} min={formData.start_date || parentInfo.minDate} max={parentInfo.maxDate} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">진행률 ({formData.progress}%)</label>
                            <input type="range" name="progress" min="0" max="100" value={formData.progress} onChange={handleChange} className="mt-1 block w-full" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">산출물 유무</label>
                                <select name="hasDeliverables" value={hasDeliverables ? 'yes' : 'no'} onChange={(e) => setHasDeliverables(e.target.value === 'yes')} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                    <option value="no">없음</option>
                                    <option value="yes">있음</option>
                                </select>
                            </div>
                            {hasDeliverables && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">산출물</label>
                                    <textarea name="deliverables" value={formData.deliverables} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"></textarea>
                                </div>
                            )}
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
};

export default TaskModal;