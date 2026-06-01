import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Box, Button, Group, Title, Text, Select, Image } from '@mantine/core';
import { IconSend, IconFileCode } from '@tabler/icons-react';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import 'highlight.js/styles/vs2015.css'; // VS Code風のダークテーマ
import jsonErrorImage from '../assets/json_error.png';

hljs.registerLanguage('json', json);

// プロジェクト内の seed フォルダにある JSON ファイルをすべて自動取得
const seedModules = import.meta.glob('../seed/*.json', { eager: true });

export default function UploadPage({ opened, onClose }) {
  const [files, setFiles] = useState([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  // モーダルを開いた時にファイルを自動読み込みする
  useEffect(() => {
    if (opened) {
      const loadedFiles = Object.entries(seedModules).map(([path, mod]) => {
        const name = path.split('/').pop();
        const data = mod.default !== undefined ? mod.default : mod;
        return { name, content: JSON.stringify(data, null, 2), hasError: false };
      });

      if (loadedFiles.length === 0) {
        setFiles([{ name: 'エラー', content: '', hasError: true, errorMessage: '送信できるファイルが見つかりません。' }]);
      } else {
        setFiles(loadedFiles);
      }
      setSelectedFileIndex(0);
    }
  }, [opened]);

  const currentFile = files.length > 0 ? files[selectedFileIndex] : { name: '未選択', content: '// 読み込み中...', hasError: false };

  // ファイルの内容が変更された時にハイライト処理を実行
  const highlightedCode = useMemo(() => {
    try {
      return hljs.highlight(currentFile.content, { language: 'json' }).value;
    } catch (error) {
      console.error("Syntax highlight error:", error);
      return currentFile.content;
    }
  }, [currentFile.content]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Title order={3} c="white">データをサーバーへ送信</Title>}
      size="xl"
      yOffset={100}
      radius={20}
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
      classNames={{
        content: 'glass-modal',
        header: 'glass-modal-header',
      }}
      styles={{
        header: { borderBottom: '1px solid rgba(255, 255, 255, 0.1)' },
        body: { padding: 0 },
        close: { color: 'white' }
      }}
    >

      {/* メイン部分（エディタ風プレビュー） */}
      <Box p="md" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 300px)' }}>
        <Group justify="space-between">
          <Group gap="xs">
            <IconFileCode size={20} color="#4dabf7" />
            {files.length > 1 ? (
              <Select
                data={files.map((f, i) => ({ value: String(i), label: f.name }))}
                value={String(selectedFileIndex)}
                onChange={(val) => setSelectedFileIndex(Number(val))}
                size="sm"
                variant="unstyled"
                styles={{ input: { color: '#C1C2C5', fontWeight: 700 } }}
                allowDeselect={false}
              />
            ) : (
              <Text c="dimmed" size="sm" fw={700}>{currentFile.name}</Text>
            )}
          </Group>
        </Group>

        <Box style={{ 
          flex: 1, 
          backgroundColor: '#1e1e1e', // VSCodeのダークテーマ風の背景色
          borderRadius: '8px', 
          border: '1px solid #373a40',
          overflow: 'auto',
          display: 'flex',
          minHeight: 0,
          alignItems: currentFile.hasError ? 'center' : 'stretch',
          justifyContent: currentFile.hasError ? 'center' : 'flex-start'
        }}>
          {currentFile.hasError ? (
            <Box p="md" style={{ textAlign: 'center' }}>
              <Image src={jsonErrorImage} alt="JSON Error" w="60%" maw={300} mx="auto" mb="md" />
              <Text c="red" fw={700}>{currentFile.errorMessage || 'JSONファイルの形式が正しくありません。'}</Text>
            </Box>
          ) : (
            <>
              {/* 行番号 */}
              <Box style={{ 
                padding: '16px 8px', 
                backgroundColor: '#1e1e1e', 
                color: '#858585', 
                textAlign: 'right',
                fontFamily: 'Menlo, Monaco, Consolas, monospace',
                fontSize: '14px',
                userSelect: 'none',
                borderRight: '1px solid #333',
                position: 'sticky',
                left: 0
              }}>
                {currentFile.content.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </Box>
              {/* コード表示部分 */}
              <pre style={{ 
                margin: 0, 
                padding: '16px', 
                color: '#d4d4d4', 
                fontFamily: 'Menlo, Monaco, Consolas, monospace',
                fontSize: '14px',
                flex: 1,
                minWidth: 'max-content'
              }}>
                <code 
                  className="hljs language-json"
                  style={{ background: 'transparent', padding: 0 }}
                  dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
              </pre>
            </>
          )}
        </Box>

        {/* フッター（ボタン類） */}
        <Group justify="flex-end">
          <Button 
            color="cyan" 
            leftSection={<IconSend size={18} />} 
            onClick={() => alert('送信しました！')}
            disabled={currentFile.hasError}
          >
            送信
          </Button>
        </Group>
      </Box>
    </Modal>
  );
}