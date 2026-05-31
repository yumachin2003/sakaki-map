import React from 'react';
import { Box, Title, TextInput, Paper, CloseButton, Stack, Text, Divider, Group, Button, ScrollArea, List } from '@mantine/core';
import { IconSearch, IconCar, IconTrain, IconMapPinFilled } from '@tabler/icons-react';
import { useDetailCard } from '../lv2';
import { pinColor } from '../lv1';

// === ユーティリティ関数 ===
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function SideBar({
  sidebarRef,
  isResizing,
  sidebarHeight,
  isMobile,
  sidebarWidth,
  startResizing,
  snapPoints,
  titleOnlyRef,
  customTextStyle,
  searchTerm,
  setSearchTerm,
  selectedMemory,
  cardRef,
  handleReset,
  userLocation,
  selectedMemoryId,
  filteredMemories,
  setSelectedMemoryId,
  setFitPoints
}) {
  return (
    <Box ref={sidebarRef} className={`glass-sidebar ${!isResizing ? 'sidebar-transition' : ''}`} style={{
      position: 'absolute', bottom: '0', 
      left: isMobile ? '10px' : '20px', right: isMobile ? '10px' : 'auto',
      width: isMobile ? 'auto' : `${sidebarWidth}px`, height: `${sidebarHeight}px`,
      borderRadius: '20px 20px 0 0', touchAction: 'none',
      display: 'flex', flexDirection: 'column', zIndex: 1000, overflow: 'hidden'
    }}>
      <Box onMouseDown={startResizing} onTouchStart={startResizing} style={{ height: '32px', paddingTop: '12px', cursor: 'row-resize', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', touchAction: 'none' }}>
        <Box style={{ width: '40px', height: '5px', borderRadius: '10px', backgroundColor: 'rgba(128,128,128,0.4)' }} />
      </Box>

      <Box px="md" pb="md" style={{ borderBottom: sidebarHeight > snapPoints[0] + 10 ? '1px solid #373a40' : 'none', touchAction: 'none' }}>
        <div ref={titleOnlyRef}>
          <Title order={3} style={{ ...customTextStyle, color: 'white' }} mb={sidebarHeight > snapPoints[0] + 10 ? "xs" : 0}>
            思い出の場所一覧
          </Title>
        </div>
        
        <div className="fade-transition" style={{ opacity: sidebarHeight > snapPoints[0] + 10 ? 1 : 0, pointerEvents: sidebarHeight > snapPoints[0] + 10 ? 'all' : 'none', height: sidebarHeight > snapPoints[0] + 10 ? 'auto' : 0, overflow: 'hidden' }}>
          <Stack gap="xs">
            <TextInput placeholder="検索..." leftSection={<IconSearch size={14} />} value={searchTerm} onChange={(e) => setSearchTerm(e.currentTarget.value)} size="xs" />

            {/* 【Lv.2】詳細カードの解放 */}
            {useDetailCard && selectedMemory && (
              <div ref={cardRef} className="fade-transition">
                <Paper shadow="sm" p="md" withBorder className="glass-map-control" style={{ position: 'relative' }}>
                  <CloseButton onClick={handleReset} style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }} />
                  <Stack gap="xs">
                    <Box pr={30}>
                      <Text style={{ ...customTextStyle, color: 'white' }} fw={700}>{selectedMemory.name}</Text>
                      <Text size="xs" c="dimmed">{selectedMemory.location}</Text>
                      {userLocation && <Text size="xs" c="blue.5" fw={600} mt={4}>現在地から約 {calculateDistance(userLocation[0], userLocation[1], selectedMemory.latitude, selectedMemory.longitude).toFixed(1)} km</Text>}
                    </Box>
                    <Divider my="sm" label="ルートを検索" labelPosition="center" />
                    <Group grow gap="xs">
                      <Button size="xs" color="blue" leftSection={<IconCar size={14} />} onClick={() => {
                        const originParam = userLocation ? `&origin=${userLocation[0]},${userLocation[1]}` : '';
                        window.open(`https://www.google.com/maps/dir/?api=1${originParam}&destination=${selectedMemory.latitude},${selectedMemory.longitude}&travelmode=driving`, '_blank');
                      }}>車</Button>
                      <Button size="xs" color="teal" leftSection={<IconTrain size={14} />} onClick={() => {
                        const originParam = userLocation ? `&origin=${userLocation[0]},${userLocation[1]}` : '';
                        window.open(`https://www.google.com/maps/dir/?api=1${originParam}&destination=${selectedMemory.latitude},${selectedMemory.longitude}&travelmode=transit`, '_blank');
                      }}>電車</Button>
                    </Group>
                  </Stack>
                </Paper>
              </div>
            )}
          </Stack>
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
                    setFitPoints(userLocation ? [[f.latitude, f.longitude], userLocation] : [[f.latitude, f.longitude]]);
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Box>
                      {/* 【Lv.1】文字スタイル連動 */}
                      <Text style={{ ...customTextStyle, color: 'white' }} fw={500}>{f.name}</Text>
                      <Text c="dimmed" size="xs">{f.location}</Text>
                    </Box>
                    {/* 【Lv.1】ピン色連動 */}
                    <Box style={{ position: 'relative', width: 16, height: 16, flexShrink: 0 }}>
                      <IconMapPinFilled size={16} color={pinColor} style={{ position: 'absolute', top: 0, left: 0 }} />
                      <IconMapPinFilled size={16} color="url(#black-gradient)" style={{ position: 'absolute', top: 0, left: 0 }} />
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
  );
}