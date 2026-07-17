import React, { useState, useEffect } from 'react';
import { Popover, ActionIcon, Text, Box } from '@mantine/core';
import { IconHelpCircle, IconX } from '@tabler/icons-react';

export default function CodeHelp({ text, videoSrc, forceOpen }) {
  const [hovered, setHovered] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!forceOpen && !hovered) {
      setIsDismissed(false);
    }
  }, [forceOpen, hovered]);

  return (
    <Popover 
      width={320} 
      shadow="md" 
      withArrow 
      position="right" 
      zIndex={10020} 
      classNames={{ dropdown: 'glass-tooltip' }}
      transitionProps={{ 
        transition: {
          in: { opacity: 1, transform: 'scaleX(1)' },
          out: { opacity: 0, transform: 'scaleX(0.3)' },
          transitionProperty: 'opacity, transform'
        }, 
        duration: 200, 
        timingFunction: 'ease-out' 
      }}
      styles={{ dropdown: { transformOrigin: 'left center', pointerEvents: 'auto' } }}
      opened={!isDismissed && (forceOpen || hovered)}
    >
      <Popover.Target>
        <ActionIcon 
          variant="transparent" 
          size="sm" 
          color="gray" 
          style={{ cursor: 'help' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <IconHelpCircle size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Box style={{ position: 'relative' }}>
          <ActionIcon 
            size="xs" 
            variant="transparent" 
            color="gray" 
            onClick={(e) => { e.stopPropagation(); setIsDismissed(true); }}
            onMouseDown={(e) => e.preventDefault()}
            style={{ position: 'absolute', top: 0, right: 0, zIndex: 10, background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }}
          >
            <IconX size={12} />
          </ActionIcon>
          {videoSrc && (
            <video 
              src={videoSrc} 
              autoPlay 
              loop 
              muted 
              playsInline 
              style={{ width: '100%', borderRadius: '4px', marginBottom: '8px' }} 
            />
          )}
          <Box pt={videoSrc ? 0 : 16}>
            <Text size="xs" dangerouslySetInnerHTML={{ __html: text }} />
          </Box>
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}

