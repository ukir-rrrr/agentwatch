import { Badge } from "@mantine/core";
import { STATUS_LABEL } from "../format";
import type { DisplayStatus } from "../types";

const COLOR: Record<DisplayStatus, string> = {
  ok: "teal",
  late: "yellow",
  never_started: "red",
  unfinished: "orange",
  failed: "red",
  unknown: "gray",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <Badge color={COLOR[status]} variant="light" size="lg">
      {STATUS_LABEL[status]}
    </Badge>
  );
}
