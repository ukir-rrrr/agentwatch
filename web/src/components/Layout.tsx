import {
  ActionIcon,
  AppShell,
  Button,
  Group,
  PasswordInput,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconHeartbeat, IconMoon, IconPlus, IconSun } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { getAdminToken, setAdminToken } from "../storage";

export function Layout() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light");
  const [token, setToken] = useState("");

  useEffect(() => {
    setToken(getAdminToken());
  }, []);

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="sm">
          <Button
            component={Link}
            to="/"
            variant="subtle"
            color="teal"
            leftSection={<IconHeartbeat size={22} />}
            px="xs"
          >
            <Text fw={700} size="lg">
              agentwatch
            </Text>
          </Button>
          <Group wrap="nowrap" gap="sm" style={{ flex: 1, justifyContent: "flex-end" }}>
            <PasswordInput
              placeholder="管理トークン"
              value={token}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setToken(value);
                setAdminToken(value);
              }}
              w={{ base: 140, sm: 220 }}
              size="sm"
              aria-label="管理トークン"
            />
            <Button component={Link} to="/monitors/new" leftSection={<IconPlus size={16} />} size="sm">
              新規モニター
            </Button>
            <Tooltip label={computed === "dark" ? "ライトモード" : "ダークモード"}>
              <ActionIcon
                variant="default"
                size="lg"
                aria-label="配色を切り替え"
                onClick={() => setColorScheme(computed === "dark" ? "light" : "dark")}
              >
                {computed === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
