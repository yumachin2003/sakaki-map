import React, { useState, useEffect } from 'react';
import { Box, Transition, Stack, Image } from '@mantine/core';
import { useLocation } from 'react-router-dom';
import titleImage from '../assets/title.png';

export default function Opening() {
  const location = useLocation();
  // URLが /upload の場合は最初から表示しない
  const [showSplash, setShowSplash] = useState(location.pathname !== '/upload');

  useEffect(() => {
    if (!showSplash) return;

    // 3秒後に自動で非表示にする
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, [showSplash]);

  return (
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
  );
}