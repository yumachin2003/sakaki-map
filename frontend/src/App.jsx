import { MantineProvider, AppShell, Group, Title, ColorSchemeScript, Button, Box, ActionIcon, Tooltip } from '@mantine/core';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { IconUpload } from '@tabler/icons-react';
import { useUploadPage } from './lv2';
import Map from './pages/Map';
import UploadPage from './pages/StuUpload';
import Opening from './components/Opening';
import '@mantine/core/styles.css';
import './css/GlassStyle.css';
import './css/App.css';

// ワークショップ用のシンプルなテーマ設定
const theme = {
  primaryColor: 'blue',
  defaultRadius: 'md',
};

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // URLが /upload の場合にモーダルを開く
  const isUploadModalOpen = location.pathname === '/upload';

  return (
    <AppShell header={{ height: 80, offset: false }} zIndex={10000}>
      
      {/* ヘッダー：タイトルを表示 */}
      <AppShell.Header withBorder={false} style={{ backgroundColor: 'transparent' }}>
        <Group wrap="nowrap" gap="sm" className="header-wrapper" style={{ height: '60px' }}>
          {/* 左側：タイトルが入ったカプセル */}
          <Box px="xl" className="glass-panel" style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
            <Title order={3} style={{ fontFamily: "'Keifont', sans-serif", margin: 0 }}>さかき思い出マップ</Title>
          </Box>
          {/* 右側：独立した丸いデータ送信ボタン */}
          {useUploadPage && (
            <Tooltip label="データ送信" withArrow position="bottom" classNames={{ tooltip: 'glass-tooltip' }}>
              <ActionIcon onClick={() => navigate('/upload')} className="glass-panel" variant="transparent" style={{ width: '60px', height: '60px' }}>
                <IconUpload size={24} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </AppShell.Header>

      {/* メインエリア：ここに地図が表示される */}
      <AppShell.Main p={0}>
        <Routes>
          <Route path="/" element={<Map />} />
          <Route path="/upload" element={<Map />} />
        </Routes>
      </AppShell.Main>
      
      <UploadPage 
        opened={isUploadModalOpen} 
        onClose={() => navigate('/')} 
      />
      
    </AppShell>
  );
}

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <BrowserRouter>
        <Opening />
        <AppContent />
      </BrowserRouter>
    </MantineProvider>
  );
}