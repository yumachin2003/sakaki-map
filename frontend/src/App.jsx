import { MantineProvider, AppShell, Group, Title, ColorSchemeScript } from '@mantine/core';
import Map from './components/Map';
import '@mantine/core/styles.css';
import './css/App.css';

// ワークショップ用のシンプルなテーマ設定
const theme = {
  primaryColor: 'blue',
  defaultRadius: 'md',
};

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      {/* 画面全体のレイアウト構造 */}
      <AppShell header={{ height: 60 }}>
        
        {/* ヘッダー：タイトルを表示 */}
        <AppShell.Header p="xs">
          <Group h="100%" px="md">
            <Title order={3} c="blue">さかき思い出マップ</Title>
          </Group>
        </AppShell.Header>

        {/* メインエリア：ここに地図が表示される */}
        <AppShell.Main p={0}>
          <Map />
        </AppShell.Main>
        
      </AppShell>
    </MantineProvider>
  );
}