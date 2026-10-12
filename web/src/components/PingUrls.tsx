import { ActionIcon, CopyButton, Group, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";

type PingUrlsProps = {
  urls?: {
    start: string;
    success: string;
    fail: string;
  };
};

function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <TextInput
      label={label}
      value={value}
      readOnly
      rightSection={
        <CopyButton value={value} timeout={1500}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? "コピーしました" : "コピー"} withArrow>
              <ActionIcon variant="subtle" color={copied ? "teal" : "gray"} onClick={copy} aria-label={`${label}をコピー`}>
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      }
    />
  );
}

export function PingUrls({ urls }: PingUrlsProps) {
  if (!urls) {
    return (
      <Text size="sm" c="dimmed">
        ping URL を表示するには、ヘッダーに管理トークンを入力してください。
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600}>ping URL</Text>
      </Group>
      <UrlRow label="開始 (start)" value={urls.start} />
      <UrlRow label="成功 (success)" value={urls.success} />
      <UrlRow label="失敗 (fail)" value={urls.fail} />
    </Stack>
  );
}
