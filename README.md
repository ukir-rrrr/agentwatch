# agentwatch

Heartbeat monitoring for cron jobs (and later AI agents). A Cloudflare Worker + D1 service that expects pings on a schedule and alerts via the LINE Messaging API.

cron / 定期ジョブ向けのハートビート監視。Cloudflare Worker と D1 で動かし、予定どおり start/success が来なければ LINE Messaging API で通知します。

> LINE Notify は終了済みです。このプロジェクトは **LINE Messaging API の push message** だけを使います。

## English summary

- Create a D1 database, apply migrations, set `ADMIN_TOKEN` / `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_USER_ID`, replace `database_id` in `wrangler.jsonc`, deploy.
- Add a monitor from the Mantine dashboard (admin token in the header, stored in localStorage) or the admin API. Wrap an existing job with `/ping/:token/start` → work → `/ping/:token` (or `/fail`).
- A per-minute Cron Trigger checks deadlines: never started (after grace), started but unfinished (max runtime), or explicit fail. Recovery is sent once when the monitor is OK again.

## できること

- モニターごとに **cron 式** または **周期 (period)**、猶予 (grace)、最大実行時間、秘密の ping トークンを持つ
- `GET` / `POST` 両対応の ping:
  - `/ping/:token/start` — 実行開始
  - `/ping/:token` — 成功
  - `/ping/:token/fail` — 失敗
- 毎分の Cron Trigger で締切判定
  - **never_started**: 予定時刻 + grace までに start も success もない
  - **unfinished**: start 後、max runtime 以内に success/fail がない（未起動とは区別）
  - **failed**: fail ping
  - **recovered**: 障害状態から success で復帰（重複通知なし）
- 通知は LINE のみ。notifier インターフェースは email / Slack / Discord / webhook 追加用に分離
- 管理は admin token 付きの最小 API + **Mantine (React) ダッシュボード**（同一 Worker の静的アセット）。`/` で一覧・作成・詳細。公開 JSON は `/api/status`

## セットアップ / デプロイ

前提: Node.js 20+、Cloudflare アカウント、Wrangler ログイン (`npx wrangler login`)。

```bash
npm install
npx wrangler login
npx wrangler d1 create agentwatch
```

出力された `database_id` で `wrangler.jsonc` のプレースホルダ (`00000000-0000-0000-0000-000000000000`) を置き換える。

```bash
npx wrangler d1 migrations apply agentwatch --remote
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LINE_USER_ID
npm run deploy
```

`npm run deploy` は Vite でフロントエンドをビルドしてから `wrangler deploy` します。UI は Worker の [静的アセット](https://developers.cloudflare.com/workers/static-assets/) として配信されます。

ローカル確認:

```bash
cp .dev.vars.example .dev.vars
# .dev.vars に ADMIN_TOKEN などを書く
npx wrangler d1 migrations apply agentwatch --local
npm run dev
npm test
npm run dry-run
```

ブラウザで `http://127.0.0.1:8787/` を開き、ヘッダーの「管理トークン」に `.dev.vars` の `ADMIN_TOKEN` を入れると作成・編集ができます（localStorage に保存）。配色はライト / ダークを切り替えられます。

Cron の解釈は **UTC** です。

## LINE の channel access token と user ID

LINE Notify は使わないでください（サービス終了済み）。[LINE Developers](https://developers.line.biz/console/) で Messaging API チャネルを作ります。

1. LINE Developers Console でプロバイダーを作り、**Messaging API** チャネルを作成する
2. チャネルの **Messaging API** 設定で長期の **Channel access token** を発行する
3. 同ページの QR コードから、通知を受け取りたい LINE アカウントで Bot を友だち追加する
4. **User ID** を取る:
   - いちばん簡単: チャネルの「ウェブフック」を一時的に有効にし、自分が Bot にメッセージを送る。イベント JSON の `source.userId` (`U` で始まる ID) がそれ
   - または Messaging API のフォロワー ID 取得 (`GET /v2/bot/followers/ids`) が使える場合はそれを使う
5. その token と user ID を Worker secrets に入れる

push 先は「Bot を友だち追加したユーザー」である必要があります。

## 既存 Cron Trigger ジョブを包む（1 行例）

最初の dogfood 想定: Supabase 無料枠の一時停止を防ぐ keepalive Worker。

```bash
BASE="https://agentwatch.<YOUR_SUBDOMAIN>.workers.dev/ping/<TOKEN>"
curl -fsS "$BASE/start" && curl -fsS --max-time 15 "https://<PROJECT>.supabase.co/rest/v1/" -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY" && curl -fsS "$BASE" || curl -fsS "$BASE/fail"
```

Worker 内なら:

```ts
const base = "https://agentwatch.<YOUR_SUBDOMAIN>.workers.dev/ping/<TOKEN>";

export default {
  async scheduled(_event: ScheduledEvent, env: Env) {
    await fetch(`${base}/start`);
    try {
      const response = await fetch(`https://${env.SUPABASE_PROJECT}.supabase.co/rest/v1/`, {
        headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` },
      });
      if (!response.ok) throw new Error(`supabase ${response.status}`);
      await fetch(base);
    } catch (error) {
      await fetch(`${base}/fail`);
      throw error;
    }
  },
};
```

start を省略して success だけ送ることもできます。その場合、予定 + grace までに success が無ければ `never_started` になります。

## Admin API（curl）

`Authorization: Bearer $ADMIN_TOKEN` または `X-Admin-Token` が必要です。

モニター作成（cron）:

```bash
curl -sS -X POST "$HOST/admin/monitors" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "supabase-keepalive",
    "cron": "0 */6 * * *",
    "graceSeconds": 300,
    "maxRuntimeSeconds": 60
  }'
```

周期指定:

```bash
curl -sS -X POST "$HOST/admin/monitors" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hourly-job",
    "periodSeconds": 3600,
    "graceSeconds": 180,
    "maxRuntimeSeconds": 120
  }'
```

一覧 / 取得 / 更新 / 削除:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$HOST/admin/monitors"
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$HOST/admin/monitors/<ID>"
curl -sS -X PATCH "$HOST/admin/monitors/<ID>" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
curl -sS -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$HOST/admin/monitors/<ID>"
```

作成レスポンスの `urls.start` / `urls.success` / `urls.fail` をジョブから叩きます。ダッシュボードの詳細画面からもコピーできます。公開 JSON (`/api/status`) にはトークンは出ません。

## UI

React + Mantine の SPA です。`npm run build:web` で `web/dist` に出力し、Worker が同じオリジンで配信します。

- ダッシュボード: 状態バッジ（OK / 遅延 / 未起動 / 未完了 / 失敗）、最終 ping、最終アラート
- 詳細: 最近の ping、ping URL のコピー
- 作成・編集: 名前、cron または周期、猶予、最大実行時間

## 開発

```bash
npm test
npm run dry-run
```

`npm run dry-run` はフロントエンドの Vite ビルドのあと `wrangler deploy --dry-run` を実行します。

状態機械のテスト対象: on-time / late / never started / started-not-finished / fail / recovery。

## ライセンス

MIT
