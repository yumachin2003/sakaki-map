import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Text, Button, Group, Paper, Title, List, ScrollArea, TextInput, Stack, Divider, Box, CloseButton, ActionIcon } from '@mantine/core';
import { useMediaQuery, useElementSize } from '@mantine/hooks';
import { IconCurrentLocation, IconMapPin, IconSearch, IconCar, IconTrain, IconPlus, IconMinus, IconUpload } from '@tabler/icons-react';
import L from 'leaflet';
import { MapData } from '../seed/MapData';
import 'leaflet/dist/leaflet.css';
import '../css/GlassStyle.css';
import { textColor, pinColor, textSize, fontFamily } from '../lv1';
import { useSatellite, useCurrentButton, useDetailCard, useUploadPage } from '../lv2';

// 初期位置（坂城町付近に変更）
const INITIAL_CENTER = [36.4632, 138.1834];

// 【Lv.1】設定したpinColorを反映するカスタムピン
const customPinIcon = L.divIcon({
  className: 'custom-pin',
  html: `<div style="background-color: ${pinColor}; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.5);"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

const userIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<div class="pulse"></div><div class="dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

// --- サブコンポーネント ---
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 14, { duration: 2.5 }); }, [center, map]);
  return null;
}

function MapBoundsHandler({ points, sidebarWidth, sidebarHeight, isMobile }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    try {
      const bounds = L.latLngBounds(points);
      const paddingOptions = isMobile 
        ? { paddingTopLeft: [40, 100], paddingBottomRight: [40, sidebarHeight + 40] }
        : { paddingTopLeft: [sidebarWidth + 40, 100], paddingBottomRight: [40, 40 ] };
      map.flyToBounds(bounds, { ...paddingOptions, animate: true, duration: 1.5, maxZoom: 15 });
    } catch (e) { console.error(e); }
  }, [points, map, sidebarWidth, sidebarHeight, isMobile]);
  return null;
}

function ResizeMap({ sidebarHeight, isResizing }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (!isResizing) {
      const timer = setTimeout(() => map.invalidateSize(), 300);
      return () => clearTimeout(timer);
    }
  }, [sidebarHeight, isResizing, map]);
  return null;
}

function MapControls({ handleCurrentLocation, hasUserLocation }) {
  const map = useMap();
  return (
    <Stack gap="xs">
      <Paper className="glass-map-control" style={{ display: 'flex', flexDirection: 'column' }}>
        <ActionIcon onClick={() => map.zoomIn()} size="lg" variant="subtle" style={{ borderRadius: 0, borderBottom: '1px solid rgba(128,128,128,0.2)' }} color="gray"><IconPlus size={18} /></ActionIcon>
        <ActionIcon onClick={() => map.zoomOut()} size="lg" variant="subtle" style={{ borderRadius: 0 }} color="gray"><IconMinus size={18} /></ActionIcon>
      </Paper>
      
      {/* 【Lv.2】現在地ボタンの表示切り替え */}
      {useCurrentButton && (
        <Paper className="glass-map-control">
          <ActionIcon onClick={handleCurrentLocation} size="lg" variant={hasUserLocation ? "filled" : "subtle"} color={hasUserLocation ? "blue" : "gray"}>
            <IconCurrentLocation size={18} />
          </ActionIcon>
        </Paper>
      )}
    </Stack>
  );
}

// --- ユーティリティ関数 ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// --- メインコンポーネント ---
function Map() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const memories = MapData; // さかきマップ用に変数を読み替え
  const validMemories = useMemo(() => memories.filter(f => f.latitude && f.longitude), [memories]);

  const [mapCenter, setMapCenter] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [fitPoints, setFitPoints] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth] = useState(350);

  const { ref: sidebarRef } = useElementSize();
  const { ref: titleOnlyRef, height: titleOnlyHeight } = useElementSize();
  const { ref: cardRef, height: cardHeight } = useElementSize();
  
  const markerRefs = useRef({});

  // 【Lv.1】設定したテキストスタイルを一括管理
  const customTextStyle = {
    color: textColor,
    fontSize: `${textSize}px`,
    fontFamily: fontFamily
  };

  const filteredMemories = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return validMemories.filter(f => f.name?.toLowerCase().includes(q) || f.location?.toLowerCase().includes(q));
  }, [validMemories, searchTerm]);

  const selectedMemory = useMemo(() => 
    validMemories.find(f => f.id === selectedMemoryId), 
  [validMemories, selectedMemoryId]);

  const snapPoints = useMemo(() => {
    const handleH = 32; 
    const minH = titleOnlyHeight + handleH + 16;
    const selectedH = (selectedMemoryId ? titleOnlyHeight + handleH + cardHeight + 68 : 0);
    const midH = titleOnlyHeight + handleH + (isMobile ? 120 : 400);
    const maxH = window.innerHeight * 0.92;
    return [minH, selectedH, midH, maxH];
  }, [titleOnlyHeight, cardHeight, selectedMemoryId, isMobile]);

  const [sidebarHeight, setSidebarHeight] = useState(window.innerHeight * 0.45);

  useEffect(() => {
    if (validMemories.length > 0 && !fitPoints && !selectedMemoryId) {
      setFitPoints(validMemories.map(f => [f.latitude, f.longitude]));
    }
  }, [validMemories, fitPoints, selectedMemoryId]);

  useEffect(() => {
    if (titleOnlyHeight > 0 && sidebarHeight === window.innerHeight * 0.45) {
      setSidebarHeight(snapPoints[2]);
    }
  }, [titleOnlyHeight, snapPoints, sidebarHeight]);

  useEffect(() => {
    if (selectedMemoryId) {
      const targetMidH = snapPoints[1];
      if (sidebarHeight < targetMidH) setSidebarHeight(targetMidH);
    }
  }, [selectedMemoryId, snapPoints]);

  useEffect(() => {
    if (selectedMemoryId && markerRefs.current[selectedMemoryId]) {
      Object.keys(markerRefs.current).forEach(id => {
        if (parseInt(id, 10) !== selectedMemoryId) markerRefs.current[id]?.closePopup();
      });
      markerRefs.current[selectedMemoryId].openPopup();
    }
  }, [selectedMemoryId, filteredMemories]);

  const handleReset = () => {
    setSelectedMemoryId(null);
    setMapCenter(null);
    setFitPoints(validMemories.map(f => [f.latitude, f.longitude]));
    validMemories.forEach(f => markerRefs.current[f.id]?.closePopup());
  };

  const handleCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(p => {
      const loc = [p.coords.latitude, p.coords.longitude];
      setUserLocation(loc);
      setFitPoints([...validMemories.map(f => [f.latitude, f.longitude]), loc]);
    });
  };

  const startResizing = (e) => { e.preventDefault(); setIsResizing(true); };

  useEffect(() => {
    const handleMove = (e) => {
      if (!isResizing) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setSidebarHeight(Math.max(60, Math.min(window.innerHeight - clientY, window.innerHeight * 0.95)));
    };
    const stopResizing = () => {
      if (!isResizing) return;
      setIsResizing(false);
      const closest = snapPoints.reduce((prev, curr) => 
        (Math.abs(curr - sidebarHeight) < Math.abs(prev - sidebarHeight) ? curr : prev)
      );
      setSidebarHeight(closest);
    };
    if (isResizing) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', stopResizing);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', stopResizing);
    };
  }, [isResizing, sidebarHeight, snapPoints]);

  return (
    <Box 
      className="festival-map-container" 
      style={{ 
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        backgroundColor: '#1A1B1E', touchAction: 'none'
      }}
    >
      <style>
        {`
          body { overflow: hidden; position: fixed; width: 100%; }
          .user-location-marker .dot { width: 12px; height: 12px; background-color: #228be6; border: 2px solid white; border-radius: 50%; position: absolute; top: 4px; left: 4px; z-index: 2; }
          .user-location-marker .pulse { width: 20px; height: 20px; background-color: rgba(34, 139, 230, 0.6); border-radius: 50%; position: absolute; top: 0; left: 0; animation: pulse-animation 2s infinite; }
          @keyframes pulse-animation { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
          .leaflet-popup-close-button { display: none !important; }
          .sidebar-transition { transition: height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
          .controls-transition { transition: bottom 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
          .fade-transition { transition: opacity 0.2s ease, transform 0.2s ease; }
          .leaflet-container { z-index: 1 !important; height: 100% !important; width: 100% !important; }
        `}
      </style>

      <Box style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
        <MapContainer center={INITIAL_CENTER} zoom={13} zoomControl={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
          
          {/* 【Lv.2】航空写真の切り替え */}
          <TileLayer 
            attribution='© Google' 
            url={useSatellite 
              ? "https://mt1.google.com/vt/lyrs=s&hl=ja&x={x}&y={y}&z={z}" 
              : "https://mt1.google.com/vt/lyrs=y&hl=ja&x={x}&y={y}&z={z}"
            } 
          />
          
          <div className={!isResizing ? 'controls-transition' : ''} style={{ position: 'absolute', bottom: isMobile ? (sidebarHeight + 20) : 20, right: 20, zIndex: 1000 }}>
            <MapControls hasUserLocation={!!userLocation} handleCurrentLocation={handleCurrentLocation} />
          </div>

          <MapRecenter center={mapCenter} />
          <MapBoundsHandler points={fitPoints} sidebarWidth={sidebarWidth} sidebarHeight={sidebarHeight} isMobile={isMobile} />
          <ResizeMap sidebarHeight={sidebarHeight} isResizing={isResizing} />

          {filteredMemories.map(f => (
            <Marker 
              key={f.id} position={[f.latitude, f.longitude]} 
              icon={customPinIcon} // 【Lv.1】色連動アイコン
              ref={el => (markerRefs.current[f.id] = el)}
              eventHandlers={{ 
                mouseover: (e) => e.target.openPopup(),
                mouseout: (e) => { if (selectedMemoryId !== f.id) e.target.closePopup(); },
                click: (e) => { 
                  setSelectedMemoryId(f.id); 
                  const map = e.target._map;
                  const offset = isMobile ? [0, -sidebarHeight / 3 + 30] : [sidebarWidth / 2, 30];
                  const targetCenter = map.unproject(map.project([f.latitude, f.longitude], 14).subtract(offset), 14);
                  map.flyTo(targetCenter, 14, { animate: true, duration: 2.0 });
                }
              }}
            >
              <Popup closeOnClick={false} autoClose={false}>
                <Box style={{ minWidth: '140px' }}>
                  <Group justify="space-between" wrap="nowrap" mb={4}>
                    {/* 【Lv.1】文字スタイル連動 */}
                    <Text style={customTextStyle} fw={700}>{f.name}</Text>
                    <CloseButton size="xs" onClick={(e) => { e.stopPropagation(); handleReset(); }} />
                  </Group>
                </Box>
              </Popup>
            </Marker>
          ))}
          {userLocation && <Marker position={userLocation} icon={userIcon}><Popup>現在地</Popup></Marker>}
        </MapContainer>
      </Box>

      {/* サイドバー本体（スマホ対応の動きを維持） */}
      <Box ref={sidebarRef} className={`glass-sidebar ${!isResizing ? 'sidebar-transition' : ''}`} style={{
        position: 'absolute', bottom: '0', 
        left: isMobile ? '10px' : '20px', right: isMobile ? '10px' : 'auto',
        width: isMobile ? 'auto' : `${sidebarWidth}px`, height: `${sidebarHeight}px`,
        borderRadius: '12px 12px 0 0', touchAction: 'none',
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
              
              {/* 【Lv.2】隠しアップロードページの解放 */}
              {useUploadPage && (
                 <Button color="cyan" leftSection={<IconUpload size={18} />} fullWidth onClick={() => alert('送信モーダルを開く（Lv.4の実装）')}>
                   データを母艦へ送信🚀
                 </Button>
              )}

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
              {filteredMemories.map(f => (
                <List.Item
                  key={f.id}
                  style={{ 
                    cursor: 'pointer', padding: '12px 16px', borderRadius: '0 8px 8px 0',
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
                    <IconMapPin size={16} style={{ color: pinColor, flexShrink: 0 }} />
                  </Group>
                </List.Item>
              ))}
            </List>
          </Stack>
        </ScrollArea>
      </Box>
    </Box>
  );
}

export default Map;