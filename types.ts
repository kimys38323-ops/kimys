
export interface ScriptPart {
  speaker: string;
  content: string;
}

export interface YouTubeMetadata {
  hook: string;
  titles: string[];
  thumbnailTitles: string[];
  description: string;
  hashtags: string[];
  tags: string[];
  imagePrompt: string;
}

export interface BibleScript {
  title: string;
  sections: {
    intro: ScriptPart[];
    reading: ScriptPart[];
    history: ScriptPart[];
    sermon: ScriptPart[];
    summary: ScriptPart[];
    lordsPrayer: ScriptPart[];
    outro: ScriptPart[];
  };
  youtube: YouTubeMetadata;
}

export type ImageModel = 'imagen-4.0-generate-001' | 'gemini-3-pro-image-preview' | 'gemini-2.5-flash-image' | 'gemini-3-flash-preview';
export type AspectRatio = '1:1' | '9:16' | '16:9';

export interface AppState {
  input: string;
  isLoading: boolean;
  script: BibleScript | null;
  error: string | null;
  isAudioLoading: boolean;
  isImageLoading: boolean;
  generatedImage: string | null;
  selectedModel: ImageModel;
  selectedAspectRatio: AspectRatio;
}
