import React from 'react';
import {
  Badge,
  Card,
  Group,
  Progress,
  RingProgress,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconBolt, IconClockPause } from '@tabler/icons-react';

export interface TimerProps {
  durationMs: number;
  remainingMs: number;
  isPaused?: boolean;
  label?: string;
}

export function Timer({
  durationMs,
  remainingMs,
  isPaused = false,
  label = 'Pozostały czas',
}: TimerProps) {
  const progress = durationMs > 0 ? Math.max(0, Math.min(100, (remainingMs / durationMs) * 100)) : 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const statusTone = isPaused ? 'gray' : progress > 50 ? 'teal' : progress > 20 ? 'yellow' : 'red';
  const statusLabel = isPaused ? 'Pauza' : progress > 0 ? 'Aktywny' : 'Koniec czasu';

  return (
    <Card
      aria-live="polite"
      aria-label={label}
      data-paused={isPaused}
      padding="lg"
      radius="xl"
      shadow="lg"
      withBorder
      style={{
        background:
          'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 45%, rgba(79,70,229,0.92) 100%)',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon
            size={48}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'violet', to: 'cyan', deg: 135 }}
            aria-hidden="true"
          >
            {isPaused ? <IconClockPause size={24} /> : <IconBolt size={24} />}
          </ThemeIcon>

          <Stack gap={2}>
            <Text c="dimmed" tt="uppercase" fw={700} size="xs" style={{ letterSpacing: '0.08em' }}>
              Sesja quizu
            </Text>
            <Text c="white" fw={800} size="xl">
              {label}
            </Text>
            <Text c="rgba(255,255,255,0.72)" size="sm">
              Licznik reaguje w czasie rzeczywistym i podkreśla presję odpowiedzi.
            </Text>
          </Stack>
        </Group>

        <Badge color={statusTone} variant="light" radius="xl" size="lg">
          {statusLabel}
        </Badge>
      </Group>

      <Group justify="space-between" align="center" mt="lg" wrap="nowrap">
        <Stack gap={2}>
          <Text c="rgba(255,255,255,0.72)" size="sm">
            Do końca pytania
          </Text>
          <Text c="white" fw={900} size="2.4rem" lh={1}>
            {seconds}s
          </Text>
        </Stack>

        <RingProgress
          size={104}
          thickness={10}
          roundCaps
          sections={[{ value: progress, color: statusTone }]}
          rootColor="rgba(255,255,255,0.12)"
          label={
            <Text c="white" ta="center" fw={800} size="sm">
              {Math.round(progress)}%
            </Text>
          }
        />
      </Group>

      <Stack gap={8} mt="lg">
        <Group justify="space-between">
          <Text c="rgba(255,255,255,0.72)" size="sm">
            Pasek postępu
          </Text>
          <Text c="white" fw={700} size="sm">
            {Math.max(0, remainingMs)} ms
          </Text>
        </Group>

        <Progress
          value={progress}
          size="xl"
          radius="xl"
          color={statusTone}
          striped={!isPaused && progress > 0}
          animated={!isPaused && progress > 0}
        />
      </Stack>
    </Card>
  );
}

export default Timer;
