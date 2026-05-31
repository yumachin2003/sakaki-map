import React, { useRef, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { Stack, Box, ActionIcon } from '@mantine/core';
import { IconPlus, IconMinus, IconMap, IconWorld, IconCurrentLocation } from '@tabler/icons-react';
import L from 'leaflet';
import { useSatellite, useCurrentButton } from '../lv2';

export default function MapControl({ handleCurrentLocation, isLocationActive, mapLayer, setMapLayer, isLocating }) {
  const map = useMap();
  const controlRef = useRef(null);

  useEffect(() => {
    if (controlRef.current) {
      // コントロール部分でのクリックやダブルクリックが、背後の地図に貫通するのを防ぐ
      L.DomEvent.disableClickPropagation(controlRef.current);
    }
  }, []);

  const toggleLayer = () => {
    if (mapLayer === 'normal') setMapLayer('satellite');
    else setMapLayer('normal');
  };

  const controlBoxStyle = { overflow: 'hidden', borderRadius: '15px' };

  return (
    <Stack gap="xs" ref={controlRef}>
      <Box className="glass-sidebar" style={{ ...controlBoxStyle, display: 'flex', flexDirection: 'column' }}>
        <ActionIcon bg="transparent" onClick={() => map.zoomIn()} size="lg" variant="transparent" style={{ borderRadius: 0, borderBottom: '1px solid rgba(255,255,255,0.15)' }} color="gray"><IconPlus size={18} /></ActionIcon>
        <ActionIcon bg="transparent" onClick={() => map.zoomOut()} size="lg" variant="transparent" style={{ borderRadius: 0 }} color="gray"><IconMinus size={18} /></ActionIcon>
      </Box>
      
      {/* レイヤー切り替えボタン */}
      {useSatellite && (
        <Box className="glass-sidebar" style={controlBoxStyle}>
          <ActionIcon bg="transparent" onClick={toggleLayer} size="lg" variant="transparent" color="gray">
            {mapLayer === 'satellite' ? <IconMap size={18} /> : <IconWorld size={18} />}
          </ActionIcon>
        </Box>
      )}
      
      {/* 現在地ボタン */}
      {useCurrentButton && (
        <Box className="glass-sidebar" style={controlBoxStyle}>
          <ActionIcon bg={isLocationActive ? "rgba(34, 139, 230, 0.2)" : "transparent"} loading={isLocating} onClick={handleCurrentLocation} size="lg" variant="transparent" color={isLocationActive ? "blue" : "gray"}>
            <IconCurrentLocation size={18} />
          </ActionIcon>
        </Box>
      )}
    </Stack>
  );
}