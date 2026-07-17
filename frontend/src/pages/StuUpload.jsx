import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, Box, Button, Group, Title, Text, Stack, Tooltip, ActionIcon, Tabs } from '@mantine/core';
import { IconSend, IconFileCode, IconUser, IconPalette, IconDeviceFloppy, IconHelpCircle, IconRefresh, IconX } from '@tabler/icons-react';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import javascript from 'highlight.js/lib/languages/javascript';
import 'highlight.js/styles/vs2015.css'; // VS Code風のダークテーマ
import { getApiBaseUrl } from '../App';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import CodeHelp from '../components/CodeHelp';
import copyingCoordinateVideo from '../assets/copying_coodinate.mp4';
import certificateBg from '../assets/certificate_bg.jpg';

hljs.registerLanguage('json', json);
hljs.registerLanguage('javascript', javascript);

export default function MyPage({ opened, onClose, userSettings, setUserSettings, sharedMemories = [] }) {
  const location = useLocation();
  const navigate = useNavigate();

  const getActiveTab = () => {
    if (location.pathname === '/account/register') return 'memory';
    if (location.pathname === '/account/appearance') return 'appearance';
    return 'account';
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  useEffect(() => {
    if (opened) {
      setActiveTab(getActiveTab());
    }
  }, [location.pathname, opened]);

  const handleTabChange = (val) => {
    setActiveTab(val);
    if (val === 'memory') navigate('/account/register');
    else if (val === 'appearance') navigate('/account/appearance');
    else navigate('/account');
  };
  
  // 次の思い出IDをアカウントIDに基づいて生成する関数
  const generateNextMemoryId = (accountId, existingMemories) => {
    if (!accountId) return 100; // 未ログインなどのフォールバック
    const accIdStr = String(accountId);
    
    // 現在のアカウントIDから始まるIDを持つ思い出を抽出
    const myMemories = existingMemories.filter(m => String(m.id).startsWith(accIdStr));
    
    if (myMemories.length === 0) {
      return parseInt(accIdStr + "1", 10);
    }

    const maxId = Math.max(...myMemories.map(m => m.id));
    let nextId = maxId + 1;
    
    // 次のIDがアカウントIDから始まらなくなった場合（例：29 -> 30）、桁を増やす（例：200）
    if (!String(nextId).startsWith(accIdStr)) {
      const newLen = String(maxId).length + 1;
      nextId = parseInt(accIdStr + "0".repeat(newLen - accIdStr.length), 10);
    }
    
    return nextId;
  };

  // --- 思い出登録用の状態 ---
  const [memoryCode, setMemoryCode] = useState('');
  const [memoryError, setMemoryError] = useState(false);
  const [memoryErrorLine, setMemoryErrorLine] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const jsonPreRef = useRef(null);
  const jsonLineRef = useRef(null);
  const jsonErrorPreRef = useRef(null);
  const jsonTooltipRef = useRef(null);

  // --- 見た目編集用の状態 ---
  const [appearanceCode, setAppearanceCode] = useState('');
  const [appearanceError, setAppearanceError] = useState('');
  const [appearanceErrorLines, setAppearanceErrorLines] = useState([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const jsPreRef = useRef(null);
  const jsLineRef = useRef(null);
  const jsErrorPreRef = useRef(null);
  const jsTooltipRef = useRef(null);

  const [activeJsLine, setActiveJsLine] = useState(null);
  const [activeJsonLine, setActiveJsonLine] = useState(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // --- 書式リセット処理 ---
  const handleResetMemory = () => {
    setMemoryCode(`{\n  "name": ,\n  "latitude": ,\n  "longitude": ,\n  "detail": \n}`);
    setMemoryError(false);
    setMemoryErrorLine(-1);
  };

  const handleResetAppearance = () => {
    if (userSettings) {
      setAppearanceCode(`export const pinColor = "${userSettings.pinColor || 'red'}";\nexport const textSize = ${userSettings.textSize || 15};\nexport const fontFamily = "${userSettings.fontFamily || 'sans-serif'}";`);
      setAppearanceError('');
      setAppearanceErrorLines([]);
    }
  };

  // モーダルを開いた時に状態をリセット・初期化
  useEffect(() => {
    if (opened) {
      // 動的に次のIDを計算してテンプレートを作成
      const nextId = generateNextMemoryId(userSettings?.id, sharedMemories);
      const dynamicTemplate = `{
  "name": ,
  "latitude": ,
  "longitude": ,
  "detail": 
}`;

      // JSONエディタの初期化
      setMemoryCode(dynamicTemplate);
      setMemoryError(false);
      setMemoryErrorLine(-1);

      // JSエディタ（見た目の編集）の初期化（実際のユーザー設定を反映）
      if (userSettings) {
        setAppearanceCode(`export const pinColor = "${userSettings.pinColor || 'red'}";\nexport const textSize = ${userSettings.textSize || 15};\nexport const fontFamily = "${userSettings.fontFamily || 'sans-serif'}";`);
        setAppearanceError('');
        setAppearanceErrorLines([]);
      }
    }
  }, [opened, userSettings, sharedMemories]);

  const handleMemoryChange = (e) => {
    const code = e.target.value;
    setMemoryCode(code);
    try {
      JSON.parse(code);
      setMemoryError(false);
      setMemoryErrorLine(-1);
    } catch (err) {
      setMemoryError(true);
      const posMatch = err.message.match(/position (\d+)/);
      const lineMatch = err.message.match(/line (\d+)/);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const upToPos = code.substring(0, pos);
        setMemoryErrorLine((upToPos.match(/\n/g) || []).length);
      } else if (lineMatch) {
        setMemoryErrorLine(parseInt(lineMatch[1], 10) - 1);
      } else {
        setMemoryErrorLine(0);
      }
    }
  };

  const handleJsonScroll = (e) => {
    const scrollTop = e.target.scrollTop;
    const scrollLeft = e.target.scrollLeft;
    if (jsonPreRef.current) {
      jsonPreRef.current.scrollTop = scrollTop;
      jsonPreRef.current.scrollLeft = scrollLeft;
    }
    if (jsonErrorPreRef.current) {
      jsonErrorPreRef.current.scrollTop = scrollTop;
      jsonErrorPreRef.current.scrollLeft = scrollLeft;
    }
    if (jsonLineRef.current) {
      jsonLineRef.current.scrollTop = scrollTop;
    }
    if (jsonTooltipRef.current) {
      jsonTooltipRef.current.scrollTop = scrollTop;
      jsonTooltipRef.current.scrollLeft = scrollLeft;
    }
  };

  const highlightedJson = useMemo(() => {
    try {
      let html = hljs.highlight(memoryCode, { language: 'json' }).value;
      return html;
    } catch (error) {
      return memoryCode;
    }
  }, [memoryCode]);

  // 送信処理（思い出）
  const handleSubmitMemories = async () => {
    if (memoryError || !memoryCode.trim()) return;
    
    setIsSubmitting(true);
    try {
      let payload = JSON.parse(memoryCode);
      
      if (!Array.isArray(payload)) {
        if (payload.MapData && Array.isArray(payload.MapData)) {
          payload = payload.MapData;
        } else {
          payload = [payload];
        }
      }
      
      payload = payload.map(item => ({
        ...item,
        account_id: userSettings?.id
      }));
      
      const response = await fetch(`${getApiBaseUrl()}/sakaki-map/api/memories`, {
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
      notifications.show({
        title: '成功',
        message: result.message || '送信に成功しました！',
        color: 'green',
        className: 'glass-notification'
      });
      window.dispatchEvent(new Event('memoriesUpdated'));
    } catch (error) {
      console.error('Submit error:', error);
      notifications.show({
        title: 'エラー',
        message: `送信エラー: ${error.message}`,
        color: 'red',
        className: 'glass-notification'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppearanceChange = (e) => {
    const code = e.target.value;
    setAppearanceCode(code);
    
    if (code.trim() === '') {
      setAppearanceError('');
      setAppearanceErrorLines([]);
      return;
    }
    
    const lines = code.split('\n');
    const errLines = [];
    lines.forEach((line, i) => {
      if (line.trim() === '') return;
      const isValid = /export\s+const\s+(pinColor|textSize|fontFamily)\s*=\s*(("[^"]*")|(\d+(\.\d+)?))\s*;/.test(line);
      if (!isValid) errLines.push(i);
    });
    setAppearanceErrorLines(errLines);

    const pinColorMatch = code.match(/export\s+const\s+pinColor\s*=\s*"([^"]*)";/);
    const textSizeMatch = code.match(/export\s+const\s+textSize\s*=\s*(\d+(\.\d+)?);/);
    const fontFamilyMatch = code.match(/export\s+const\s+fontFamily\s*=\s*"([^"]*)";/);

    if (!pinColorMatch || !textSizeMatch || !fontFamilyMatch) {
      setAppearanceError('書き方が正しくありません。Lv.1のルールに従ってください。');
    } else {
      setAppearanceError('');
    }
  };

  const handleJsScroll = (e) => {
    if (jsPreRef.current) {
      jsPreRef.current.scrollTop = e.target.scrollTop;
      jsPreRef.current.scrollLeft = e.target.scrollLeft;
    }
    if (jsErrorPreRef.current) {
      jsErrorPreRef.current.scrollTop = e.target.scrollTop;
      jsErrorPreRef.current.scrollLeft = e.target.scrollLeft;
    }
    if (jsLineRef.current) {
      jsLineRef.current.scrollTop = e.target.scrollTop;
    }
    if (jsTooltipRef.current) {
      jsTooltipRef.current.scrollTop = e.target.scrollTop;
      jsTooltipRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const checkEmptySpaceClick = (e, text, setActiveLine) => {
    if (e.type === 'click' && e.nativeEvent) {
      const lines = text.split('\n');
      const textHeight = 16 + (lines.length * 21); // 16px padding-top, 21px per line
      
      // クリック位置が全てのテキストより下の場合
      if (e.nativeEvent.offsetY > textHeight) {
        setActiveLine(null);
        return true;
      }
      
      // クリック位置が現在の行のテキストより右側の場合
      const cursor = e.target.selectionStart;
      const lineIdx = text.substr(0, cursor).split('\n').length - 1;
      const currentLineText = lines[lineIdx] || '';
      // 等幅フォント(14px)の文字幅は約8.4px。余裕を持たせて40pxのバッファを追加
      const textWidth = 16 + (currentLineText.length * 8.4) + 40; 
      
      if (e.nativeEvent.offsetX > textWidth) {
        setActiveLine(null);
        return true;
      }
    }
    return false;
  };

  const handleJsCursor = (e) => {
    if (checkEmptySpaceClick(e, e.target.value, setActiveJsLine)) return;
    const text = e.target.value;
    const cursor = e.target.selectionStart;
    const line = text.substr(0, cursor).split('\n').length - 1;
    setActiveJsLine(line);
  };

  const handleJsonCursor = (e) => {
    if (checkEmptySpaceClick(e, e.target.value, setActiveJsonLine)) return;
    const text = e.target.value;
    const cursor = e.target.selectionStart;
    const line = text.substr(0, cursor).split('\n').length - 1;
    setActiveJsonLine(line);
  };

  const highlightedAppearance = useMemo(() => {
    try {
      let html = hljs.highlight(appearanceCode, { language: 'javascript' }).value;
      

      return html;
    } catch (e) {
      return appearanceCode;
    }
  }, [appearanceCode]);

  const handleSaveAppearance = async () => {
    if (appearanceError || appearanceCode.trim() === '') return;
    setIsSavingSettings(true);
    
    const pinColorMatch = appearanceCode.match(/export\s+const\s+pinColor\s*=\s*"([^"]*)";/);
    const textSizeMatch = appearanceCode.match(/export\s+const\s+textSize\s*=\s*(\d+(\.\d+)?);/);
    const fontFamilyMatch = appearanceCode.match(/export\s+const\s+fontFamily\s*=\s*"([^"]*)";/);

    if (!pinColorMatch || !textSizeMatch || !fontFamilyMatch) {
      setAppearanceError('保存に失敗しました。書き方が間違っています。');
      setIsSavingSettings(false);
      return;
    }

    const newSettings = {
      ...userSettings,
      pinColor: pinColorMatch[1],
      textSize: parseFloat(textSizeMatch[1]),
      fontFamily: fontFamilyMatch[1]
    };

    try {
      // サーバーのアカウント情報を更新
      if (newSettings.id) {
        const payload = [{
          id: newSettings.id,
          username: newSettings.username,
          pinColor: newSettings.pinColor,
          textSize: newSettings.textSize,
          fontFamily: newSettings.fontFamily
        }];
        const response = await fetch(`${getApiBaseUrl()}/sakaki-map/api/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('アカウント設定の更新に失敗しました');
      }

      // フロントエンドの状態も更新
      setUserSettings(newSettings);
      localStorage.setItem('sakaki_user_settings', JSON.stringify(newSettings));
      
      notifications.show({
        title: '保存完了',
        message: '見た目の設定を保存しました。',
        color: 'green',
        className: 'glass-notification'
      });
    } catch (error) {
      notifications.show({
        title: 'エラー',
        message: error.message,
        color: 'red',
        className: 'glass-notification'
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // エディタとハイライトの完全なスタイル一致のための共通設定
  const editorFontSettings = {
    fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
    fontSize: '14px',
    lineHeight: '1.5',
    letterSpacing: 'normal',
    wordSpacing: 'normal',
    tabSize: 2,
  };

  // オーバーレイエディタのスタイル
  const overlayEditorStyle = {
    ...editorFontSettings,
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    padding: '16px',
    margin: 0,
    border: 'none',
    backgroundColor: 'transparent',
    color: 'transparent',
    caretColor: '#d4d4d4',
    resize: 'none',
    outline: 'none',
    whiteSpace: 'pre',
    overflow: 'auto',
    zIndex: 2,
    boxSizing: 'border-box'
  };

  const highlightPreStyle = {
    ...editorFontSettings,
    margin: 0,
    padding: '16px',
    color: '#d4d4d4',
    minWidth: '100%',
    minHeight: '100%',
    width: 'max-content',
    pointerEvents: 'none',
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    boxSizing: 'border-box'
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text size="lg" fw={700} c="white">マイページ</Text>}
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
      <Tabs value={activeTab} onChange={handleTabChange} color="blue" styles={{
        root: { display: 'flex', flexDirection: 'column', height: 'calc(85vh - 60px)' },
        panel: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
        list: { borderBottom: '1px solid #333' },
        tab: { color: '#aaa', '&[data-active]': { color: 'white' } }
      }}>
        <Tabs.List px="md" pt="sm">
          <Tabs.Tab value="account" leftSection={<IconUser size={16} />}>アカウント情報</Tabs.Tab>
          <Tabs.Tab value="memory" leftSection={<IconFileCode size={16} />}>思い出の新規登録</Tabs.Tab>
          <Tabs.Tab value="appearance" leftSection={<IconPalette size={16} />}>見た目の編集</Tabs.Tab>
        </Tabs.List>

        {/* --- タブ: アカウント情報 --- */}
        <Tabs.Panel value="account" p="xl">
          <Stack gap="md">
            <Box p="md" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <Text c="dimmed" size="sm">ユーザー名</Text>
              <Text c="white" size="lg" fw={700}>{userSettings?.username}</Text>
            </Box>
            <Box p="md" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <Text c="dimmed" size="sm">ID</Text>
              <Text c="white" size="lg" fw={700}>{userSettings?.id || '未登録'}</Text>
            </Box>
            <Box mt="md" style={{ display: 'flex', justifyContent: 'center' }}>
              <Button variant="light" color="blue" onClick={() => setIsCertModalOpen(true)}>修了証を表示</Button>
            </Box>
          </Stack>
        </Tabs.Panel>

        {/* --- タブ: 思い出の新規登録 --- */}
        <Tabs.Panel value="memory">
          <Box p="md" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            
            <Box style={{ 
              flex: 1, 
              backgroundColor: '#1e1e1e', 
              borderRadius: '8px', 
              border: '1px solid #373a40',
              overflow: 'hidden', 
              display: 'flex',
              flexDirection: 'column'
            }}>

              <Box style={{ flex: 1, display: 'flex', position: 'relative' }}>
                {/* 行番号 */}
                <Box ref={jsonLineRef} style={{ 
                  padding: '16px 8px', 
                  backgroundColor: '#1e1e1e', 
                  color: '#858585', 
                  textAlign: 'right',
                  fontFamily: 'Menlo, Monaco, Consolas, monospace',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  userSelect: 'none',
                  borderRight: '1px solid #333',
                  zIndex: 3,
                  overflow: 'hidden'
                }}>
                  {memoryCode.split('\n').map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </Box>
                {/* エディタ部分 */}
                <Box style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                  <textarea
                    value={memoryCode}
                    onChange={(e) => { handleMemoryChange(e); handleJsonCursor(e); }}
                    onSelect={handleJsonCursor}
                    onKeyUp={handleJsonCursor}
                    onClick={handleJsonCursor}
                    onBlur={() => setActiveJsonLine(null)}
                    onScroll={handleJsonScroll}
                    spellCheck={false}
                    style={{ ...overlayEditorStyle, zIndex: 3 }}
                  />
                  <pre ref={jsonErrorPreRef} style={{ ...highlightPreStyle, zIndex: 2, color: 'transparent' }}>
                    {memoryCode.split('\n').map((line, i) => (
                      <span key={i} style={i === memoryErrorLine ? { textDecoration: 'underline wavy red', textDecorationColor: 'red' } : {}}>
                        {line}{'\n'}
                      </span>
                    ))}
                  </pre>
                  <pre ref={jsonPreRef} style={{ ...highlightPreStyle, zIndex: 1 }}>
                    <code 
                      className="hljs language-json"
                      style={{ background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit' }}
                      dangerouslySetInnerHTML={{ __html: highlightedJson }}
                    />
                  </pre>
                  
                  {/* ヘルプツールチップのレイヤー（latitudeとlongitudeの最大幅に追従） */}
                  <pre ref={jsonTooltipRef} style={{ ...highlightPreStyle, zIndex: 10000, color: 'transparent', pointerEvents: 'none' }}>
                    {(() => {
                      const lines = memoryCode.split('\n');
                      const latLine = lines.find(l => l.includes('"latitude"')) || '';
                      const lonLine = lines.find(l => l.includes('"longitude"')) || '';
                      const maxLen = Math.max(latLine.length, lonLine.length);
                      
                      return lines.map((line, i) => {
                        const isLatLine = line.includes('"latitude"');
                        const padding = isLatLine ? ' '.repeat(Math.max(0, maxLen - line.length)) : '';
                        
                        return (
                          <span key={i}>
                            {line}
                            {padding}
                            {isLatLine && (
                              <span style={{ position: 'relative', display: 'inline-block', width: 0, height: 0, pointerEvents: 'auto' }}>
                                <Box style={{ position: 'absolute', left: '8px', top: 'calc(50% + 10.5px)', transform: 'translateY(-50%)' }}>
                                  <CodeHelp 
                                    text="<a href='https://maps.google.com/' target='_blank' rel='noopener noreferrer' style='color: #4dabf7; text-decoration: none;'>Googleマップ</a>を開き、地図上の場所を右クリックして、<br/>緯度(latitude)と経度(longitude)をコピーしてください。" 
                                    videoSrc={copyingCoordinateVideo} 
                                    forceOpen={activeJsonLine !== null && (lines[activeJsonLine]?.includes('"latitude"') || lines[activeJsonLine]?.includes('"longitude"'))}
                                  />
                                </Box>
                              </span>
                            )}
                            {'\n'}
                          </span>
                        );
                      });
                    })()}
                  </pre>
                </Box>
              </Box>
            </Box>

            <Group justify="space-between">
              <Button 
                variant="subtle" 
                color="gray" 
                size="sm"
                leftSection={<IconRefresh size={16} />}
                onClick={handleResetMemory}
              >
                リセット
              </Button>
              <Button 
                color="cyan" 
                leftSection={<IconSend size={18} />} 
                onClick={handleSubmitMemories}
                disabled={memoryError || !memoryCode.trim()}
                loading={isSubmitting}
              >
                送信
              </Button>
            </Group>
          </Box>
        </Tabs.Panel>

        {/* --- タブ: 見た目の編集 --- */}
        <Tabs.Panel value="appearance">
          <Box p="md" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            
            <Box style={{ 
              flex: 1, 
              backgroundColor: '#1e1e1e', 
              borderRadius: '8px', 
              border: '1px solid #373a40',
              overflow: 'hidden', 
              display: 'flex',
              flexDirection: 'column'
            }}>
              
              <Box style={{ flex: 1, display: 'flex', position: 'relative' }}>
                {/* 行番号 */}
                <Box ref={jsLineRef} style={{ 
                  padding: '16px 8px', 
                  backgroundColor: '#1e1e1e', 
                  color: '#858585', 
                  textAlign: 'right',
                  fontFamily: 'Menlo, Monaco, Consolas, monospace',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  userSelect: 'none',
                  borderRight: '1px solid #333',
                  zIndex: 3,
                  overflow: 'hidden'
                }}>
                  {(appearanceCode || ' ').split('\n').map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </Box>
                {/* エディタ部分 */}
                <Box style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                  <textarea
                    value={appearanceCode}
                    onChange={(e) => { handleAppearanceChange(e); handleJsCursor(e); }}
                    onSelect={handleJsCursor}
                    onKeyUp={handleJsCursor}
                    onClick={handleJsCursor}
                    onBlur={() => setActiveJsLine(null)}
                    onScroll={handleJsScroll}
                    spellCheck={false}
                    style={{ ...overlayEditorStyle, zIndex: 3 }}
                  />
                  <pre ref={jsErrorPreRef} style={{ ...highlightPreStyle, zIndex: 2, color: 'transparent' }}>
                    {appearanceCode.split('\n').map((line, i) => (
                      <span key={i} style={appearanceErrorLines.includes(i) ? { textDecoration: 'underline wavy red', textDecorationColor: 'red' } : {}}>
                        {line}{'\n'}
                      </span>
                    ))}
                  </pre>
                  <pre ref={jsPreRef} style={{ ...highlightPreStyle, zIndex: 1 }}>
                    <code 
                      className="hljs language-javascript"
                      style={{ background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit' }}
                      dangerouslySetInnerHTML={{ __html: highlightedAppearance }}
                    />
                  </pre>
                  {/* ヘルプツールチップのレイヤー（各変数の行末に配置） */}
                  <pre ref={jsTooltipRef} style={{ ...highlightPreStyle, zIndex: 10000, color: 'transparent', pointerEvents: 'none' }}>
                    {appearanceCode.split('\n').map((line, i) => {
                      const hasPinColor = line.includes('pinColor');
                      const hasTextSize = line.includes('textSize');
                      const hasFontFamily = line.includes('fontFamily');
                      
                      let helpText = '';
                      if (hasPinColor) helpText = `地図上のピンの色を変更します。<br/>
<table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
  <tr><td style="color: red; padding: 2px 4px;">赤</td><td style="padding: 2px 4px;">red</td></tr>
  <tr><td style="color: blue; padding: 2px 4px;">青</td><td style="padding: 2px 4px;">blue</td></tr>
  <tr><td style="color: green; padding: 2px 4px;">緑</td><td style="padding: 2px 4px;">green</td></tr>
  <tr><td style="color: yellow; padding: 2px 4px;">黄</td><td style="padding: 2px 4px;">yellow</td></tr>
  <tr><td style="color: orange; padding: 2px 4px;">オレンジ</td><td style="padding: 2px 4px;">orange</td></tr>
  <tr><td style="color: purple; padding: 2px 4px;">紫</td><td style="padding: 2px 4px;">purple</td></tr>
</table>`;
                      else if (hasTextSize) helpText = '文字のサイズを変更します。';
                      else if (hasFontFamily) helpText = `フォント（文字の見た目）を変更します。<br/>
<table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
  <tr><td style="font-family: 'Keifont'; padding: 2px 4px; font-size: 14px;">けいふぉんと</td><td style="padding: 2px 4px;">Keifont</td></tr>
  <tr><td style="font-family: 'Mincho'; padding: 2px 4px; font-size: 14px;">明朝体</td><td style="padding: 2px 4px;">Mincho</td></tr>
  <tr><td style="font-family: 'Chikara-dzuyoku'; padding: 2px 4px; font-size: 14px;">851チカラヅヨク</td><td style="padding: 2px 4px;">Chikara-dzuyoku</td></tr>
  <tr><td style="font-family: 'Chikara-yowaku'; padding: 2px 4px; font-size: 14px;">851チカラヨワク</td><td style="padding: 2px 4px;">Chikara-yowaku</td></tr>
  <tr><td style="font-family: 'Cinecaption'; padding: 2px 4px; font-size: 14px;">シネキャプション</td><td style="padding: 2px 4px;">Cinecaption</td></tr>
  <tr><td style="font-family: 'Mushin'; padding: 2px 4px; font-size: 14px;">無心</td><td style="padding: 2px 4px;">Mushin</td></tr>
  <tr><td style="font-family: 'Fui-ji'; padding: 2px 4px; font-size: 14px;">ふい字</td><td style="padding: 2px 4px;">Fui-ji</td></tr>
</table>`;

                      return (
                        <span key={i}>
                          {line}
                          {helpText && (
                            <span style={{ position: 'relative', display: 'inline-block', width: 0, height: 0, pointerEvents: 'auto' }}>
                              <Box style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }}>
                                <CodeHelp text={helpText} forceOpen={activeJsLine === i} />
                              </Box>
                            </span>
                          )}
                          {'\n'}
                        </span>
                      );
                    })}
                  </pre>
                </Box>
              </Box>
            </Box>

            <Group justify="space-between">
              <Button 
                variant="subtle" 
                color="gray" 
                size="sm"
                leftSection={<IconRefresh size={16} />}
                onClick={handleResetAppearance}
              >
                リセット
              </Button>
              <Button 
                color="blue" 
                leftSection={<IconDeviceFloppy size={18} />} 
                onClick={handleSaveAppearance}
                disabled={!!appearanceError || appearanceCode.trim() === ''}
                loading={isSavingSettings}
              >
                保存
              </Button>
            </Group>
          </Box>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        size="xl"
        centered
        withCloseButton={false}
        padding={0}
        zIndex={10030}
        yOffset={0}
        transitionProps={{ 
          transition: {
            in: { opacity: 1, transform: 'scale(1)' },
            out: { opacity: 0, transform: 'scale(0)' },
            transitionProperty: 'transform, opacity',
          }, 
          duration: 400,
          timingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        styles={{ 
          inner: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
          body: { padding: 0, backgroundColor: 'transparent' }, 
          content: { 
            backgroundColor: 'transparent', 
            boxShadow: 'none', 
            transformOrigin: 'center center !important' 
          } 
        }}
      >
        <Box style={{ 
          position: 'relative', 
          width: '100%', 
          maxWidth: 'calc(80vh * (2911 / 4117))',
          margin: '0 auto',
          aspectRatio: '2911 / 4117', 
          backgroundImage: `url(${certificateBg})`, 
          backgroundSize: '100% 100%', 
          backgroundPosition: 'center', 
          backgroundRepeat: 'no-repeat',
          fontFamily: "'Noto Serif JP', serif", 
          fontWeight: 700,
          color: '#222',
          containerType: 'inline-size'
        }}>
          <ActionIcon
            onClick={() => setIsCertModalOpen(false)}
            variant="transparent"
            color="dark"
            style={{ position: 'absolute', top: '2cqw', right: '2cqw', zIndex: 10 }}
          >
            <IconX size="6cqw" />
          </ActionIcon>
          <Box style={{ 
            position: 'absolute', 
            top: '15%', 
            left: '18%', 
            right: '18%', 
            bottom: '15%', 
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: '7cqw', textAlign: 'center', letterSpacing: '0.2em', fontWeight: 'bold' }}>修了証</div>
            
            <div>
              <div style={{ fontSize: '5cqw', marginBottom: '4cqw' }}>{userSettings?.username || 'ゲスト'} 様</div>
              <div style={{ fontSize: '3cqw', lineHeight: 1.8, textIndent: '1em' }}>
                あなたは、坂城町講座の「プログラマー体験！さかき思い出マップを作ろう」において、よく考え、失敗しながらもあきらめずに講座を修了しました。
              </div>
              <div style={{ fontSize: '3cqw', lineHeight: 1.8, textIndent: '1em' }}>  
                よって、あなたの努力をたたえ、ここに表彰します。
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5cqw', marginBottom: '2cqw' }}>令和８年６月27日</div>
              <div style={{ fontSize: '2.5cqw' }}>長野大学共創情報学部 准教授　関 暁之</div>
              <div style={{ fontSize: '2.5cqw' }}>長野大学学生・講座アシスタント　野倉 悠正</div>
            </div>
          </Box>
        </Box>
      </Modal>
    </Modal>
  );
}