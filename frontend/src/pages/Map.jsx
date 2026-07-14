import React, { useState, useEffect, useMemo, useRef } from 'react';
import { renderToString } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Text, Group, Box, CloseButton, Modal } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../css/GlassStyle.css';
// 生徒用の編集ファイルの読み込み
import { pinColor, textSize, fontFamily } from '../lv1';
import { useSatellite } from '../lv2';
import { lv3PinId, lv3ImageURI, useServerImg } from '../lv3';
import { getApiBaseUrl } from '../App';

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
const DEFAULT_ZOOM_LEVEL = 12;
const FOCUS_ZOOM_LEVEL = 16;

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
  useEffect(() => { if (center) map.flyTo(center, DEFAULT_ZOOM_LEVEL, { duration: 2.5 }); }, [center, map]);
  return null;
}

// === 要素の中央に移動するコンポーネント ===
function MapBoundsHandler({ points, sidebarWidth, sidebarHeight, isMobile, selectedMemoryId }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    try {
      if (points.length === 1) {
        const currentZoom = map.getZoom();

        // ピンをクリックして選択した時だけ16（FOCUS_ZOOM_LEVEL）にズームし、初期表示は12（DEFAULT_ZOOM_LEVEL）を維持する
        const targetZoom = selectedMemoryId 
          ? (currentZoom < FOCUS_ZOOM_LEVEL ? FOCUS_ZOOM_LEVEL : currentZoom) 
          : DEFAULT_ZOOM_LEVEL;
        
        const offset = isMobile ? [0, -sidebarHeight / 3 + 30] : [sidebarWidth / 2, 30];
        const targetCenter = map.unproject(map.project(points[0], targetZoom).subtract(offset), targetZoom);
        map.flyTo(targetCenter, targetZoom, { animate: true, duration: 1.5 });
      } else {
        // ポイントが2つ以上の時は全体が収まるように自動調整
        const bounds = L.latLngBounds(points);
        const paddingOptions = isMobile 
          ? { paddingTopLeft: [40, 100], paddingBottomRight: [40, sidebarHeight + 40] }
          : { paddingTopLeft: [sidebarWidth + 40, 100], paddingBottomRight: [40, 40 ] };
        map.flyToBounds(bounds, { ...paddingOptions, animate: true, duration: 1.5, maxZoom: 15 });
      }
    } catch (e) { console.error(e); }
  }, [points, map, sidebarWidth, sidebarHeight, isMobile, selectedMemoryId]);
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
function Map({ searchTerm, isMobile, setSharedMemories, searchTargetId, setSearchTargetId }) {
  const [memories, setMemories] = useState(Array.isArray(MapData) ? MapData : []);
  const validMemories = useMemo(() => {
    // 1. まず座標があるデータだけに絞り込む。
    let filtered = memories.filter(f => f.latitude && f.longitude);

    // 2. データを整形する（DBの imageUrl を ImageURI に変換 ＆ ローカル画像で上書き）
    filtered = filtered.map(f => {
      let images = f.imageUrl;

      if (String(f.id) === String(lv3PinId) && lv3ImageURI) {
        images = lv3ImageURI;
      }

      return { ...f, ImageURI: images };
    });

    return filtered;
  }, [memories, lv3PinId, lv3ImageURI]);

  const [mapCenter, setMapCenter] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationActive, setIsLocationActive] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [fitPoints, setFitPoints] = useState(null);
  const [selectedMemoryId, setSelectedMemoryId] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [mapLayer, setMapLayer] = useState('normal'); // normal, satellite

  const [sidebarWidth, setSidebarWidth] = useState(350);
  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      let culculatedWidth = currentWidth * 0.35; 
      const finalWidth = Math.max(220, Math.min(350, culculatedWidth));
      setSidebarWidth(finalWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { ref: sidebarRef } = useElementSize();
  const { ref: titleOnlyRef, height: titleOnlyHeight } = useElementSize();
  
  const markerRefs = useRef({});

  // 【Lv.1】設定したテキストスタイルを一括管理
  const customTextStyle = {
    fontSize: `${textSize}px`,
    fontFamily: fontFamily
  };

  // バックエンドからデータを取得してピンを表示する処理
  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/sakaki-map/api/memories`);
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

  // 1. データが読み込まれたら App.jsx に共有する
  useEffect(() => {
    if (setSharedMemories) {
      setSharedMemories(validMemories);
    }
  }, [validMemories, setSharedMemories]);

  // 2. App.jsx の検索ドロップダウンから選ばれた時にピンを選択＆ズームする
  useEffect(() => {
    if (searchTargetId) {
      const target = validMemories.find(f => f.id === searchTargetId);
      if (target) {
        setSelectedMemoryId(searchTargetId);
        if (userLocation && isLocationActive) {
          setFitPoints([[target.latitude, target.longitude], userLocation]);
        } else {
          setFitPoints([[target.latitude, target.longitude]]);
        }
      }
      if (setSearchTargetId) setSearchTargetId(null); // 処理が終わったらリセット
    }
  }, [searchTargetId, validMemories, userLocation, isLocationActive, setSearchTargetId]);

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
    const midH = window.innerHeight * 0.40;
    const maxH = window.innerHeight * 0.85;
    return [minH, midH, maxH, maxH];
  }, [titleOnlyHeight, isMobile]);

  const [sidebarHeight, setSidebarHeight] = useState(window.innerHeight * 0.40);

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

  const handleReset = () => {
    setSelectedMemoryId(null);
    setMapCenter(null);
    setFitPoints(validMemories.map(f => [f.latitude, f.longitude]));
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
      setSidebarHeight(Math.max(60, Math.min(window.innerHeight - clientY, window.innerHeight * 0.85)));
    };
    const stopResizing = () => {
      if (!isResizing) return;
      setIsResizing(false);
      const MAX_HEIGHT = window.innerHeight * 0.85;
      const closest = snapPoints.reduce((prev, curr) =>
        (Math.abs(curr - sidebarHeight) < Math.abs(prev - sidebarHeight) ? curr : prev)
      );
      setSidebarHeight(Math.min(closest, MAX_HEIGHT));
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
    <div
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

      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
        {/* 画面上下の影（ビネット効果） */}
        <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%)', zIndex: 900, pointerEvents: 'none' }} />
        <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 100%)', zIndex: 900, pointerEvents: 'none' }} />

        <MapContainer center={INITIAL_CENTER} zoom={DEFAULT_ZOOM_LEVEL} zoomControl={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
          
          <TileLayer 
            attribution='© Google' 
            url={useSatellite ? layerUrl : "https://mt1.google.com/vt/lyrs=m&hl=ja&x={x}&y={y}&z={z}"} 
          />
          
          <div 
            className={!isResizing ? 'controls-transition' : ''} 
            style={{
              position: 'absolute',
              bottom: isMobile ? (Math.min(sidebarHeight, snapPoints[1]) + 20) : 20,
              right: 20,
              zIndex: 1000
            }}
          >
            <MapControl isLocationActive={isLocationActive} isLocating={isLocating} handleCurrentLocation={handleCurrentLocation} mapLayer={mapLayer} setMapLayer={setMapLayer} />
          </div>

          <MapRecenter center={mapCenter} />
          <MapBoundsHandler points={fitPoints} sidebarWidth={sidebarWidth} sidebarHeight={sidebarHeight} isMobile={isMobile} selectedMemoryId={selectedMemoryId} />
          <ResizeMap sidebarHeight={sidebarHeight} isResizing={isResizing} />

          {validMemories.map(f => (
            <Marker 
              key={f.id} position={[f.latitude, f.longitude]} 
              icon={customPinIcon}
              ref={el => (markerRefs.current[f.id] = el)}
              eventHandlers={{ 
                mouseover: (e) => e.target.openPopup(),
                mouseout: (e) => { if (selectedMemoryId !== f.id) e.target.closePopup(); },
                click: (e) => { 
                  setSelectedMemoryId(f.id);
                  if (userLocation && isLocationActive) {
                    setFitPoints([[f.latitude, f.longitude], userLocation]);
                  } else {
                    setFitPoints([[f.latitude, f.longitude]]);
                  }
                }
              }}
            >
            </Marker>
          ))}
          {userLocation && isLocationActive && <Marker position={userLocation} icon={userIcon} />}
        
        </MapContainer>
      </div>


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
        selectedMemory={selectedMemory}
        handleReset={handleReset}
        userLocation={userLocation}
        selectedMemoryId={selectedMemoryId}
        filteredMemories={validMemories}
        setSelectedMemoryId={setSelectedMemoryId}
        setFitPoints={setFitPoints}
        isLocationActive={isLocationActive}
      />
    </div>
  );
}

export default Map;