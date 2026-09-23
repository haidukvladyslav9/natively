import React, { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import Launcher from './components/Launcher';
import ChatGptWebMeetingInterface from './components/ChatGptWebMeetingInterface';
import SettingsPopup from './components/SettingsPopup';
import SettingsOverlay from './components/SettingsOverlay';
import StartupSequence from './components/StartupSequence';
import UpdateBanner from './components/UpdateBanner';
import { OverlayPillWindow, OverlayToggleWindow } from './components/OverlayAuxWindows';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider, ToastViewport } from './components/ui/toast';
import { isMac } from './utils/platformUtils';

const queryClient = new QueryClient();
const CropperWindow = React.lazy(() => import('./components/Cropper'));

const App: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const windowName = params.get('window');
  const isSettingsWindow = windowName === 'settings';
  const isOverlayWindow = windowName === 'overlay';
  const isCropperWindow = windowName === 'cropper';
  const isOverlayPillWindow = windowName === 'overlay-pill';
  const isOverlayToggleWindow = windowName === 'overlay-toggle';

  const [showStartup, setShowStartup] = useState(!windowName || windowName === 'launcher');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');

  const openSettings = useCallback((tab = 'general') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  }, []);

  useEffect(() => {
    if (isSettingsWindow || isOverlayWindow || isCropperWindow || isOverlayPillWindow || isOverlayToggleWindow) {
      return;
    }
    return window.electronAPI.onOpenSettingsTab?.((tab) => openSettings(tab));
  }, [
    isSettingsWindow,
    isOverlayWindow,
    isCropperWindow,
    isOverlayPillWindow,
    isOverlayToggleWindow,
    openSettings,
  ]);

  const handleStartMeeting = async () => {
    try {
      localStorage.setItem('natively_last_meeting_start', Date.now().toString());
      const inputDeviceId = localStorage.getItem('preferredInputDeviceId');
      let outputDeviceId = localStorage.getItem('preferredOutputDeviceId');
      if (isMac && localStorage.getItem('useExperimentalSckBackend') === 'true') {
        outputDeviceId = 'sck';
      }
      const retention = await window.electronAPI.getMeetingRetention?.().catch(() => 'forever');
      const result = await window.electronAPI.startMeeting({
        audio: { inputDeviceId, outputDeviceId },
        doNotPersist: retention === 'never',
      });
      if (!result.success) {
        console.error('Failed to start meeting:', result.error);
        if (result.code === 'mic-permission-denied') openSettings('audio');
      }
    } catch (error) {
      console.error('Failed to start meeting:', error);
      openSettings('audio');
    }
  };

  const handleEndMeeting = () => {
    localStorage.removeItem('natively_last_meeting_start');
    void window.electronAPI.endMeeting().catch((error) => {
      console.error('Failed to end meeting:', error);
      return window.electronAPI.setWindowMode('launcher');
    });
  };

  if (isCropperWindow) {
    return (
      <React.Suspense fallback={<div className="w-screen h-screen bg-transparent" />}>
        <CropperWindow />
      </React.Suspense>
    );
  }

  if (isSettingsWindow) {
    return (
      <ErrorBoundary context="SettingsPopup">
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <SettingsPopup />
            <ToastViewport />
          </ToastProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }

  if (isOverlayPillWindow) {
    return (
      <ErrorBoundary context="OverlayPill">
        <OverlayPillWindow />
      </ErrorBoundary>
    );
  }

  if (isOverlayToggleWindow) {
    return (
      <ErrorBoundary context="OverlayToggle">
        <OverlayToggleWindow />
      </ErrorBoundary>
    );
  }

  if (isOverlayWindow) {
    return (
      <ErrorBoundary context="Overlay">
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <div className="w-full h-full bg-transparent overflow-hidden">
              <ChatGptWebMeetingInterface onEndMeeting={handleEndMeeting} />
            </div>
            <ToastViewport />
          </ToastProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary context="Launcher">
      <div className="h-full min-h-0 w-full relative bg-transparent">
        <AnimatePresence mode="wait">
          {showStartup ? (
            <motion.div
              key="startup"
              className="h-full w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <StartupSequence onComplete={() => setShowStartup(false)} />
            </motion.div>
          ) : (
            <motion.div
              key="launcher"
              className="h-full w-full"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <QueryClientProvider client={queryClient}>
                <ToastProvider>
                  <Launcher
                    onStartMeeting={() => void handleStartMeeting()}
                    onOpenSettings={openSettings}
                  />
                  <SettingsOverlay
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    initialTab={settingsTab}
                  />
                  <UpdateBanner />
                  <ToastViewport />
                </ToastProvider>
              </QueryClientProvider>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

export default App;
