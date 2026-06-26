import React from 'react';
import { Box, Title, CloseButton, Stack, Text, Group, ScrollArea, List, Image } from '@mantine/core';
import { useDetailCard } from '../lv2';

// === ユーティリティ関数 ===
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function SideBar({sidebarRef, isResizing, sidebarHeight, isMobile, sidebarWidth, startResizing, snapPoints, titleOnlyRef, customTextStyle, selectedMemory, cardRef, handleReset, userLocation, selectedMemoryId, filteredMemories, setSelectedMemoryId, setFitPoints, isLocationActive}) {
  return (
    <>
      {/* 1. 一覧表示用のサイドバー */}
      <Box ref={sidebarRef} className={`glass-sidebar ${!isResizing ? 'sidebar-transition' : ''}`} style={{
        position: 'absolute', bottom: '0', 
        left: isMobile ? '10px' : '20px', right: isMobile ? '10px' : 'auto',
        width: isMobile ? 'auto' : `${sidebarWidth}px`, height: `${sidebarHeight}px`,
        borderRadius: '20px 20px 0 0', touchAction: 'none',
        display: 'flex', flexDirection: 'column', zIndex: 1000, overflow: 'hidden',
        transform: selectedMemory ? 'translateY(120%)' : 'translateY(0)',
        transition: !isResizing ? 'height 0.3s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'transform 0.4s ease',
      }}>
        {/* リサイズ用のハンドル */}
        <Box onMouseDown={startResizing} onTouchStart={startResizing} style={{ height: '32px', paddingTop: '12px', cursor: 'row-resize', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', touchAction: 'none' }}>
          <Box style={{ width: '40px', height: '5px', borderRadius: '10px', backgroundColor: 'rgba(128,128,128,0.4)' }} />
        </Box>

        <Box px="md" pb="md" style={{ borderBottom: sidebarHeight > snapPoints[0] + 10 ? '1px solid #373a40' : 'none', touchAction: 'none' }}>
          <div ref={titleOnlyRef}>
            <Title order={3} style={{ ...customTextStyle, color: 'white' }} mb={sidebarHeight > snapPoints[0] + 10 ? "xs" : 0}>
              思い出の場所リスト
            </Title>
          </div>
        </Box>

        <ScrollArea style={{ flex: 1, opacity: sidebarHeight > snapPoints[0] + 20 ? 1 : 0, touchAction: 'pan-y' }}>
          <Stack gap="xs" pt="md" pb={80} pl={0} pr="md">
            <List spacing={0} size="sm">
              {filteredMemories.length > 0 ? (
                filteredMemories.map(f => (
                  <List.Item
                    key={f.id}
                    style={{
                      cursor: 'pointer', padding: '12px 16px', borderRadius: '15px',
                      backgroundColor: selectedMemoryId === f.id ? 'rgba(34, 139, 230, 0.15)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.05)'
                    }}
                    onClick={() => {
                      setSelectedMemoryId(f.id);
                      setFitPoints((userLocation && isLocationActive) ? [[f.latitude, f.longitude], userLocation] : [[f.latitude, f.longitude]]);
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Box>
                        <Text style={{ ...customTextStyle, color: 'white' }} fw={500}>{f.name}</Text>
                        <Text c="dimmed" size="xs">{f.location}</Text>
                      </Box>
                    </Group>
                  </List.Item>
                ))
              ) : (
                <Text c="dimmed" size="sm" ta="center" mt="md">
                  データが登録されていません
                </Text>
              )}
            </List>
          </Stack>
        </ScrollArea>
      </Box>

      {/* 2. 詳細表示用のサイドバー */}
      {useDetailCard && (
        <Box 
          className={`glass-sidebar ${!isResizing ? 'sidebar-transition' : ''}`} 
          style={{
            position: 'absolute', bottom: '0', 
            left: isMobile ? '10px' : '20px', right: isMobile ? '10px' : 'auto',
            width: isMobile ? 'auto' : `${sidebarWidth}px`, 
            height: `${sidebarHeight}px`,
            borderRadius: '20px 20px 0 0', 
            display: 'flex', flexDirection: 'column', 
            zIndex: 1001, 
            overflow: 'hidden',
            transform: selectedMemory ? 'translateY(0)' : 'translateY(120%)',
            transition: !isResizing ? 'height 0.3s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'transform 0.4s ease',
            pointerEvents: selectedMemory ? 'auto' : 'none',
          }}
        >
          <Box 
            onMouseDown={startResizing} 
            onTouchStart={startResizing} 
            style={{ height: '32px', paddingTop: '12px', cursor: 'row-resize', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', touchAction: 'none' }}
          >
            <Box style={{ width: '40px', height: '5px', borderRadius: '10px', backgroundColor: 'rgba(128,128,128,0.4)' }} />
            <CloseButton onClick={handleReset} size="md" variant="subtle" style={{ position: 'absolute', top: 6, right: 12, zIndex: 2 }} />
          </Box>

          {/* コンテンツ部分 */}
          <ScrollArea style={{ flex: 1, touchAction: 'pan-y' }}>
            <Stack gap="md" px="md" pb={40} pt="xs">
              <Box pr={30}>
                <Text style={{ ...customTextStyle, color: 'white' }} fw={700}>
                  {selectedMemory?.name || ''}
                </Text>
                <Text size="xs" c="dimmed">
                  {selectedMemory?.location || ''}
                </Text>
                {userLocation && selectedMemory && (
                  <Text size="xs" c="blue.5" fw={600} mt={4}>
                    現在地から約 {calculateDistance(userLocation[0], userLocation[1], selectedMemory.latitude, selectedMemory.longitude).toFixed(1)} km
                  </Text>
                )}
              </Box>

              {/* 画像の表示 */}
              {selectedMemory?.ImageURI && (
                <Image
                  src={selectedMemory.ImageURI}
                  alt={selectedMemory.name}
                  radius="md"
                  fallbackSrc="https://placehold.co/600x400?text=No+Image"
                />
              )}

              {/* 説明文の表示 */}
              {selectedMemory?.detail && (
                <Text size="sm" style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>
                  {selectedMemory.detail}
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Box>
      )}
    </>
  );
}