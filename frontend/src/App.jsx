import { MantineProvider, AppShell, Group, Title, ColorSchemeScript, Button, Box, Image, Transition, Stack } from '@mantine/core';
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { IconUpload } from '@tabler/icons-react';
import { useUploadPage } from './lv2';
import Map from './pages/Map';
import UploadPage from './pages/StuUpload';
import titleImage from './assets/title.png';
import '@mantine/core/styles.css';
import './css/GlassStyle.css';
import './css/App.css';

// ワークショップ用のシンプルなテーマ設定
const theme = {
  primaryColor: 'blue',
  defaultRadius: 'md',
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);

  useEffect(() => {
    // 3秒後に自動で非表示にする
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      {/* オープニングのスプラッシュスクリーン */}
      <Transition mounted={showSplash} transition="fade" duration={800} timingFunction="ease">
        {(styles) => (
          <Box 
            style={{
              ...styles,
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 99999, // 最前面に表示
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)',
            }}
            onClick={() => setShowSplash(false)} // クリックでもスキップ可能
          >
            <Stack align="center" gap="xl" w="100%">
              <Image src={titleImage} alt="さかき思い出マップ" w="60%" maw={400} className="title-zoom-animation" />
              <Box w="40%" maw={200} h={2} bg="rgba(255,255,255,0.2)" style={{ borderRadius: 2, overflow: 'hidden' }}>
                <Box h="100%" bg="white" className="progress-bar-animation" style={{ borderRadius: 2 }} />
              </Box>
            </Stack>
          </Box>
        )}
      </Transition>

      <BrowserRouter>
        {/* 画面全体のレイアウト構造 */}
        <AppShell header={{ height: 80, offset: false }} zIndex={10000}>
          
          {/* ヘッダー：タイトルを表示 */}
          <AppShell.Header withBorder={false} style={{ backgroundColor: 'transparent' }}>
            <Box m={12} p="xs" className="glass-panel" style={{ borderRadius: '20px', height: '60px' }}>
              <Group h="100%" px="md" justify="space-between">
                <Title order={3} style={{ fontFamily: "'Keifont', sans-serif" }}>さかき思い出マップ</Title>
                {useUploadPage && (
                <Button onClick={() => setUploadModalOpen(true)} color="cyan" leftSection={<IconUpload size={18} />} variant="light" size="sm">
                  データ送信
                </Button>
                )}
              </Group>
            </Box>
          </AppShell.Header>

          {/* メインエリア：ここに地図が表示される */}
          <AppShell.Main p={0}>
            <Routes>
              <Route path="/" element={<Map />} />
            </Routes>
          </AppShell.Main>
          
          <UploadPage 
            opened={isUploadModalOpen} 
            onClose={() => setUploadModalOpen(false)} 
          />
          
        </AppShell>
      </BrowserRouter>
    </MantineProvider>
  );
}