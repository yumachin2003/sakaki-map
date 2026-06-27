import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Box, Button, Group, Title, Text, Select, Image, Code, Stack, NavLink, Tooltip, ActionIcon } from '@mantine/core';
import { IconSend, IconFileCode, IconArrowLeft, IconFolderOpen, IconChevronDown } from '@tabler/icons-react';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import 'highlight.js/styles/vs2015.css'; // VS Code風のダークテーマ
import jsonErrorImage from '../assets/json_error.png';

hljs.registerLanguage('json', json);

// プロジェクト内の upload フォルダにある JSON ファイルをすべて自動取得
const seedModules = import.meta.glob('../lv4/upload/*.json', { eager: true });

export default function UploadPage({ opened, onClose }) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ファイルリストを動的に生成（ファイルの追加・削除時に即座に反映）
  const files = useMemo(() => {
    const loadedFiles = Object.entries(seedModules).map(([path, mod]) => {
      const name = path.split('/').pop();
      const data = mod.default !== undefined ? mod.default : mod;
      return { name, content: JSON.stringify(data, null, 2), hasError: false };
    });

    if (loadedFiles.length === 0) {
      return [{ name: 'エラー', content: '', hasError: true, isNoFile: true }];
    }
    return loadedFiles;
  }, [seedModules]);

  // モーダルを開いた時に選択状態をリセット
  useEffect(() => {
    if (opened) {
      setSelectedFileIndex(null);
    }
  }, [opened]);

  // ファイルが削除されて選択中のインデックスが範囲外になったらリセット
  useEffect(() => {
    if (selectedFileIndex >= files.length) {
      setSelectedFileIndex(0);
    }
  }, [files.length, selectedFileIndex]);

  const currentFile = selectedFileIndex !== null && files.length > 0 ? files[selectedFileIndex] : null;

  // ファイルの内容が変更された時にハイライト処理を実行
  const highlightedCode = useMemo(() => {
    if (!currentFile) return '';
    try {
      return hljs.highlight(currentFile.content, { language: 'json' }).value;
    } catch (error) {
      console.error("Syntax highlight error:", error);
      return currentFile.content;
    }
  }, [currentFile]);

  // サーバーへデータを送信する処理
  const handleSubmit = async () => {
    if (currentFile.hasError) return;
    
    setIsSubmitting(true);
    try {
      let payload = JSON.parse(currentFile.content);
      
      // バックエンドは配列（リスト）形式を要求するため、配列でない場合は自動補正する
      if (!Array.isArray(payload)) {
        if (payload.MapData && Array.isArray(payload.MapData)) {
          payload = payload.MapData; // { "MapData": [...] } の形式だった場合
        } else {
          payload = [payload]; // 単一のオブジェクト { ... } だった場合
        }
      }
      
      // ViteのProxy機能を使って送信するため、相対パスだけでOK
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'サーバーエラーが発生しました');
      }

      const result = await response.json();
      alert(result.message || '送信に成功しました！');
      window.dispatchEvent(new Event('memoriesUpdated')); // 地図コンポーネントにデータ更新を通知
      onClose(); // 成功したらモーダルを閉じる
    } catch (error) {
      console.error('Submit error:', error);
      alert(`送信エラー: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text size="lg" fw={700} c="white">データをサーバーへ送信</Text>}
      size="xl"
      yOffset="5vh"
      radius={20}
      zIndex={10010}
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
        body: { padding: 0, overflow: 'hidden' },
        close: { color: 'white' }
      }}
    >
      {/* メイン部分（エディタ風プレビュー） */}
      <Box p="md" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(85vh - 80px)' }}>
        
        {/* ▼ 【変更】「upload」フォルダのヘッダーを条件分岐の外に出して、常に一番上に固定する！ */}
        <Box style={{ 
          flex: 1, 
          backgroundColor: '#1e1e1e', 
          borderRadius: '8px', 
          border: '1px solid #373a40',
          overflow: 'hidden', 
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 常に表示されるフォルダヘッダー */}
          <Group gap="sm" px="md" py="xs" style={{ backgroundColor: '#252526', borderBottom: '1px solid #373a40' }}>
            <IconChevronDown size={16} color="#cccccc" />
            <IconFolderOpen size={18} color="#dcb67a" />
            <Text c="#cccccc" size="sm" fw={700} style={{ letterSpacing: '1px', fontFamily: 'Menlo, Monaco, Consolas, monospace' }}>
              upload
            </Text>
          </Group>

          {selectedFileIndex === null ? (
            // ----------------------------------------------------
            // ① ファイル一覧 ＆ ファイルがない時のエラー表示
            // ----------------------------------------------------
            <Box style={{ flex: 1, overflowY: 'auto', paddingTop: '4px', paddingBottom: '10px' }}>
              {files.length === 1 && files[0].isNoFile ? (
                // ファイルが1つもない時（フォルダの「中」にエラーを表示する）
                <Box style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Image src={jsonErrorImage} alt="JSON Error" h="auto" mah={100} w="auto" fit="contain" mx="auto" mb="md" />
                  <Text size="sm" c="red">
                    エラー: フォルダ内に送信できるファイルが見つかりません。
                  </Text>
                </Box>
              ) : (
                // ファイルがある時はリストを表示する
                files.map((file, i) => (
                  <NavLink
                    key={i}
                    label={file.name}
                    leftSection={<IconFileCode size={18} color="#cbcb41" />} 
                    rightSection={
                      <Text size="xs" c="#858585" fw={700} style={{ fontFamily: 'Menlo, Monaco, Consolas, monospace' }}>
                        ＞
                      </Text>
                    }
                    onClick={() => setSelectedFileIndex(i)}
                    styles={{
                      root: {
                        paddingLeft: '44px',
                        paddingTop: '6px',
                        paddingBottom: '6px',
                        color: '#cccccc',
                        '&:hover': {
                          backgroundColor: '#2a2d2e',
                          color: '#ffffff'
                        }
                      },
                      label: { 
                        fontSize: '14px',
                        fontFamily: 'Menlo, Monaco, Consolas, monospace',
                      }
                    }}
                  />
                ))
              )}
            </Box>
          ) : (
            // ----------------------------------------------------
            // ② プレビュー画面 ＆ 構文エラー画面
            // ----------------------------------------------------
            <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* ▼ 「フォルダに戻る」バー（VSCodeのタブ・パンくずリスト風） */}
              <Group px="md" py="xs" gap="sm" style={{ borderBottom: '1px solid #333' }}>
                
                {/* ツールチップ付きのアイコンボタン */}
                <Tooltip label="フォルダに戻る" size="xs" zIndex={10011} position="bottom" withArrow classNames={{ tooltip: 'glass-tooltip' }} styles={{ tooltip: { fontSize: '12px', padding: '4px 8px' } }}>
                  <ActionIcon 
                    variant="subtle" 
                    color="gray" 
                    onClick={() => setSelectedFileIndex(null)}
                  >
                    <IconArrowLeft size={18} />
                  </ActionIcon>
                </Tooltip>

                {/* ファイルアイコンとファイル名を左寄せで並べる */}
                <IconFileCode size={18} color="#cbcb41" />
                <Text c="#cccccc" size="sm" fw={700} style={{ fontFamily: 'Menlo, Monaco, Consolas, monospace' }}>
                  {currentFile?.name}
                </Text>
              </Group>

              {/* コード本体 or JSON形式エラーの表示 */}
              <Box style={{ 
                flex: 1, 
                overflow: 'auto',
                display: 'flex',
                alignItems: currentFile?.hasError ? 'center' : 'stretch',
                justifyContent: currentFile?.hasError ? 'center' : 'flex-start'
              }}>
                {currentFile?.hasError ? (
                  // JSONの書き方が間違っている時のエラー
                  <Box p="xl" style={{ textAlign: 'center' }}>
                    <Image src={jsonErrorImage} alt="JSON Error" h="auto" mah={100} w="auto" fit="contain" mx="auto" mb="md" />
                    <Text c="red" fw={700}>{currentFile.errorMessage || 'JSONファイルの形式が正しくありません。'}</Text>
                  </Box>
                ) : (
                  <>
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
                      {currentFile?.content.split('\n').map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </Box>
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
            </Box>
          )}
        </Box>

        {/* フッター（送信ボタン） */}
        <Group justify="flex-end">
          <Button 
            color="cyan" 
            leftSection={<IconSend size={18} />} 
            onClick={handleSubmit}
            // ▼ currentFile が null の時や、エラーがある時はボタンを押せなくする。
            disabled={!currentFile || currentFile.hasError || currentFile.isNoFile}
            loading={isSubmitting}
          >
            送信
          </Button>
        </Group>
      </Box>
    </Modal>
  );
}