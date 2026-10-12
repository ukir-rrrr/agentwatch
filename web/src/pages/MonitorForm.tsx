import {
  Alert,
  Button,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, createMonitor, getMonitor, updateMonitor } from "../api";
import { getAdminToken } from "../storage";

type FormValues = {
  name: string;
  scheduleKind: "cron" | "period";
  cron: string;
  periodSeconds: number | string;
  graceSeconds: number | string;
  maxRuntimeSeconds: number | string;
  enabled: boolean;
};

export function MonitorForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    initialValues: {
      name: "",
      scheduleKind: "cron",
      cron: "0 */6 * * *",
      periodSeconds: 3600,
      graceSeconds: 300,
      maxRuntimeSeconds: 60,
      enabled: true,
    },
    validate: {
      name: (value) => (value.trim() ? null : "名前は必須です"),
      cron: (value, values) =>
        values.scheduleKind === "cron" && !value.trim() ? "cron 式は必須です" : null,
      periodSeconds: (value, values) =>
        values.scheduleKind === "period" && Number(value) <= 0 ? "周期は 1 秒以上です" : null,
      graceSeconds: (value) => (Number(value) < 0 ? "猶予は 0 秒以上です" : null),
      maxRuntimeSeconds: (value) => (Number(value) <= 0 ? "最大実行時間は 1 秒以上です" : null),
    },
  });

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const monitor = await getMonitor(id);
        form.setValues({
          name: monitor.name,
          scheduleKind: monitor.scheduleKind ?? (monitor.cron ? "cron" : "period"),
          cron: monitor.cron ?? "0 */6 * * *",
          periodSeconds: monitor.periodSeconds ?? 3600,
          graceSeconds: monitor.graceSeconds ?? 300,
          maxRuntimeSeconds: monitor.maxRuntimeSeconds ?? 60,
          enabled: monitor.enabled,
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    })();
    // form is stable enough; we only load once per id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(values: FormValues) {
    if (!getAdminToken()) {
      setError("管理トークンをヘッダーに入力してください。localStorage に保存されます。");
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      name: values.name.trim(),
      graceSeconds: Number(values.graceSeconds),
      maxRuntimeSeconds: Number(values.maxRuntimeSeconds),
      ...(values.scheduleKind === "cron"
        ? { cron: values.cron.trim() }
        : { periodSeconds: Number(values.periodSeconds) }),
      ...(isEdit ? { enabled: values.enabled } : {}),
    };
    try {
      const saved = isEdit && id ? await updateMonitor(id, body) : await createMonitor(body);
      notifications.show({
        color: "teal",
        message: isEdit ? "モニターを更新しました" : "モニターを作成しました",
      });
      navigate(`/monitors/${saved.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Text c="dimmed" ta="center">
        読み込み中…
      </Text>
    );
  }

  return (
    <Paper withBorder p="lg" maw={560} mx="auto" radius="md">
      <Title order={2} mb="xs">
        {isEdit ? "モニターを編集" : "モニターを作成"}
      </Title>
      <Text c="dimmed" size="sm" mb="md">
        cron 式は UTC です。管理トークンはブラウザの localStorage に保存されます。
      </Text>
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      <form onSubmit={form.onSubmit((values) => void onSubmit(values))}>
        <Stack>
          <TextInput label="名前" placeholder="supabase-keepalive" required {...form.getInputProps("name")} />
          <div>
            <Text size="sm" fw={500} mb={6}>
              スケジュール
            </Text>
            <SegmentedControl
              fullWidth
              data={[
                { label: "cron", value: "cron" },
                { label: "周期 (秒)", value: "period" },
              ]}
              {...form.getInputProps("scheduleKind")}
            />
          </div>
          {form.values.scheduleKind === "cron" ? (
            <TextInput
              label="cron 式"
              description="5 フィールド（分 時 日 月 曜日）UTC"
              placeholder="0 */6 * * *"
              {...form.getInputProps("cron")}
            />
          ) : (
            <NumberInput label="周期（秒）" min={1} {...form.getInputProps("periodSeconds")} />
          )}
          <NumberInput label="猶予（秒）" min={0} {...form.getInputProps("graceSeconds")} />
          <NumberInput label="最大実行時間（秒）" min={1} {...form.getInputProps("maxRuntimeSeconds")} />
          {isEdit && <Switch label="有効" {...form.getInputProps("enabled", { type: "checkbox" })} />}
          <Group justify="flex-end" mt="sm">
            <Button component={Link} to={id ? `/monitors/${id}` : "/"} variant="default">
              キャンセル
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? "更新" : "作成"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
