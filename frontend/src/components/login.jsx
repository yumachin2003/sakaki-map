import React, { useState } from "react";
import { Drawer, Modal, Text, TextInput, PasswordInput, Button, Stack, Alert } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { getApiBaseUrl } from '../App';
import '../css/GlassStyle.css';

export default function Login({ opened, onClose, onLoginSuccess }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!username) {
      setError("ユーザー名を入力してください");
      return;
    }
    if (!password) {
      setError("パスワードを入力してください");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/sakaki-map/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'ログインに失敗しました');
      }

      onLoginSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const title = <Text c="var(--glass-text)" fw={700}>ログイン</Text>;

  const formContent = (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        {error && <Alert color="red" title="ログインエラー">{error}</Alert>}
        
        <TextInput 
          label="ユーザー名（下の名前）"
          placeholder="例：タロウ" 
          value={username} 
          onChange={(e) => setUsername(e.currentTarget.value)}
          required 
          autoFocus
        />
        
        <PasswordInput 
          label="パスワード"
          placeholder="パスワードを入力" 
          value={password} 
          onChange={(e) => setPassword(e.currentTarget.value)}
          required 
        />

        <Button type="submit" fullWidth loading={loading} mt="md">
          ログイン
        </Button>
      </Stack>
    </form>
  );

  const commonProps = {
    opened,
    onClose,
    title,
    zIndex: 11000, // AppShell(10000)より上に表示
    overlayProps: { backgroundOpacity: 0.2, blur: 4 },
  };

  if (isMobile) {
    return (
      <Modal
        {...commonProps}
        centered
        radius="xl"
        classNames={{ content: 'glass-modal', header: 'glass-modal-header' }}
      >
        {formContent}
      </Modal>
    );
  }

  return (
    <Drawer
      {...commonProps}
      position="right"
      size="sm"
      radius="xl"
      transitionProps={{ transition: 'slide-left', duration: 400 }}
      offset={12}
      classNames={{ content: 'glass-drawer', header: 'glass-drawer-header' }}
    >
      {formContent}
    </Drawer>
  );
}
