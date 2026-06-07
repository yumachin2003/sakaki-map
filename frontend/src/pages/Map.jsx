import React, { useState, useEffect, useMemo, useRef } from 'react';
import { renderToString } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Text, Group, Box, CloseButton } from '@mantine/core';
import { useMediaQuery, useElementSize } from '@mantine/hooks';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../css/GlassStyle.css';
// 生徒用の編集ファイルの読み込み
import { pinColor, textColor, textSize, fontFamily } from '../lv1';
import { useSatellite } from '../lv2';
import MapControl from '../components/MapControl';
import SideBar from '../components/SideBar';
const seedModules = import.meta.glob('../seed/MapData.*', { eager: true });
const moduleKey = Object.keys(seedModules)[0];
const MapData = moduleKey ? seedModules[moduleKey].MapData || [] : [];

// 初期位置（全地点の中央を計算）
const calculateCenter = (data) => {
  if (!data || !Array.isArray(data)) return [36.4632, 138.1450];
  const validData = data.filter(d => d.latitude && d.longitude);
  if (validData.length === 0) return [36.4632, 138.1450]; // データがない場合のデフォルト
  const lats = validData.map(d => d.latitude);
  const lngs = validData.map(d => d.longitude);
  const midLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const midLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
  return [midLat, midLng];
};
const INITIAL_CENTER = calculateCenter(MapData);

// 【Lv.1】設定したpinColorを反映するカスタムピン
const customPinIcon = L.divIcon({
  className: 'custom-pin',
  html: renderToString(
    <div style={{ 
      position: 'relative', width: '32px', height: '32px',
      filter: 'drop-shadow(1px 1px 0 white) drop-shadow(-1px -1px 0 white) drop-shadow(-1px 1px 0 white) drop-shadow(1px -1px 0 white) drop-shadow(0px 3px 4px rgba(0,0,0,0.4))'
    }}>
      <svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* ピンのベース形状（水滴型） */}
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={pinColor} />
        {/* 立体感を出すグラデーション */}
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="url(#black-gradient)" />
        {/* 中央の白い丸 */}
        <circle cx="12" cy="9" r="3.5" fill="white" />
      </svg>
    </div>
  ),
  iconSize: [32, 32],
  iconAnchor: [16, 30], // SVGの先端がピタッと座標を指すようにアンカーを調整
  popupAnchor: [0, -30],
});

const userIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<div class="pulse"></div><div class="dot"></div>',
  iconSize: [20, 20],
  popupAnchor: [0, -10]
});

// === マップ移動コンポーネント ===
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 14, { duration: 2.5 }); }, [center, map]);
  return null;
}

// === 要素の中央に移動するコンポーネント ===
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

// === メインコンポーネント ===
function Map() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [memories, setMemories] = useState(Array.isArray(MapData) ? MapData : []);
  const validMemories = useMemo(() => memories.filter(f => f.latitude && f.longitude), [memories]);

  const [mapCenter, setMapCenter] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationActive, setIsLocationActive] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [fitPoints, setFitPoints] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [mapLayer, setMapLayer] = useState('normal'); // normal, satellite
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

  // バックエンドからデータを取得してピンを表示する処理
  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const response = await fetch('/api/memories');
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            setMemories(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch memories:', error);
      }
    };
    
    fetchMemories(); // 初期読み込み

    // 他の画面（アップロード画面）から送信が完了した合図を受け取ったら再フェッチする
    window.addEventListener('memoriesUpdated', fetchMemories);
    return () => window.removeEventListener('memoriesUpdated', fetchMemories);
  }, []);

  const filteredMemories = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return validMemories.filter(f => f.name?.toLowerCase().includes(q) || f.location?.toLowerCase().includes(q));
  }, [validMemories, searchTerm]);

  const selectedMemory = useMemo(() => 
    validMemories.find(f => f.id === selectedMemoryId), 
  [validMemories, selectedMemoryId]);

  const layerUrl = useMemo(() => {
    if (mapLayer === 'satellite') return "https://mt1.google.com/vt/lyrs=y&hl=ja&x={x}&y={y}&z={z}";
    return "https://mt1.google.com/vt/lyrs=m&hl=ja&x={x}&y={y}&z={z}";
  }, [mapLayer]);

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
    setIsLocationActive(false);
  };

  const handleCurrentLocation = () => {
    if (isLocationActive) {
      // すでに現在地にズームしている場合は、解除して全体表示に戻す
      setIsLocationActive(false);
      setFitPoints(validMemories.map(f => [f.latitude, f.longitude]));
    } else {
      // それ以外（初めて押す or 解除後に再度押す）の場合は、必ず最新の現在地を再取得する
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        p => {
          const loc = [p.coords.latitude, p.coords.longitude];
          setUserLocation(loc);
          setIsLocationActive(true);
          setFitPoints([...validMemories.map(f => [f.latitude, f.longitude]), loc]);
          setIsLocating(false);
        },
        error => {
          console.error(error);
          let errorMessage = '現在地の取得に失敗しました。';
          switch (error.code) {
            case 1: // PERMISSION_DENIED
              errorMessage = '位置情報の利用が許可されていません。端末やブラウザの設定を確認してください。';
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage = '位置情報が取得できませんでした。電波状況の良い場所に移動するか、Wi-Fiをオンにしてみてください。';
              break;
            case 3: // TIMEOUT
              errorMessage = '現在地の取得がタイムアウトしました。電波状況の良い場所で再度お試しください。';
              break;
            default:
              errorMessage = '不明なエラーが発生しました。';
              break;
          }
          alert(errorMessage);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
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
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        backgroundColor: '#1A1B1E', touchAction: 'none'
      }}
    >
      {/* アイコン用のグラデーション定義 */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="black-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.2)" />
          </linearGradient>
        </defs>
      </svg>

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
        {/* 画面上下の影（ビネット効果） */}
        <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%)', zIndex: 900, pointerEvents: 'none' }} />
        <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 100%)', zIndex: 900, pointerEvents: 'none' }} />

        <MapContainer center={INITIAL_CENTER} zoom={13} zoomControl={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
          
          <TileLayer 
            attribution='© Google' 
            url={useSatellite ? layerUrl : "https://mt1.google.com/vt/lyrs=m&hl=ja&x={x}&y={y}&z={z}"} 
          />
          
          <div className={!isResizing ? 'controls-transition' : ''} style={{ position: 'absolute', bottom: isMobile ? (sidebarHeight + 20) : 20, right: 20, zIndex: 1000 }}>
            <MapControl isLocationActive={isLocationActive} isLocating={isLocating} handleCurrentLocation={handleCurrentLocation} mapLayer={mapLayer} setMapLayer={setMapLayer} />
          </div>

          <MapRecenter center={mapCenter} />
          <MapBoundsHandler points={fitPoints} sidebarWidth={sidebarWidth} sidebarHeight={sidebarHeight} isMobile={isMobile} />
          <ResizeMap sidebarHeight={sidebarHeight} isResizing={isResizing} />

          {filteredMemories.map(f => (
            <Marker 
              key={f.id} position={[f.latitude, f.longitude]} 
              icon={customPinIcon}
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

      <SideBar
        sidebarRef={sidebarRef}
        isResizing={isResizing}
        sidebarHeight={sidebarHeight}
        isMobile={isMobile}
        sidebarWidth={sidebarWidth}
        startResizing={startResizing}
        snapPoints={snapPoints}
        titleOnlyRef={titleOnlyRef}
        customTextStyle={customTextStyle}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedMemory={selectedMemory}
        cardRef={cardRef}
        handleReset={handleReset}
        userLocation={userLocation}
        selectedMemoryId={selectedMemoryId}
        filteredMemories={filteredMemories}
        setSelectedMemoryId={setSelectedMemoryId}
        setFitPoints={setFitPoints}
      />
    </Box>
  );
}

export default Map;