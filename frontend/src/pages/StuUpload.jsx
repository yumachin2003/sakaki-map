import React, { useState, useEffect } from 'react';
import { Box, Button, Group, Title, ScrollArea, Text, ActionIcon } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconSend, IconFileCode } from '@tabler/icons-react';

export default function UploadPage() {
  const navigate = useNavigate();
  const [fileContent, setFileContent] = useState('// 読み込み中...');

  useEffect(() => {
    // Vite環境を想定し、public/upload/data.json から取得する想定です。
    // 必要に応じて import uploadData from '../upload/data.json'; などの静的インポートにも変更可能です。
    const loadFile = async () => {
      try {
        const res = await fetch('/upload/data.json');
        if (res.ok) {
          const data = await res.json();
          setFileContent(JSON.stringify(data, null, 2));
        } else {
          setFileContent('{\n  "error": "File not found",\n  "message": "public/upload/data.json を配置してください"\n}');
        }
      } catch (error) {
        setFileContent('// エラーが発生しました\n' + error.message);
      }
    };
    
    loadFile();
  }, []);

  return (
    <Box style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#1A1B1E', zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      paddingTop: '80px'
    }}>
      {/* ヘッダー部分 */}
      <Box p="md" style={{ borderBottom: '1px solid #373a40' }}>
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate(-1)} size="lg" color="gray">
            <IconArrowLeft size={24} />
          </ActionIcon>
          <Title order={3} c="white">データを母艦へ送信</Title>
        </Group>
      </Box>

      {/* メイン部分（エディタ風プレビュー） */}
      <Box p="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Group gap="xs">
          <IconFileCode size={20} color="#4dabf7" />
          <Text c="dimmed" size="sm" fw={700}>upload/data.json</Text>
        </Group>

        <Box style={{ 
          flex: 1, 
          backgroundColor: '#1e1e1e', // VSCodeのダークテーマ風の背景色
          borderRadius: '8px', 
          border: '1px solid #373a40',
          overflow: 'hidden',
          display: 'flex'
        }}>
          {/* 行番号 */}
          <Box style={{ 
            padding: '16px 8px', 
            backgroundColor: '#1e1e1e', 
            color: '#858585', 
            textAlign: 'right',
            fontFamily: 'Menlo, Monaco, Consolas, monospace',
            fontSize: '14px',
            userSelect: 'none',
            borderRight: '1px solid #333'
          }}>
            {fileContent.split('\n').map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </Box>
          {/* コード表示部分 */}
          <ScrollArea style={{ flex: 1 }} type="auto">
            <pre style={{ 
              margin: 0, 
              padding: '16px', 
              color: '#d4d4d4', 
              fontFamily: 'Menlo, Monaco, Consolas, monospace',
              fontSize: '14px',
              minHeight: '100%'
            }}>
              <code>{fileContent}</code>
            </pre>
          </ScrollArea>
        </Box>

        {/* フッター（ボタン類） */}
        <Group justify="flex-end">
          <Button variant="default" onClick={() => navigate(-1)}>キャンセル</Button>
          <Button color="cyan" leftSection={<IconSend size={18} />} onClick={() => alert('送信しました！🚀')}>
            送信する🚀
          </Button>
        </Group>
      </Box>
    </Box>
  );
}