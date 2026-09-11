import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { StudentManager } from './components/StudentManager';
import { SubjectManager } from './components/SubjectManager';
import { MarksEntry } from './components/MarksEntry';
import { AttendanceEntry } from './components/AttendanceEntry';
import { ResultGenerator } from './components/ResultView';
import { ClassResultView } from './components/ClassResultView';
import { Settings } from './components/Settings';
import { AccessRestrictedView } from './components/AccessRestrictedView';
import { Button } from './components/ui/Button';
import { Download, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Wrapper component to handle tab logic cleanly inside context
const AppContent = () => {
  const { exams, classes, t, language, schoolProfile, isAdmin } = useApp();
  const [activeTab, setActiveTab] = useState(() => {
    return isAdmin ? 'dashboard' : 'results';
  });
  
  // States for Result switching
  const [resultMode, setResultMode] = useState<'individual' | 'class'>('individual');
  const [classViewConfig, setClassViewConfig] = useState({ classLevel: classes[0]?.name || '', examId: '' });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
      document.title = (schoolProfile.nameBn || schoolProfile.name || t('madrasha')) + ' - Result System';
  }, [language, t, schoolProfile]);

  useEffect(() => {
    const root = document.documentElement;
    const font = schoolProfile.banglaFont || 'Hind Siliguri';
    const numFont = schoolProfile.banglaNumberFont || 'Hind Siliguri';
    
    root.style.setProperty('--bangla-font', `'${font}', 'Noto Sans Bengali', sans-serif`);
    root.style.setProperty('--bangla-num-font', `'${numFont}', 'Noto Sans Bengali', sans-serif`);
  }, [schoolProfile.banglaFont, schoolProfile.banglaNumberFont]);

  const handleDownloadTabulation = async () => {
      const element = document.getElementById('tabulation-sheet');
      if (!element) {
          alert('Content not ready');
          return;
      }
      
      setIsGenerating(true);

      // Dedicated off-screen stage at (0, 0)
      const stage = document.createElement('div');
      stage.id = 'tabulation-render-stage';
      stage.style.position = 'fixed';
      stage.style.left = '0';
      stage.style.top = '0';
      stage.style.zIndex = '-99999';

      try {
          if (typeof document !== 'undefined' && (document as any).fonts) {
              await (document as any).fonts.ready.catch(() => {});
          }

          // Measure natural table width
          const tableEl = element.querySelector('table');
          const minTargetWidth = 1123; // Exactly 297mm at 96 DPI
          const contentWidth = Math.max(tableEl ? tableEl.scrollWidth + 32 : element.scrollWidth, minTargetWidth);

          stage.style.width = `${contentWidth}px`;
          stage.style.backgroundColor = '#ffffff';
          stage.style.margin = '0';
          stage.style.padding = '0';
          stage.style.overflow = 'hidden';
          stage.style.boxSizing = 'border-box';
          document.body.appendChild(stage);

          const clone = element.cloneNode(true) as HTMLElement;
          clone.style.width = `${contentWidth}px`;
          clone.style.maxWidth = 'none';
          clone.style.margin = '0';
          clone.style.boxShadow = 'none';
          clone.style.backgroundColor = '#ffffff';

          // Ensure all inner scrollers are fully expanded
          clone.querySelectorAll('.overflow-x-auto').forEach((el: any) => {
              el.style.overflow = 'visible';
              el.style.width = '100%';
              el.style.maxWidth = 'none';
          });

          // Strip any shadows or unwanted decorations
          clone.querySelectorAll('*').forEach((el: any) => {
              if (el.style) el.style.boxShadow = 'none';
              el.classList.remove('shadow-2xl', 'shadow-xl', 'shadow-lg', 'shadow-md', 'shadow-sm', 'shadow');
          });

          stage.appendChild(clone);
          await new Promise(resolve => setTimeout(resolve, 150));

          const canvas = await html2canvas(stage, {
              scale: 2.2, // Crisp high-res rendering
              useCORS: true,
              logging: false,
              allowTaint: true,
              backgroundColor: '#ffffff',
              scrollX: 0,
              scrollY: 0,
              x: 0,
              y: 0,
              width: contentWidth,
              height: stage.offsetHeight
          });

          // Standard A4 Landscape: 297mm x 210mm
          const pdf = new jsPDF({
              orientation: 'landscape',
              unit: 'mm',
              format: 'a4',
              compress: true
          });

          const pageWidth = 297;
          const pageHeight = 210;
          const margin = 5; // 5mm uniform margin
          const printableWidth = pageWidth - (margin * 2); // 287mm
          const printableHeight = pageHeight - (margin * 2); // 200mm

          // Strictly fit entire tabulation sheet on EXACTLY ONE page without leaving anything out
          const scaleW = printableWidth / canvas.width;
          const scaleH = printableHeight / canvas.height;
          const fitScale = Math.min(scaleW, scaleH);

          const renderWidth = canvas.width * fitScale;
          const renderHeight = canvas.height * fitScale;
          const xOffset = margin + Math.max(0, (printableWidth - renderWidth) / 2);
          const yOffset = margin + Math.max(0, (printableHeight - renderHeight) / 2);

          const imgData = canvas.toDataURL('image/jpeg', 0.96);
          pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST');

          const examName = exams.find(e => e.id === classViewConfig.examId)?.name || 'Exam';
          pdf.save(`Tabulation_${classViewConfig.classLevel}_${examName}.pdf`);
      } catch (err) {
          console.error('Error generating Tabulation PDF:', err);
          alert('Error generating Tabulation PDF. Please try again.');
      } finally {
          if (document.body.contains(stage)) {
              document.body.removeChild(stage);
          }
          setIsGenerating(false);
      }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': 
        return <Dashboard />;
      case 'students': 
        return isAdmin ? <StudentManager /> : <AccessRestrictedView moduleName={t('students')} onGoToResults={() => setActiveTab('results')} />;
      case 'subjects': 
        return isAdmin ? <SubjectManager /> : <AccessRestrictedView moduleName={t('subjects')} onGoToResults={() => setActiveTab('results')} />;
      case 'marks': 
        return isAdmin ? <MarksEntry /> : <AccessRestrictedView moduleName={t('marks')} onGoToResults={() => setActiveTab('results')} />;
      case 'attendance': 
        return isAdmin ? <AttendanceEntry /> : <AccessRestrictedView moduleName={t('attendance')} onGoToResults={() => setActiveTab('results')} />;
      case 'settings': 
        return isAdmin ? <Settings /> : <AccessRestrictedView moduleName={t('settings')} onGoToResults={() => setActiveTab('results')} />;
      case 'results': 
        return (
            <div className="space-y-4">
               {/* Toggle for Result Type */}
               <div className="bg-white p-1.5 rounded-2xl shadow-xs border border-slate-200/80 inline-flex gap-1.5 print:hidden mb-2">
                  <button 
                    onClick={() => setResultMode('individual')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${resultMode === 'individual' ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-100 text-slate-600'}`}
                  >
                    {t('individualCards')}
                  </button>
                  <button 
                    onClick={() => setResultMode('class')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${resultMode === 'class' ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-100 text-slate-600'}`}
                  >
                    {t('tabulationSheet')}
                  </button>
               </div>

               {resultMode === 'individual' ? (
                   <ResultGenerator />
               ) : (
                   <div className="space-y-4">
                        <div className="flex flex-wrap gap-3 bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 print:hidden items-center">
                            <select 
                                className="border border-slate-200 rounded-xl p-2.5 bg-white text-slate-800 text-xs font-medium min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onChange={(e) => setClassViewConfig({...classViewConfig, examId: e.target.value})}
                                value={classViewConfig.examId}
                            >
                                <option value="">{t('selectExam')}</option>
                                {exams.map(e => <option key={e.id} value={e.id}>{language === 'bn' ? (e.nameBn || e.name) : e.name}</option>)}
                            </select>
                            <select 
                                className="border border-slate-200 rounded-xl p-2.5 bg-white text-slate-800 text-xs font-medium min-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={classViewConfig.classLevel}
                                onChange={(e) => setClassViewConfig({...classViewConfig, classLevel: e.target.value})}
                            >
                                {classes.map(c => <option key={c.id} value={c.name}>{language === 'bn' ? (t(`cls_${c.name.replace(' ', '')}` as any) || c.name) : c.name}</option>)}
                            </select>
                            
                            {classViewConfig.examId && (
                                <Button onClick={handleDownloadTabulation} disabled={isGenerating} variant="secondary">
                                    {isGenerating ? <Loader2 className="animate-spin mr-2" size={16}/> : <Download size={16} className="mr-2"/>}
                                    {t('downloadSheet')}
                                </Button>
                            )}
                        </div>
                        {classViewConfig.examId && (
                            <div id="tabulation-sheet" className="print-container">
                                <ClassResultView exam={exams.find(e => e.id === classViewConfig.examId)!} classLevel={classViewConfig.classLevel} />
                            </div>
                        )}
                   </div>
               )}
            </div>
        );
      default: return <Dashboard />;
    }
  };

  return (
    <div className={language === 'bn' ? 'font-bangla' : ''}>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>
    </div>
  );
};

const App = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
