import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, deleteMonitor, getMonitor } from "../api";
import { PingUrls } from "../components/PingUrls";
import { StatusBadge } from "../components/StatusBadge";
import { ALERT_LABEL, formatDateTime, PING_LABEL } from "../format";
import type { MonitorSummary } from "../types";

export function MonitorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState<MonitorSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setMonitor(await getMonitor(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "読み込みに失敗しました");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteMonitor(id);
      notifications.show({ color: "teal", message: "モニターを削除しました" });
      navigate("/");
    } catch (err) {
      notifications.show({
        color: "red",
        message: err instanceof ApiError ? err.message : "削除に失敗しました",
      });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (error) {
    return (
      <Stack maw={800} mx="auto">
        <Alert color="red">{error}</Alert>
        <Button component={Link} to="/" variant="default">
          ダッシュボードへ
        </Button>
      </Stack>
    );
  }

  if (!monitor) {
    return (
      <Text c="dimmed" ta="center">
        読み込み中…
      </Text>
    );
  }

  return (
    <Stack gap="md" maw={860} mx="auto">
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="sm">
            <Title order={2}>{monitor.name}</Title>
            <StatusBadge status={monitor.displayStatus} />
            {!monitor.enabled && (
              <Badge variant="outline" color="gray">
                無効
              </Badge>
            )}
          </Group>
          <Text c="dimmed" size="sm" mt={4} ff="monospace">
            {monitor.schedule}
          </Text>
        </div>
        <Group>
          <Button component={Link} to={`/monitors/${monitor.id}/edit`} variant="default" leftSection={<IconPencil size={16} />}>
            編集
          </Button>
          <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={() => setConfirmDelete(true)}>
            削除
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed">
            最終 ping
          </Text>
          <Text fw={600}>{formatDateTime(monitor.lastPingAt)}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed">
            最終アラート
          </Text>
          <Text fw={600}>{formatDateTime(monitor.lastAlertAt)}</Text>
          {monitor.lastAlertKind && (
            <Text size="sm" c="dimmed">
              {ALERT_LABEL[monitor.lastAlertKind] ?? monitor.lastAlertKind}
            </Text>
          )}
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed">
            猶予 / 最大実行時間
          </Text>
          <Text fw={600}>
            {monitor.graceSeconds ?? "—"} 秒 / {monitor.maxRuntimeSeconds ?? "—"} 秒
          </Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed">
            最終 start / success / fail
          </Text>
          <Text size="sm">start {formatDateTime(monitor.lastStartAt)}</Text>
          <Text size="sm">success {formatDateTime(monitor.lastSuccessAt)}</Text>
          <Text size="sm">fail {formatDateTime(monitor.lastFailAt)}</Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md">
        <PingUrls urls={monitor.urls} />
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">
          最近の ping
        </Title>
        {monitor.recentPings && monitor.recentPings.length > 0 ? (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>時刻</Table.Th>
                <Table.Th>種別</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {monitor.recentPings.map((ping) => (
                <Table.Tr key={ping.id}>
                  <Table.Td>{formatDateTime(ping.at)}</Table.Td>
                  <Table.Td>{PING_LABEL[ping.action]}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed" size="sm">
            {monitor.urls
              ? "まだ ping はありません。"
              : "履歴を見るには管理トークンを入力してください。"}
          </Text>
        )}
      </Paper>

      <Modal opened={confirmDelete} onClose={() => setConfirmDelete(false)} title="モニターを削除">
        <Text mb="md">{monitor.name} を削除します。この操作は取り消せません。</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmDelete(false)}>
            キャンセル
          </Button>
          <Button color="red" loading={deleting} onClick={() => void onDelete()}>
            削除する
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
