import { Alert, Anchor, Badge, Button, Group, Paper, Stack, Table, Text, Title } from "@mantine/core";
import { IconPlus, IconRefresh } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, listMonitors } from "../api";
import { StatusBadge } from "../components/StatusBadge";
import { ALERT_LABEL, formatDateTime } from "../format";
import type { MonitorSummary } from "../types";

export function Dashboard() {
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMonitors(await listMonitors());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack gap="md" maw={1100} mx="auto">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>ダッシュボード</Title>
          <Text c="dimmed" size="sm">
            モニターの状態、最終 ping、最終アラート
          </Text>
        </div>
        <Group>
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => void load()} loading={loading}>
            再読み込み
          </Button>
          <Button component={Link} to="/monitors/new" leftSection={<IconPlus size={16} />}>
            新規モニター
          </Button>
        </Group>
      </Group>

      {error && <Alert color="red">{error}</Alert>}

      <Paper withBorder radius="md">
        <Table.ScrollContainer minWidth={800}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>名前</Table.Th>
                <Table.Th>状態</Table.Th>
                <Table.Th>スケジュール</Table.Th>
                <Table.Th>最終 ping</Table.Th>
                <Table.Th>最終アラート</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {monitors.length === 0 && !loading ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="lg">
                      モニターはまだありません。新規作成するか、管理トークンを入力してください。
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                monitors.map((monitor) => (
                  <Table.Tr key={monitor.id}>
                    <Table.Td>
                      <Anchor component={Link} to={`/monitors/${monitor.id}`} fw={600}>
                        {monitor.name}
                      </Anchor>
                      {!monitor.enabled && (
                        <Badge ml="xs" size="sm" variant="outline" color="gray">
                          無効
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={monitor.displayStatus} />
                    </Table.Td>
                    <Table.Td>
                      <Text ff="monospace" size="sm" style={{ whiteSpace: "pre" }}>
                        {monitor.schedule}
                      </Text>
                    </Table.Td>
                    <Table.Td>{formatDateTime(monitor.lastPingAt)}</Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm">{formatDateTime(monitor.lastAlertAt)}</Text>
                        {monitor.lastAlertKind && (
                          <Text size="xs" c="dimmed">
                            {ALERT_LABEL[monitor.lastAlertKind] ?? monitor.lastAlertKind}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
