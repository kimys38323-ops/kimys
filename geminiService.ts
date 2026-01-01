
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { BibleScript, ImageModel, AspectRatio } from "./types";

export class GeminiService {
  private extractJson(text: string): string {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : text;
  }

  async generateBibleScript(verseInput: string): Promise<BibleScript> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      성경 개역개정 4판 기반의 방송 대본을 생성해줘. 구절: "${verseInput}"
      호스트: 형제님(Brother, 오빠), 자매님(Sister, 여동생). 둘은 현실 남매 케미(투닥거리지만 친함).

      [대본 생성 철칙 - 화자 관리]
      - **동일한 화자가 연속으로 두 번 말하게 하지 마.** 
      - 한 화자가 길게 말해야 한다면 하나의 'content' 안에 모든 내용을 합칠 것.
      - 반드시 형제님-자매님-형제님-자매님 순으로 티카타카가 이어지도록 구성.

      [섹션별 고정 규칙]
      1. Intro: 말씀 주제 관련 일상 남매 콩트.
      2. Bible Reading: 
         - **반드시** 첫 대사는 "오늘 우리에게 주시는 ${verseInput} 말씀입니다."로 시작.
         - 이후 형제/자매가 한 절씩 번갈아가며 교독 (절 숫자 제거). 
         - 마지막은 자매님이 "아멘"으로 마무리.
      3. Commentary & Drama: 시대적 배경 및 현실 상황극.
      4. Summary: 핵심 요약 남매 꽁트.
      5. Lord's Prayer: 자매님이 반드시 "사랑이 많으신 우리 주님이 가르쳐 주신 주기도문으로 함께 기도하겠습니다"라고 말한 뒤 교독.
      6. Outro: 마무리 요약 콩트 + '말씀쉼터' 채널 홍보 + 형제님 "안녕!", 자매님 "샬롬!" 고정.

      [유튜브 메타데이터 및 이미지 프롬프트]
      - hook: 아주 짧고 강렬한 한 줄 문구.
      - imagePrompt: Cinematic visual metaphor. NO TEXT. 
        * Characters: A trendy Korean male and a stunning female sibling in a modern studio.
        * Female Fashion Detail: Wearing an extremely short mini-skirt and a very tight-fitting short crop-top that emphasizes the body line. The fabric of the top must be solid and opaque (NOT see-through, NOT sheer).
        * Visual Style: High-quality YouTube skit thumbnail style, realistic, attractive, and high-contrast lighting.

      [응답 형식]
      반드시 아래 JSON 구조를 유지할 것.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              sections: {
                type: Type.OBJECT,
                properties: {
                  intro: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { speaker: { type: Type.STRING }, content: { type: Type.STRING } } } },
                  reading: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { speaker: { type: Type.STRING }, content: { type: Type.STRING } } } },
                  history: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { speaker: { type: Type.STRING }, content: { type: Type.STRING } } } },
                  sermon: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { speaker: { type: Type.STRING }, content: { type: Type.STRING } } } },
                  summary: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { speaker: { type: Type.STRING }, content: { type: Type.STRING } } } },
                  lordsPrayer: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { speaker: { type: Type.STRING }, content: { type: Type.STRING } } } },
                  outro: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { speaker: { type: Type.STRING }, content: { type: Type.STRING } } } },
                },
                required: ["intro", "reading", "history", "sermon", "summary", "lordsPrayer", "outro"]
              },
              youtube: {
                type: Type.OBJECT,
                properties: {
                  titles: { type: Type.ARRAY, items: { type: Type.STRING } },
                  thumbnailTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
                  imagePrompt: { type: Type.STRING },
                  hook: { type: Type.STRING },
                  description: { type: Type.STRING },
                  hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["titles", "thumbnailTitles", "imagePrompt", "hook", "description", "hashtags", "tags"]
              }
            },
            required: ["title", "sections", "youtube"]
          }
        },
      });

      return JSON.parse(this.extractJson(response.text || "{}"));
    } catch (error) {
      console.error("Script Error:", error);
      throw new Error("대본 생성 중 오류가 발생했습니다.");
    }
  }

  async generateImage(prompt: string, model: ImageModel, aspectRatio: AspectRatio): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const finalPrompt = `${prompt}. Realistic, attractive, modern high-end fashion, solid fabric, NO TEXT, NO LETTERS.`;
    try {
      if (model === 'imagen-4.0-generate-001') {
        const response = await ai.models.generateImages({
          model: model,
          prompt: finalPrompt,
          config: { numberOfImages: 1, aspectRatio: aspectRatio, outputMimeType: 'image/png' }
        });
        return `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
      } else {
        const response = await ai.models.generateContent({
          model: model,
          contents: { parts: [{ text: finalPrompt }] },
          config: { imageConfig: { aspectRatio: aspectRatio, ...(model === 'gemini-3-pro-image-preview' ? { imageSize: '1K' } : {}) } }
        });
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        throw new Error("이미지 생성 실패");
      }
    } catch (error) {
      throw error;
    }
  }

  async generateTTS(script: BibleScript): Promise<Uint8Array> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const sections = script.sections;
    const allParts = [...sections.intro, ...sections.reading, ...sections.history, ...sections.sermon, ...sections.summary, ...sections.lordsPrayer, ...sections.outro];
    const conversation = allParts.map(p => {
      const speaker = (p.speaker === 'Brother' || p.speaker === '형제님' || p.speaker.includes('오빠')) ? '형제님' : '자매님';
      return `${speaker}: ${p.content.replace(/\(.*?\)|\[.*?\]/g, "")}`;
    }).join('\n');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `성경 드라마 대화입니다:\n${conversation}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              { speaker: '형제님', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
              { speaker: '자매님', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
            ]
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("음성 데이터 없음");
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }
}
