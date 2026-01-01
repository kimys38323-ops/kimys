
import React, { useState, useCallback, useRef } from 'react';
import { GeminiService } from './geminiService';
import { AppState, ScriptPart, ImageModel, AspectRatio } from './types';

const gemini = new GeminiService();

interface SectionProps {
  title: string;
  parts: ScriptPart[];
  bgColor: string;
  cleanContent: (t: string) => string;
}

const Section: React.FC<SectionProps> = ({ title, parts = [], bgColor, cleanContent }) => (
  <div className={`${bgColor} p-6 rounded-3xl shadow-sm border border-black/5 transition-all hover:shadow-md animate-fadeIn mb-8`}>
    <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-gray-800">
      <span className="w-2.5 h-8 bg-orange-400 rounded-full inline-block shadow-sm"></span>
      {title}
    </h3>
    <div className="space-y-6">
      {parts.length > 0 ? (
        parts.map((p, i) => {
          const isBrother = p.speaker.toLowerCase().includes('brother') || p.speaker.includes('형제님') || p.speaker.includes('오빠');
          return (
            <div key={i} className={`flex ${isBrother ? 'flex-row' : 'flex-row-reverse'} items-start gap-4`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-inner border-2 border-white flex-shrink-0 ${isBrother ? 'bg-blue-100' : 'bg-pink-100'}`}>
                {isBrother ? '👨' : '👩'}
              </div>
              <div className={`bg-white p-5 rounded-2xl shadow-sm max-w-[85%] border border-gray-100 relative ${isBrother ? 'rounded-tl-none' : 'rounded-tr-none'}`}>
                <p className="font-black text-[10px] text-gray-400 mb-2 uppercase tracking-widest">{isBrother ? '형제님' : '자매님'}</p>
                <p className="text-gray-800 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium">{cleanContent(p.content)}</p>
              </div>
            </div>
          );
        })
      ) : (
        <div className="bg-gray-50/50 p-10 rounded-2xl border-2 border-dashed border-gray-100 text-center">
          <p className="text-gray-300 text-sm font-bold">내용을 생성할 수 없습니다.</p>
        </div>
      )}
    </div>
  </div>
);

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    input: '',
    isLoading: false,
    script: null,
    error: null,
    isAudioLoading: false,
    isImageLoading: false,
    generatedImage: null,
    selectedModel: 'gemini-2.5-flash-image', 
    selectedAspectRatio: '16:9',
  });

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const cleanContent = (text: string) => text ? text.replace(/\(.*?\)|\[.*?\]/g, "").trim() : "";

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      alert("복사 실패");
    }
  };

  const saveAsTxt = (suffix: string, text: string) => {
    const safeInput = state.input.replace(/[/\\?%*:|"<>]/g, '-').trim();
    const fileName = `${safeInput || '말씀쉼터'}_${suffix}.txt`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getTTSMasterPrompt = useCallback(() => {
    if (!state.script) return "";
    const { title, sections } = state.script;

    const styleInstructions = `[TTS Style Instructions]
- Speakers: 2 persons (형제님, 자매님). 
- Vibe: Modern sibling chemistry.
- Rule: Alternate strictly.

[Full Script for '${title}']`;

    const formatSection = (parts: ScriptPart[]) => {
      return parts.map(p => {
        const role = (p.speaker.toLowerCase().includes('brother') || p.speaker.includes('형제님') || p.speaker.includes('오빠')) ? '형제님' : '자매님';
        return `${role}: ${cleanContent(p.content)}`;
      }).join('\n');
    };

    return `${styleInstructions}\n\n${[
      formatSection(sections.intro),
      formatSection(sections.reading),
      formatSection(sections.history),
      formatSection(sections.sermon),
      formatSection(sections.summary),
      formatSection(sections.lordsPrayer),
      formatSection(sections.outro)
    ].join('\n\n')}`;
  }, [state.script]);

  const getFormattedYT = useCallback(() => {
    if (!state.script || !state.script.youtube) return "";
    const yt = state.script.youtube;
    const hashtags = yt.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
    
    // 헤더 추가: [구절] : [제목]
    const header = `${state.input} : ${state.script.title}`;

    return `${header}

[유튜브 업로드 가이드]

제목 후보들:
${yt.titles.map(t => `- ${t}`).join('\n')}

썸네일 텍스트 후보:
${yt.thumbnailTitles.map(t => `- ${t}`).join('\n')}

메인 카피 (Hook):
${yt.hook}

영상 설명란:
${yt.description}

해시태그:
${hashtags}

키워드 태그:
${yt.tags.join(', ')}`;
  }, [state.script, state.input]);

  const handleGenerateScript = async () => {
    if (!state.input.trim()) return;
    setState(prev => ({ ...prev, isLoading: true, error: null, script: null, generatedImage: null }));
    try {
      const script = await gemini.generateBibleScript(state.input);
      setState(prev => ({ ...prev, script, isLoading: false }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message, isLoading: false }));
    }
  };

  const handleGenerateImage = async () => {
    if (!state.script) return;
    if (state.selectedModel === 'gemini-3-pro-image-preview' || state.selectedModel === 'gemini-3-flash-preview') {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) await (window as any).aistudio.openSelectKey();
    }
    setState(prev => ({ ...prev, isImageLoading: true }));
    try {
      const imageUrl = await gemini.generateImage(state.script.youtube.imagePrompt, state.selectedModel, state.selectedAspectRatio);
      setState(prev => ({ ...prev, generatedImage: imageUrl, isImageLoading: false }));
    } catch (err: any) {
      alert("이미지 생성 실패");
      setState(prev => ({ ...prev, isImageLoading: false }));
    }
  };

  const handlePlayAudio = async () => {
    if (!state.script) return;
    setState(prev => ({ ...prev, isAudioLoading: true }));
    try {
      const audioBytes = await gemini.generateTTS(state.script);
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      
      const dataInt16 = new Int16Array(audioBytes.buffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
      setState(prev => ({ ...prev, isAudioLoading: false }));
    } catch (err: any) {
      alert("오디오 생성 실패");
      setState(prev => ({ ...prev, isAudioLoading: false }));
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 p-4 md:p-8 selection:bg-orange-200 font-sans">
      <header className="max-w-7xl mx-auto text-center mb-12 animate-fadeIn">
        <h1 className="text-5xl md:text-8xl font-black text-orange-900 mb-4 tracking-tighter italic">🌿 말씀쉼터</h1>
        <div className="h-2 w-48 bg-orange-400 mx-auto rounded-full mb-4 shadow-sm"></div>
        <p className="text-orange-700 font-black tracking-tight text-xl md:text-2xl uppercase">Bible Drama AI Engine</p>
      </header>

      <main className="max-w-7xl mx-auto space-y-12 pb-20">
        <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-orange-100 ring-8 ring-orange-50/50">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              className="flex-1 border-2 border-orange-50 rounded-2xl px-6 py-5 focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all text-lg font-bold text-gray-800 bg-orange-50/30"
              placeholder="말씀 구절 입력 (예: 잠언 20:1-7)"
              value={state.input}
              onChange={(e) => setState(prev => ({ ...prev, input: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateScript()}
            />
            <button onClick={handleGenerateScript} disabled={state.isLoading} className="px-12 py-5 rounded-2xl font-black text-white bg-gradient-to-br from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 shadow-xl transition-all active:scale-95 disabled:grayscale">
              {state.isLoading ? '✨ 대본 구성 중...' : '🔥 대본 생성'}
            </button>
          </div>
        </div>

        {state.error && <div className="bg-red-50 text-red-700 p-6 rounded-3xl border-2 border-red-100 text-center font-black animate-bounce">⚠️ {state.error}</div>}

        {state.script && (
          <div className="space-y-12 animate-fadeIn">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-t-[16px] border-orange-500">
              <div className="flex flex-col lg:flex-row justify-between items-center gap-10 mb-8">
                <div className="space-y-3 text-center lg:text-left">
                  <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight">🎙️ {state.script.title}</h2>
                  <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                    <span className="bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-xs font-black">개역개정 4판</span>
                    <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-xs font-black">화자 병합 완료</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                   <button onClick={handlePlayAudio} disabled={state.isAudioLoading} className="flex-1 lg:flex-none bg-green-500 text-white px-8 py-5 rounded-2xl font-black text-lg hover:bg-green-600 shadow-xl active:scale-95 disabled:bg-gray-200">
                    {state.isAudioLoading ? '🔊...' : '▶️ 미리듣기'}
                  </button>
                  <button onClick={() => saveAsTxt('대본', getTTSMasterPrompt())} className="flex-1 lg:flex-none bg-orange-600 text-white px-8 py-5 rounded-2xl font-black text-lg hover:bg-orange-700 shadow-xl active:scale-95">
                    💾 대본 저장
                  </button>
                </div>
              </div>

              <div className="bg-indigo-50 p-8 rounded-[3rem] border-4 border-dashed border-indigo-200 flex flex-col lg:flex-row items-center justify-between gap-8 ring-8 ring-indigo-50/50">
                <div className="flex-1 text-center lg:text-left">
                  <p className="text-indigo-900 font-black text-2xl mb-2 italic">🚀 Gemini 2.5 Pro TTS 마스터 키트</p>
                  <p className="text-indigo-700 font-bold">도입부 스타일 지시어가 포함된 통합 대본입니다.</p>
                </div>
                <button onClick={() => handleCopy(getTTSMasterPrompt(), "TTS 마스터 키트")} className="w-full lg:w-auto bg-gradient-to-r from-indigo-600 to-blue-700 text-white px-10 py-6 rounded-[2rem] font-black text-xl hover:from-indigo-700 hover:to-blue-800 shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3">
                  📋 키트 복사
                </button>
              </div>
            </div>

            {/* AI 화보 섹션 (복구 완료) */}
            <div className="bg-white p-4 rounded-[4rem] shadow-2xl border-4 border-indigo-50 overflow-hidden">
               <div className="p-8 lg:p-12 space-y-10">
                  <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b-2 border-indigo-50 pb-8">
                     <div className="space-y-2">
                        <h3 className="text-4xl font-black text-indigo-950 tracking-tighter">🎨 AI 화보 (시각적 은유)</h3>
                        <p className="text-indigo-500 font-bold italic">말씀 한 절이 그림 한 장으로 표현됩니다</p>
                     </div>
                     <div className="flex flex-wrap gap-3">
                        <select value={state.selectedModel} onChange={(e) => setState(p=>({...p, selectedModel: e.target.value as ImageModel}))} className="bg-indigo-50 px-6 py-4 rounded-2xl font-black text-sm border-2 border-indigo-100 outline-none">
                          <option value="gemini-2.5-flash-image">Free (Gemini 2.5 Flash)</option>
                          <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                          <option value="imagen-4.0-generate-001">Imagen 4.0</option>
                          <option value="gemini-3-pro-image-preview">Pro (Gemini 3)</option>
                        </select>
                        <select value={state.selectedAspectRatio} onChange={(e) => setState(p=>({...p, selectedAspectRatio: e.target.value as AspectRatio}))} className="bg-indigo-50 px-6 py-4 rounded-2xl font-black text-sm border-2 border-indigo-100 outline-none">
                          <option value="16:9">유튜브 (16:9)</option>
                          <option value="9:16">쇼츠 (9:16)</option>
                          <option value="1:1">정사각형 (1:1)</option>
                        </select>
                        <button onClick={handleGenerateImage} disabled={state.isImageLoading} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-2xl active:scale-95 disabled:bg-gray-200">
                          {state.isImageLoading ? '🎨...' : '🖼️ 이미지 생성'}
                        </button>
                     </div>
                  </div>

                  <div className="w-full bg-gray-50 rounded-[3rem] aspect-[16/9] border-8 border-white shadow-inner flex items-center justify-center overflow-hidden group relative transition-all">
                    {state.isImageLoading ? (
                      <div className="text-center animate-pulse text-indigo-400 font-black text-2xl italic">말씀을 예술로 승화하는 중...</div>
                    ) : state.generatedImage ? (
                      <>
                        <img src={state.generatedImage} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <a href={state.generatedImage} download="Thumbnail.png" className="bg-white text-indigo-950 px-12 py-5 rounded-2xl font-black text-xl shadow-2xl">📥 다운로드</a>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-10 opacity-40">
                        <div className="text-9xl mb-6">🎨</div>
                        <p className="font-black text-gray-500 text-4xl italic">"그림 한 장으로 전하는 말씀"</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>

            <div className="bg-zinc-900 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4">
                <div className="space-y-2">
                  <h3 className="text-4xl font-black text-orange-400 italic tracking-tighter">🎥 YOUTUBE KIT</h3>
                  <p className="text-orange-200/60 font-black text-sm">{state.input} : {state.script.title}</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={() => handleCopy(getFormattedYT(), "유튜브 정보")} className="flex-1 md:flex-none bg-orange-500 hover:bg-orange-600 px-6 py-4 rounded-2xl text-lg font-black transition shadow-lg">📋 복사</button>
                  <button onClick={() => saveAsTxt('유튜브_키트', getFormattedYT())} className="flex-1 md:flex-none bg-zinc-700 hover:bg-zinc-600 px-6 py-4 rounded-2xl text-lg font-black transition shadow-lg border border-white/10">💾 저장</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10">
                    <p className="text-orange-400 text-xs font-black uppercase mb-4 tracking-widest">추천 제목</p>
                    {state.script.youtube.titles.map((t, i) => <p key={i} className="text-lg font-bold mb-3 leading-snug">🎬 {t}</p>)}
                  </div>
                  <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10">
                    <p className="text-orange-400 text-xs font-black uppercase mb-4 tracking-widest">썸네일 텍스트</p>
                    {state.script.youtube.thumbnailTitles.map((t, i) => <p key={i} className="text-2xl font-black italic mb-2 text-white/90 underline decoration-orange-500/50 underline-offset-4">{t}</p>)}
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 h-full">
                    <p className="text-orange-400 text-xs font-black uppercase mb-4 tracking-widest">콘텐츠 요약 (HOOK)</p>
                    <p className="text-3xl font-black italic text-orange-100 leading-tight mb-6">"{state.script.youtube.hook}"</p>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6 whitespace-pre-wrap">{state.script.youtube.description}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <Section title="🎬 오프닝 (남매 꽁트)" parts={state.script.sections.intro} bgColor="bg-blue-50/50" cleanContent={cleanContent} />
              <Section title="📖 말씀 낭독 (남매 교독)" parts={state.script.sections.reading} bgColor="bg-white border-l-[16px] border-orange-500" cleanContent={cleanContent} />
              <Section title="🏺 시대적 배경 해설" parts={state.script.sections.history} bgColor="bg-amber-50/50" cleanContent={cleanContent} />
              <Section title="🎭 말씀 드라마 (상황극)" parts={state.script.sections.sermon} bgColor="bg-purple-50/50" cleanContent={cleanContent} />
              <Section title="✨ 오늘의 핵심 요약" parts={state.script.sections.summary} bgColor="bg-orange-100/40" cleanContent={cleanContent} />
              <Section title="🙏 주기도문" parts={state.script.sections.lordsPrayer} bgColor="bg-yellow-50/50" cleanContent={cleanContent} />
              <Section title="👋 마무리 & 샬롬" parts={state.script.sections.outro} bgColor="bg-green-50/50" cleanContent={cleanContent} />
            </div>
          </div>
        )}
      </main>

      {copyFeedback && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-indigo-900 text-white px-12 py-6 rounded-full font-black shadow-2xl animate-bounce z-50 border-4 border-indigo-400 text-xl">
          ✨ {copyFeedback} 완료!
        </div>
      )}

      <footer className="max-w-7xl mx-auto text-center py-20">
        <p className="text-orange-900/20 font-black text-xs tracking-[1.5em]">© 2024 말씀쉼터 • AI BIBLE DRAMA INFRASTRUCTURE</p>
      </footer>
    </div>
  );
};

export default App;
