import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mic, History, BookOpen, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VoiceLibraryTab } from './VoiceLibraryTab';
import { TTSTab } from './TTSTab';
import { StoryStudioTab } from './StoryStudioTab';
import { HistoryTab } from './HistoryTab';

type VoiceTab = 'library' | 'tts' | 'story' | 'history';

const VoiceAIPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = (searchParams.get('tab') as VoiceTab) ?? 'library';
  const [activeTab, setActiveTab] = useState<VoiceTab>(tabParam);

  // State lifted from TTSTab so "Reuse text" in History can pre-fill it
  const [reuseText, setReuseText] = useState('');

  const handleTabChange = (value: string) => {
    const tab = value as VoiceTab;
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleReuseText = (text: string) => {
    setReuseText(text);
    handleTabChange('tts');
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Voice AI</h1>
        <p className="text-muted-foreground">
          Clone voices, generate speech, build story narrations, and browse your audio history.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex w-full max-w-xl">
          <TabsTrigger value="library" className="flex-1 gap-2">
            <Mic className="h-4 w-4" />
            Voice Library
          </TabsTrigger>
          <TabsTrigger value="tts" className="flex-1 gap-2">
            <Sparkles className="h-4 w-4" />
            Text to Speech
          </TabsTrigger>
          <TabsTrigger value="story" className="flex-1 gap-2">
            <BookOpen className="h-4 w-4" />
            Story Studio
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-6">
          <VoiceLibraryTab />
        </TabsContent>

        <TabsContent value="tts" className="mt-6">
          <TTSTab initialText={reuseText} />
        </TabsContent>

        <TabsContent value="story" className="mt-6">
          <StoryStudioTab />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <HistoryTab onReuseText={handleReuseText} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VoiceAIPage;
