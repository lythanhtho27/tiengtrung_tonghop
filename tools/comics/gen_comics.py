"""Vẽ ảnh khung truyện tranh bằng Qwen-Image chạy ở máy nhà.

Đọc tools/comics/panels_<series>.json + characters.json, ghép prompt rồi lưu ảnh gốc vào
tools/comics/raw/<series>/<id>_p<n>.png. Ảnh đã có thì bỏ qua (chạy lại để vẽ tiếp / vẽ lại ảnh đã xóa).

Ba cách dùng:

1) ComfyUI (khuyên dùng). Mở workflow Qwen-Image của bạn, gõ đúng chữ  PROMPT  vào ô prompt dương,
   (tùy chọn) gõ  NEGATIVE  vào ô prompt âm, rồi Workflow → Export (API) → lưu thành qwen_api.json.
     python tools/comics/gen_comics.py s10 --comfy qwen_api.json [--server http://127.0.0.1:8188]
   Script tự đặt seed (mọi input "seed"/"noise_seed") và kích thước (mọi node có width/height).

2) diffusers (Python thuần, cần GPU lớn):
     python tools/comics/gen_comics.py s10 --diffusers [--model Qwen/Qwen-Image] [--steps 50]

3) Chỉ xuất prompt để dán tay vào công cụ khác:
     python tools/comics/gen_comics.py s10 --export      → tools/comics/raw/s10/prompts.txt

Tùy chọn chung: --only s10-01,s10-02   --seed 1   --width 1664 --height 928
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import uuid
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))


def load(series):
    chars = json.load(open(os.path.join(HERE, "characters.json"), encoding="utf-8"))
    panels = json.load(open(os.path.join(HERE, "panels_%s.json" % series), encoding="utf-8"))
    return chars, panels


def build_prompt(chars, scene):
    def rep(m):
        key = m.group(1)
        if key.startswith("@"):
            return chars["places"].get(key[1:], key[1:])
        return chars["characters"].get(key, key)
    body = re.sub(r"\{(@?\w+)\}", rep, scene)
    return "%s %s. %s" % (chars["style"], body.rstrip(". "), chars.get("suffix", ""))


def jobs(series, only):
    chars, panels = load(series)
    out = []
    for doc_id, lst in panels["chapters"].items():
        if only and doc_id not in only:
            continue
        for pn in lst:
            name = "%s_p%d" % (doc_id, pn["n"])
            out.append((name, build_prompt(chars, pn["prompt"])))
    return chars, out


def panel_seed(base, name):
    return (base * 1000003 + zlib.crc32(name.encode())) % (2 ** 31)


# ------------------------------------------------------------------ ComfyUI
def comfy_patch(wf, prompt, negative, seed, w, h):
    wf = json.loads(json.dumps(wf))
    found = False
    for node in wf.values():
        inp = node.get("inputs", {})
        for k, v in list(inp.items()):
            if isinstance(v, str):
                if v.strip() == "PROMPT":
                    inp[k] = prompt
                    found = True
                elif v.strip() == "NEGATIVE":
                    inp[k] = negative
            if k in ("seed", "noise_seed") and isinstance(v, (int, float)):
                inp[k] = seed
        if isinstance(inp.get("width"), (int, float)) and isinstance(inp.get("height"), (int, float)):
            inp["width"], inp["height"] = w, h
    if not found:
        sys.exit("Không thấy ô có chữ PROMPT trong workflow. Gõ PROMPT vào ô prompt dương rồi Export (API) lại.")
    return wf


def comfy_run(server, wf, dest):
    cid = str(uuid.uuid4())
    req = urllib.request.Request(server + "/prompt", data=json.dumps({"prompt": wf, "client_id": cid}).encode(),
                                 headers={"Content-Type": "application/json"})
    pid = json.load(urllib.request.urlopen(req))["prompt_id"]
    while True:
        time.sleep(2)
        hist = json.load(urllib.request.urlopen(server + "/history/" + pid))
        if pid in hist:
            break
    for out in hist[pid].get("outputs", {}).values():
        for img in out.get("images", []):
            if img.get("type") == "temp":
                continue
            q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img["type"]})
            data = urllib.request.urlopen(server + "/view?" + q).read()
            open(dest, "wb").write(data)
            return True
    return False


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("series")
    ap.add_argument("--comfy", metavar="WORKFLOW_API.json")
    ap.add_argument("--server", default="http://127.0.0.1:8188")
    ap.add_argument("--diffusers", action="store_true")
    ap.add_argument("--model", default="Qwen/Qwen-Image")
    ap.add_argument("--steps", type=int, default=50)
    ap.add_argument("--export", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--width", type=int, default=1664)
    ap.add_argument("--height", type=int, default=928)
    a = ap.parse_args()

    only = set(x.strip() for x in a.only.split(",") if x.strip())
    chars, todo = jobs(a.series, only)
    outdir = os.path.join(HERE, "raw", a.series)
    os.makedirs(outdir, exist_ok=True)

    if a.export:
        path = os.path.join(outdir, "prompts.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write("NEGATIVE: %s\nSIZE: %dx%d\n\n" % (chars["negative"], a.width, a.height))
            for name, p in todo:
                f.write("### %s  (lưu ảnh thành %s.png)\n%s\n\n" % (name, name, p))
        print("Đã ghi", path, "-", len(todo), "khung")
        return

    def exists(name):
        return any(os.path.exists(os.path.join(outdir, name + ext)) for ext in (".png", ".jpg", ".webp"))

    pending = [(n, p) for n, p in todo if not exists(n)]
    print("Tổng %d khung, cần vẽ %d" % (len(todo), len(pending)))
    if not pending:
        return

    if a.comfy:
        wf = json.load(open(a.comfy, encoding="utf-8"))
        for i, (name, p) in enumerate(pending, 1):
            t0 = time.time()
            patched = comfy_patch(wf, p, chars["negative"], panel_seed(a.seed, name), a.width, a.height)
            ok = comfy_run(a.server.rstrip("/"), patched, os.path.join(outdir, name + ".png"))
            print("[%d/%d] %s %s (%.0fs)" % (i, len(pending), name, "OK" if ok else "KHÔNG CÓ ẢNH", time.time() - t0))
    elif a.diffusers:
        import torch
        from diffusers import DiffusionPipeline
        dev = "cuda" if torch.cuda.is_available() else "cpu"
        pipe = DiffusionPipeline.from_pretrained(a.model, torch_dtype=torch.bfloat16 if dev == "cuda" else torch.float32)
        if dev == "cuda":
            try:
                pipe.enable_model_cpu_offload()
            except Exception:
                pipe = pipe.to(dev)
        for i, (name, p) in enumerate(pending, 1):
            t0 = time.time()
            img = pipe(prompt=p, negative_prompt=chars["negative"], width=a.width, height=a.height,
                       num_inference_steps=a.steps, true_cfg_scale=4.0,
                       generator=torch.Generator(device=dev).manual_seed(panel_seed(a.seed, name))).images[0]
            img.save(os.path.join(outdir, name + ".png"))
            print("[%d/%d] %s OK (%.0fs)" % (i, len(pending), name, time.time() - t0))
    else:
        ap.error("Chọn một cách: --comfy WORKFLOW.json, --diffusers hoặc --export")
    print("Xong. Chạy tiếp: python tools/comics/build_comics.py", a.series)


if __name__ == "__main__":
    main()
