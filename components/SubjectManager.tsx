import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Subject } from '../types';
import { Button } from './ui/Button';
import { Plus, Trash2, Edit2, X } from 'lucide-react';

export const SubjectManager = () => {
  const { subjects, addSubject, updateSubject, deleteSubject, classes, exams, t, language } = useApp();
  const [mode, setMode] = useState<'manage' | 'assign'>('manage');
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '');
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newSubject, setNewSubject] = useState<Omit<Subject, 'id'>>({
    name: '',
    nameBn: '',
    classLevel: selectedClass,
    examIds: [],
    fullMarks: 100,
    passMarks: 33,
    isOptional: false,
    order: 0,
    hasCQ: false,
    cqMarks: 70,
    cqPassMarks: 23,
    hasMCQ: false,
    mcqMarks: 30,
    mcqPassMarks: 10,
    group: ''
  });

  // Effect to update form's class level when selected class changes in view
  useEffect(() => {
      setNewSubject(prev => ({ ...prev, classLevel: selectedClass }));
  }, [selectedClass]);

  const filteredSubjects = subjects
    .filter(s => s.classLevel === selectedClass)
    .sort((a, b) => a.order - b.order);

  // Auto-calculate full marks/pass marks if CQ/MCQ selected
  useEffect(() => {
    let totalFull = 0;
    let totalPass = 0;
    
    if (newSubject.hasCQ || newSubject.hasMCQ) {
        if (newSubject.hasCQ) {
            totalFull += (newSubject.cqMarks || 0);
            totalPass += (newSubject.cqPassMarks || 0);
        }
        if (newSubject.hasMCQ) {
            totalFull += (newSubject.mcqMarks || 0);
            totalPass += (newSubject.mcqPassMarks || 0);
        }
        setNewSubject(prev => ({ ...prev, fullMarks: totalFull, passMarks: totalPass }));
    }
  }, [newSubject.hasCQ, newSubject.cqMarks, newSubject.cqPassMarks, newSubject.hasMCQ, newSubject.mcqMarks, newSubject.mcqPassMarks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
        updateSubject({ ...newSubject, id: editingId });
        setEditingId(null);
    } else {
        addSubject({ ...newSubject, classLevel: selectedClass, order: filteredSubjects.length + 1 });
    }
    
    // Reset but keep class/CQ settings for easier entry of subsequent subjects
    setNewSubject(prev => ({ 
        ...prev, 
        name: '', 
        nameBn: '',
        order: 0,
    }));
  };

  const handleEdit = (subject: Subject) => {
      setNewSubject(subject);
      setEditingId(subject.id);
      setSelectedClass(subject.classLevel); // Switch view to that class
  };

  const handleCancel = () => {
      setEditingId(null);
      setNewSubject({
        name: '',
        nameBn: '',
        classLevel: selectedClass,
        examIds: [],
        fullMarks: 100,
        passMarks: 33,
        isOptional: false,
        order: 0,
        hasCQ: false,
        cqMarks: 70,
        cqPassMarks: 23,
        hasMCQ: false,
        mcqMarks: 30,
        mcqPassMarks: 10,
        group: ''
      });
  };

  const toggleSubjectExam = (subject: Subject) => {
      const currentExamIds = subject.examIds || [];
      const isAssigned = currentExamIds.includes(selectedExamId);
      
      let newExamIds;
      if (isAssigned) {
          newExamIds = currentExamIds.filter(id => id !== selectedExamId);
      } else {
          newExamIds = [...currentExamIds, selectedExamId];
      }
      
      updateSubject({ ...subject, examIds: newExamIds });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('subjectConfig')}</h2>
          <p className="text-gray-500 text-sm">{t('configSubjectsDesc')}</p>
        </div>
        <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-100 inline-flex">
            <button 
                onClick={() => setMode('manage')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'manage' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
            >
                Manage Subjects
            </button>
            <button 
                onClick={() => setMode('assign')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'assign' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
            >
                Assign to Exam
            </button>
        </div>
      </div>

      {mode === 'assign' ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-wrap gap-4 items-center mb-6">
                <div className="flex gap-2 items-center">
                    <label className="font-medium text-gray-700">{t('exam')}:</label>
                    <select 
                        className="border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        value={selectedExamId}
                        onChange={(e) => setSelectedExamId(e.target.value)}
                    >
                        {exams.map(e => (
                            <option key={e.id} value={e.id}>{language === 'bn' ? (e.nameBn || e.name) : e.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2 items-center">
                    <label className="font-medium text-gray-700">{t('selectClass')}:</label>
                    <select 
                        className="border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                    >
                        {classes.map(c => (
                            <option key={c.id} value={c.name}>{language === 'bn' ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredSubjects.map(sub => {
                    const isAssigned = (sub.examIds || []).includes(selectedExamId);
                    return (
                        <div 
                            key={sub.id}
                            onClick={() => toggleSubjectExam(sub)}
                            className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center justify-center text-center transition-all ${isAssigned ? 'bg-green-50 border-green-500 text-green-700 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                        >
                            <span className="font-semibold">{language === 'bn' ? (sub.nameBn || sub.name) : sub.name}</span>
                            {sub.group && <span className="text-xs mt-1 opacity-80">{t(sub.group.toLowerCase() as any) || sub.group}</span>}
                        </div>
                    );
                })}
                {filteredSubjects.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                        No subjects found for this class. Add subjects first.
                    </div>
                )}
            </div>
        </div>
      ) : (
      <>
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 items-center">
          <label className="font-medium text-gray-700">{t('selectClass')}:</label>
          <select 
            className="border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            value={selectedClass}
            onChange={(e) => {
                setSelectedClass(e.target.value);
                handleCancel(); // Reset form when switching class
            }}
          >
            {classes.map(c => (
              <option key={c.id} value={c.name}>{language === 'bn' ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700">{t('order')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">{t('subjectName')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">{t('fullMarks')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">{t('passMarks')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">{t('type')}</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSubjects.length === 0 ? (
                     <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">{t('noData')}</td></tr>
                  ) : (
                    filteredSubjects.map((sub) => (
                      <tr key={sub.id} className={editingId === sub.id ? "bg-blue-50" : ""}>
                        <td className="px-4 py-2">{sub.order}</td>
                        <td className="px-4 py-2 font-bold text-gray-900 truncate max-w-[180px] font-bangla">
                            {language === 'bn' ? (sub.nameBn || sub.name) : sub.name}
                            {sub.group && <span className="ml-2 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-bold uppercase">{t(sub.group.toLowerCase() as any) || sub.group}</span>}
                            <div className="text-[10px] text-gray-400 font-medium">
                                {sub.hasCQ ? `CQ: ${sub.cqMarks} ` : ''} 
                                {sub.hasMCQ ? `MCQ: ${sub.mcqMarks}` : ''}
                            </div>
                        </td>
                        <td className="px-4 py-2">{sub.fullMarks}</td>
                        <td className="px-4 py-2">{sub.passMarks}</td>
                        <td className="px-4 py-2">
                          {sub.isOptional ? 
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">{t('optional')}</span> : 
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{t('core')}</span>}
                        </td>
                        <td className="px-4 py-2 flex gap-2">
                          <button onClick={() => handleEdit(sub)} className="text-blue-600 hover:text-blue-800">
                             <Edit2 size={16} />
                          </button>
                          <button onClick={() => deleteSubject(sub.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
             </table>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800">{editingId ? t('update') : t('addSubject')}</h3>
            {editingId && (
                <button onClick={handleCancel} className="text-xs text-red-500 flex items-center hover:underline">
                    <X size={12} className="mr-1"/> Cancel
                </button>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('subjectName')}</label>
              <input required type="text" className="w-full border rounded-md p-2 text-sm bg-white text-gray-900" 
                value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} 
                placeholder="e.g. Mathematics"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('subjectName')} (Bangla)</label>
              <input type="text" className="w-full border rounded-md p-2 text-sm bg-white text-gray-900 font-bangla" 
                value={newSubject.nameBn || ''} onChange={e => setNewSubject({...newSubject, nameBn: e.target.value})} 
                placeholder="e.g. গণিত"
              />
            </div>
            {(selectedClass === 'Class 9' || selectedClass === 'Class 10' || selectedClass.includes('9') || selectedClass.includes('10') || selectedClass.includes('৯') || selectedClass.includes('১০')) && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('group')}</label>
                <select className="w-full border rounded-md p-2 text-sm bg-white text-gray-900" 
                  value={newSubject.group === 'All' ? '' : (newSubject.group || '')} onChange={e => setNewSubject({...newSubject, group: e.target.value as any})} 
                >
                  <option value="">All Groups</option>
                  <option value="General">{t('general') || 'General'}</option>
                  <option value="Science">{t('science')}</option>
                </select>
              </div>
            )}
            
            {/* CQ / MCQ Toggles */}
            <div className="flex gap-4 border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="hasCQ" 
                    checked={newSubject.hasCQ} onChange={e => setNewSubject({...newSubject, hasCQ: e.target.checked})}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="hasCQ" className="text-sm text-gray-700 font-semibold">{t('enableCQ')}</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="hasMCQ" 
                    checked={newSubject.hasMCQ} onChange={e => setNewSubject({...newSubject, hasMCQ: e.target.checked})}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="hasMCQ" className="text-sm text-gray-700 font-semibold">{t('enableMCQ')}</label>
                </div>
            </div>

            {newSubject.hasCQ && (
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-2 rounded">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('cqMarks')}</label>
                        <input type="number" className="w-full border rounded-md p-2 text-sm bg-white text-gray-900" 
                        value={newSubject.cqMarks ?? ''} onChange={e => setNewSubject({...newSubject, cqMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('cqPass')}</label>
                        <input type="number" className="w-full border rounded-md p-2 text-sm bg-white text-gray-900" 
                        value={newSubject.cqPassMarks ?? ''} onChange={e => setNewSubject({...newSubject, cqPassMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                        />
                    </div>
                </div>
            )}

            {newSubject.hasMCQ && (
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-2 rounded">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('mcqMarks')}</label>
                        <input type="number" className="w-full border rounded-md p-2 text-sm bg-white text-gray-900" 
                        value={newSubject.mcqMarks ?? ''} onChange={e => setNewSubject({...newSubject, mcqMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('mcqPass')}</label>
                        <input type="number" className="w-full border rounded-md p-2 text-sm bg-white text-gray-900" 
                        value={newSubject.mcqPassMarks ?? ''} onChange={e => setNewSubject({...newSubject, mcqPassMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                        />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('fullMarks')}</label>
                <input type="number" className="w-full border rounded-md p-2 text-sm bg-gray-100 text-gray-900 font-bold" 
                  value={newSubject.fullMarks ?? ''} 
                  readOnly={newSubject.hasCQ || newSubject.hasMCQ}
                  onChange={e => setNewSubject({...newSubject, fullMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('passMarks')}</label>
                <input type="number" className="w-full border rounded-md p-2 text-sm bg-gray-100 text-gray-900 font-bold" 
                  value={newSubject.passMarks ?? ''}
                  readOnly={newSubject.hasCQ || newSubject.hasMCQ} 
                  onChange={e => setNewSubject({...newSubject, passMarks: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="isOptional" 
                checked={newSubject.isOptional} onChange={e => setNewSubject({...newSubject, isOptional: e.target.checked})}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isOptional" className="text-sm text-gray-700">{t('isOptional')}</label>
            </div>
            
            <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700">{t('displayOrder')}</label>
                <input type="number" className="w-full border rounded-md p-2 text-sm bg-white text-gray-900" 
                    value={newSubject.order ?? ''} onChange={e => setNewSubject({...newSubject, order: e.target.value === '' ? 0 : parseInt(e.target.value)})} 
                />
            </div>

            <Button type="submit" className="w-full">
              {editingId ? <Edit2 size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />} 
              {editingId ? t('update') : t('addSubject')}
            </Button>
          </form>
        </div>
      </div>
      </>
      )}
    </div>
  );
};