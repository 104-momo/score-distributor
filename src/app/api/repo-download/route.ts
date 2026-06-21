/**
 * 临时下载端点：返回最新 commit 的源码 zip
 * 用于让用户在本地拉取最新代码并推送到 GitHub
 *
 * 注意：这个端点只在开发模式可用（用了 fs/child_process）
 * 部署到 Cloudflare 前会移除
 */
import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const repoDir = process.cwd();
    const outPath = join(tmpdir(), "score-distributor-cloudflare.zip");

    execSync(`git archive --format=zip --output=${outPath} HEAD`, {
      cwd: repoDir,
      stdio: "pipe",
    });

    if (!existsSync(outPath)) {
      return NextResponse.json({ error: "打包失败" }, { status: 500 });
    }

    const buffer = readFileSync(outPath);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          'attachment; filename="score-distributor-cloudflare.zip"',
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
