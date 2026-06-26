import { MantineProvider, AppShell, Group, Title, ColorSchemeScript, Button, Box, ActionIcon, Tooltip, TextInput, Paper, UnstyledButton, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { IconUpload, IconSearch } from '@tabler/icons-react';
import { useUploadPage } from './lv2';
import Map from './pages/Map';
import UploadPage from './pages/StuUpload';
import Opening from './components/Opening';
import '@mantine/core/styles.css';
import './css/GlassStyle.css';
import './css/App.css';
import { useState, useRef, useLayoutEffect } from 'react';

// ワークショップ用のシンプルなテーマ設定
const theme = {
  primaryColor: 'blue',
  defaultRadius: 'md',
};

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const isMobile = useMediaQuery('(max-width: 600px)');
  const searchInputRef = useRef(null);
  const titleRef = useRef(null);
  const [titleRight, setTitleRight] = useState(0);
  const titleBarRef = useRef(null);
  const [titleBarRight, setTitleBarRight] = useState(0);

  useLayoutEffect(() => {
    const updateTitlePosition = () => {
      if (titleRef.current) {
        const rect = titleRef.current.getBoundingClientRect();
        setTitleRight(rect.right);
      }
      if (titleBarRef.current) {
        const rect = titleBarRef.current.getBoundingClientRect();
        setTitleBarRight(rect.right);
      }
    };
    updateTitlePosition();

    window.addEventListener('resize', updateTitlePosition);
    return () => window.removeEventListener('resize', updateTitlePosition);
  }, []);

  // URLが /upload の場合にモーダルを開く
  const isUploadModalOpen = location.pathname === '/upload';

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
  };

  return (
    <AppShell header={{ height: 80, offset: false }} zIndex={10000}>
      
      {/* ヘッダー：タイトルを表示 */}
      <AppShell.Header withBorder={false} style={{ backgroundColor: 'transparent' }}>
        <Group wrap="nowrap" gap="sm" className="header-wrapper" style={{ height: '60px' }}>
          {/* 左側：タイトルがついたカプセル */}
          <Box px="xl" className="glass-panel" ref={titleBarRef} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', filter: isSearchFocused ? 'blur(3px)' : 'none', transition: 'filter 0.3s ease', pointerEvents: isSearchFocused ? 'none' : 'auto' }}>
            <Title order={3} ref={titleRef} style={{ fontFamily: "'Keifont', sans-serif", margin: 0, whiteSpace: 'nowrap' }}>さかき思い出マップ</Title>
          </Box>
          {isMobile && !isSearchFocused && (
            <Tooltip label="検索" withArrow position="bottom" classNames={{ tooltip: 'glass-tooltip' }}>
              <ActionIcon onClick={handleSearchFocus} className="glass-panel" variant="transparent" style={{ width: '60px', height: '60px', filter: isSearchFocused ? 'blur(3px)' : 'none', transition: 'filter 0.3s ease', pointerEvents: isSearchFocused ? 'none' : 'auto' }}>
                <IconSearch size={24} />
              </ActionIcon>
            </Tooltip>
          )}
          {/* データ送信ボタン */}
          {useUploadPage && (
            <Tooltip label="データ送信" withArrow position="bottom" classNames={{ tooltip: 'glass-tooltip' }}>
              <ActionIcon onClick={() => navigate('/upload')} className="glass-panel" variant="transparent" style={{ width: '60px', height: '60px', filter: isSearchFocused ? 'blur(3px)' : 'none', transition: 'filter 0.3s ease', pointerEvents: isSearchFocused ? 'none' : 'auto' }}>
                <IconUpload size={24} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </AppShell.Header>

      {/* 検索欄 */}
      <Box
        style={{
          position: 'fixed',
          top: isSearchFocused ? '48px' : '32px',
          right: isSearchFocused ? 'auto' : `calc(100vw - ${titleBarRight}px + 20px)`,
          left: isSearchFocused ? '50%' : `calc(${titleRight}px + 30px)`,
          width: isSearchFocused ? '75%' : 'auto',
          maxWidth: isSearchFocused ? 'none' : '350px',
          marginLeft: isSearchFocused ? '0' : 'auto',
          
          opacity: (isMobile && !isSearchFocused) ? 0 : 1,
          pointerEvents: (isMobile && !isSearchFocused) ? 'none' : 'auto',
          
          transform: isSearchFocused ? 'translateX(-50%)' : 'none',
          zIndex: 10001,
          transition: 'transform 0.2s ease, top 0.2s ease, opacity 0.2s ease',
        }}
      >
        <TextInput
          ref={searchInputRef}
          placeholder="検索..."
          leftSection={<IconSearch size={14} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          size={isSearchFocused ? "lg" : "xs"}
          radius={isSearchFocused ? "52px" : "lg"}
          classNames={{ input: 'glass-input' }}
          styles={{
            input: {
              height: isSearchFocused ? '48px' : '36px',
              minHeight: isSearchFocused ? '48px' : '36px',
              maxHeight: isSearchFocused ? '48px' : '36px',
              boxSizing: 'border-box'
            }
          }}
        />
        {isSearchFocused && searchTerm.length > 0 && (
          <Paper
            shadow="md"
            radius="md"
            className="glass-panel"
            style={{
              position: 'absolute',
              top: '100%', // 検索バーの真下にくっつける
              left: 0,
              right: 0,
              marginTop: '8px',
              maxHeight: '40vh', // 画面の40%の高さまで。超えたらスクロール
              overflowY: 'auto',
              zIndex: 10002,
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            {/* ※ここは仮のUIです。後で本物のマップデータと繋ぎます */}
            {[1, 2, 3].map((num) => (
              <UnstyledButton
                key={num}
                onClick={() => {
                  setSearchTerm(`${searchTerm}の候補${num}`); // クリックした文字を検索バーに入れる
                  handleSearchBlur(); // リストとオーバーレイを閉じる
                }}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Text size="sm" fw={500} style={{ color: '#fff' }}>
                  「{searchTerm}」の検索結果 {num}
                </Text>
              </UnstyledButton>
            ))}
            
            {/* もし検索結果がない場合に出す文字 */}
            {/* <Text size="sm" c="dimmed" ta="center" py="sm">見つかりませんでした</Text> */}
          </Paper>
        )}
      </Box>

      {/* 検索欄フォーカス時のオーバーレイ */}
      {isSearchFocused && (
        <Box
          onClick={handleSearchBlur}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            cursor: 'pointer',
            transition: 'all 1s ease'
          }}
        />
      )}

      {/* メインエリア：ここに地図が表示される */}
      <AppShell.Main p={0}>
        <Routes>
          <Route path="/" element={<Map searchTerm={searchTerm} setSearchTerm={setSearchTerm} isMobile={isMobile} />} />
          <Route path="/upload" element={<Map searchTerm={searchTerm} setSearchTerm={setSearchTerm} isMobile={isMobile} />} />
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