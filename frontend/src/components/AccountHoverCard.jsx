import React, { useState } from "react";
import { HoverCard, ActionIcon, Stack, Text, Button, Tooltip, Modal, Group } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import '../css/GlassStyle.css';

export default function AccountHoverCard({ userSettings, setUserSettings, isSearchFocused, onOpenMyPage }) {
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [confirmOpened, setConfirmOpened] = useState(false);

  const isLoggedIn = !!userSettings.username;

  const handleLogout = () => {
    // ログアウト時に初期設定に戻す
    setUserSettings({
      username: null,
      pinColor: 'red',
      textSize: 15,
      fontFamily: 'sans-serif'
    });
    localStorage.removeItem('sakaki_user_settings');
    setConfirmOpened(false);
    setOpened(false);
    notifications.show({
      title: 'ログアウト',
      message: 'ログアウトしました',
      color: 'red',
      className: 'glass-notification'
    });
  };

  const actionIcon = (
    <ActionIcon 
      onClick={() => {
        if (!isLoggedIn) {
          navigate('/login');
        } else {
          setOpened((o) => !o); // スマホなどのためにクリックでも開閉できるようにする
        }
      }} 
      className="glass-panel" 
      variant="transparent" 
      style={{ 
        width: '60px', 
        height: '60px', 
        filter: isSearchFocused ? 'blur(3px)' : 'none', 
        transition: 'filter 0.3s ease', 
        pointerEvents: isSearchFocused ? 'none' : 'auto' 
      }}
    >
      <IconUser size={24} color={isLoggedIn ? 'var(--mantine-color-blue-5)' : 'currentColor'} />
    </ActionIcon>
  );

  // ログイン済みの場合
  if (isLoggedIn) {
    return (
      <>
        <Modal 
          opened={confirmOpened} 
          onClose={() => setConfirmOpened(false)} 
          title={<Text c="var(--glass-text)" fw={700} size="sm">ログアウトの確認</Text>} 
          centered
          radius="xl"
          zIndex={12000}
          classNames={{ content: 'glass-modal', header: 'glass-modal-header' }}
          size="xs"
        >
          <div style={{ padding: '8px' }}>
            <Text size="xs" mb="xl">本当にログアウトしますか？</Text>
            <Group justify="flex-end" gap="xs">
              <Button variant="default" size="xs" onClick={() => setConfirmOpened(false)}>いいえ</Button>
              <Button color="red" size="xs" onClick={handleLogout}>はい</Button>
            </Group>
          </div>
        </Modal>

        <HoverCard 
          width={200} 
          shadow="md" 
          withArrow 
          openDelay={200} 
          closeDelay={200}
          opened={opened}
          onChange={setOpened}
          zIndex={10001}
        >
          <HoverCard.Target>
            {actionIcon}
          </HoverCard.Target>
          <HoverCard.Dropdown className="glass-dropdown" style={{ padding: '24px' }}>
            <Stack gap="sm">
              <Text size="xs" fw={500} style={{ color: 'white' }}>ログイン中</Text>
              <Text size="sm" fw={700} style={{ color: 'white' }}>
                {userSettings.username}
              </Text>
              <Button 
                variant="light" 
                size="xs" 
                fullWidth 
                mt="xs"
                onClick={() => {
                  setOpened(false);
                  if (onOpenMyPage) onOpenMyPage();
                }}
              >
                マイページ
              </Button>
              <Button variant="outline" color="red" size="xs" fullWidth onClick={() => setConfirmOpened(true)}>
                ログアウト
              </Button>
            </Stack>
          </HoverCard.Dropdown>
        </HoverCard>
      </>
    );
  }

  // 未ログインの場合
  return (
    <Tooltip label="ログイン" withArrow position="bottom" classNames={{ tooltip: 'glass-tooltip' }}>
      {actionIcon}
    </Tooltip>
  );
}
