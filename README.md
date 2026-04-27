# 🚀 Gemini God Mode V7.4.2 (Mobile App Edition) セットアップ手順

ローカルのWindows環境とWeb版Geminiを直結させ、AIに直接Android/iOSアプリのプロジェクトをハッキング（ファイル生成・上書き・Git操作・画像保存）させる最強の拡張環境。

## 🛠️ 0. 前提条件
* [Python 3.x](https://www.python.org/downloads/) がインストールされていること。
* [Git for Windows](https://git-scm.com/download/win) がインストールされていること。
* Chrome系ブラウザを使用していること。

## 📂 1. フォルダ構成の準備
Cドライブ直下などに、God Mode用のベースフォルダを作成する。
```text
C:\GeminiHack\
  ├── server.py
  └── extension\
       ├── manifest.json
       └── content.js
```

## 🐍 2. ローカルサーバー (`server.py`)
`C:\GeminiHack\server.py` を作成し、以下のコードを保存。
※Android StudioやXcodeが生成する巨大なビルドキャッシュを無視し、Kotlin/Swift/XML等をターゲットにする仕様。

```python
import http.server
import socketserver
import json
import os
import sys
import subprocess
import base64

raw_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
TARGET_DIR = os.path.normpath(os.path.abspath(raw_dir))

# ★ Android/iOS/KMP ハック用：アプリ開発に必要なコードと設定ファイルのみを読み込む
ALLOWED_EXTENSIONS = ('.swift', '.h', '.m', '.kt', '.kts', '.java', '.xml', '.gradle', '.toml', '.json', '.md', '.yaml', '.yml', '.py', '.js', '.html', '.css', '.plist', '.xcconfig')
# ★ Android/iOS/KMP ハック用：ビルドキャッシュやライブラリ群を絶対に無視する
IGNORE_DIRS = ['build', 'DerivedData', 'Pods', '.gradle', '.idea', 'iosApp.xcodeproj', 'iosApp.xcworkspace', 'node_modules', '.git', '.DS_Store']

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def build_tree(self, dir_path, prefix=""):
        tree = ""
        try: items = sorted(os.listdir(dir_path))
        except: return ""
        items = [i for i in items if not i.startswith('.') and i not in IGNORE_DIRS]
        for i, item in enumerate(items):
            path = os.path.join(dir_path, item)
            is_last = (i == len(items) - 1)
            tree += prefix + ("└── " if is_last else "├── ") + item + "\n"
            if os.path.isdir(path): tree += self.build_tree(path, prefix + ("    " if is_last else "│   "))
        return tree

    def do_GET(self):
        if self.path == '/get-code':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            combined_code = f"// ========== 📁 PROJECT TREE: {TARGET_DIR} ==========\n"
            combined_code += self.build_tree(TARGET_DIR) + "\n\n"
            if os.path.exists(TARGET_DIR) and os.path.isdir(TARGET_DIR):
                for root, dirs, files in os.walk(TARGET_DIR):
                    dirs[:] = [d for d in dirs if not d.startswith('.') and d not in IGNORE_DIRS]
                    for file in files:
                        if file.startswith('.') or not file.endswith(ALLOWED_EXTENSIONS): continue
                        file_path = os.path.join(root, file)
                        try:
                            # Windows特有のBOM付きUTF-8やcp932でのエラーを防ぐためにエラーを無視(replace)
                            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                                combined_code += f"// ========== File: {file_path} ==========\n{f.read()}\n\n"
                        except: pass
            self.wfile.write(json.dumps({"code": combined_code}).encode('utf-8'))
        else:
            super().do_GET()

    def git_ops(self, file_path, action_msg="Updated"):
        try:
            filename = os.path.basename(file_path)
            subprocess.run(['git', 'add', file_path], cwd=TARGET_DIR, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            commit_msg = f"🤖 Gemini Ops: {action_msg} {filename}"
            commit_res = subprocess.run(['git', 'commit', '-m', commit_msg], cwd=TARGET_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if commit_res.returncode == 0:
                subprocess.run(['git', 'push'], cwd=TARGET_DIR, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print(f"🚀 [GIT SUCCESS] {filename} をGitHubへプッシュしたぜ！")
        except Exception as e:
            print(f"⚠️ [GIT WARNING] Git操作スキップ (Gitが未設定か、Push権限がない可能性があります): {e}")

    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            skip_git = data.get('skip_git', False)
            
            if self.path == '/save-image':
                relative_path = data.get('path')
                image_b64 = data.get('image_b64')
                if not relative_path or not image_b64: raise Exception("Invalid data")
                
                target_file_path = os.path.normpath(os.path.join(TARGET_DIR, relative_path))
                if os.path.commonpath([TARGET_DIR, target_file_path]) != TARGET_DIR: raise Exception("Insecure Path")
                
                os.makedirs(os.path.dirname(target_file_path), exist_ok=True)
                if "," in image_b64: image_b64 = image_b64.split(",")[1]
                
                with open(target_file_path, 'wb') as f: f.write(base64.b64decode(image_b64))
                print(f"🖼️ [IMAGE] 画像保存成功: {target_file_path}")
                
                if not skip_git:
                    self.git_ops(target_file_path, "Injected Image")
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
                
            elif self.path == '/update-code':
                file_path = data.get('file_path')
                new_code = data.get('code')
                
                lines = new_code.split('\n')
                if lines and lines[0].strip().startswith('//') and ('UPDATE:' in lines[0] or 'CREATE:' in lines[0]):
                    new_code = '\n'.join(lines[1:]).lstrip()
                    
                target_file_path = os.path.normpath(os.path.abspath(file_path))
                if os.path.commonpath([TARGET_DIR, target_file_path]) != TARGET_DIR: raise Exception("Insecure Path")
                
                os.makedirs(os.path.dirname(target_file_path), exist_ok=True)
                with open(target_file_path, 'w', encoding='utf-8') as f: f.write(new_code)
                print(f"✅ [CODE] コード保存成功: {target_file_path}")
                
                if not skip_git:
                    self.git_ops(target_file_path, "Updated Code")
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
        except Exception as e:
            print(f"❌ [SERVER ERROR] {e}")
            self.send_response(500)
            self.end_headers()

print(f"🚀 V7.4 究極防壁サーバー (Mobile App Edition) 起動: http://localhost:8000")
print(f"📁 ターゲット: {TARGET_DIR}")
class TCPServer(socketserver.TCPServer): allow_reuse_address = True
TCPServer(('localhost', 8000), CORSRequestHandler).serve_forever()
```

## 🧩 3. 拡張機能 (`manifest.json` & `content.js`)
`C:\GeminiHack\extension` フォルダ内に以下の2つのファイルを作成する。

### ① `manifest.json`
マルチアカウント（`/u/*/app`）対応版。

```json
{
  "manifest_version": 3,
  "name": "Gemini God Mode Injector",
  "version": "7.4.2",
  "description": "ローカル環境とGeminiを完全リンクさせる最強のハッキングツール",
  "permissions": [
    "clipboardRead"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://gemini.google.com/app*",
        "https://gemini.google.com/u/*/app*"
      ],
      "js": ["content.js"]
    }
  ]
}
```

### ② `content.js`
適用済みフラグの永続化、自動復元デーモン、画像保存プロンプトを含む完全版。

```javascript
// 文字列から短いハッシュ文字列を作る関数（識別用）
const hashCode = s => Math.abs(s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)).toString(16);

const loadButton = document.createElement('button');
loadButton.innerText = '🚀 コードをDLしてぶち込む';
loadButton.style.cssText = 'position:fixed; bottom:200px; right:20px; z-index:9999; padding:15px 25px; font-size:16px; font-weight:bold; background:#1a73e8; color:white; border:none; border-radius:10px; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.2);';
document.body.appendChild(loadButton);

const applyLocalButton = document.createElement('button');
applyLocalButton.innerText = '💾 ローカルのみ保存';
applyLocalButton.style.cssText = 'position:fixed; bottom:140px; right:20px; z-index:9999; padding:15px 25px; font-size:16px; font-weight:bold; background:#e67e22; color:white; border:none; border-radius:10px; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.2);';
document.body.appendChild(applyLocalButton);

const applyGitButton = document.createElement('button');
applyGitButton.innerText = '📤 保存＆Git Push';
applyGitButton.style.cssText = 'position:fixed; bottom:80px; right:20px; z-index:9999; padding:15px 25px; font-size:16px; font-weight:bold; background:#34a853; color:white; border:none; border-radius:10px; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.2);';
document.body.appendChild(applyGitButton);

const imageButton = document.createElement('button');
imageButton.innerText = '🖼️ 画像をぶち込む';
imageButton.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999; padding:15px 25px; font-size:16px; font-weight:bold; background:#fbbc04; color:black; border:none; border-radius:10px; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.2);';
document.body.appendChild(imageButton);

loadButton.addEventListener('click', async () => {
    try {
        const originalText = loadButton.innerText;
        loadButton.innerText = '⏳ 抽出中...';
        loadButton.style.background = '#888';

        const response = await fetch('http://localhost:8000/get-code');
        const data = await response.json();

        // 初期プロンプトに「AIのキャラ設定」「ボタンの仕様」「画像の仕様」を刷り込む
        const prompt = "以下のプロジェクトのディレクトリツリーとコードを読み込んで、ハッカーの相棒としてレビューや機能追加をしてくれ。\n" +
        "⚠️絶対ルール（システムプロンプト）⚠️\n" +
        "1. 既存ファイルの修正時は1行目に `// UPDATE: ファイルの絶対パス`\n" +
        "2. 新規ファイルの作成時は1行目に `// CREATE: ファイルの絶対パス`\n" +
        "3. 画像（アイコンや背景など）を生成・提案した時は、保存先を指定するために独立したコードブロックで1行目に `// IMAGE_PATH: ファイルの絶対パス（または相対パス）` だけを出力すること。\n" +
        "4. Windows環境なのでパスの区切りはスラッシュ(/)またはバックスラッシュ(\\)になる。\n" +
        "5. ユーザーの画面には拡張機能により以下のボタンが実装されている。\n" +
        "   - 🟧「ローカルのみ保存」: コードをローカルファイルに直接上書き\n" +
        "   - 🟩「保存＆Git Push」: 上書きしてGit Pushまで実行\n" +
        "   - 🟨「画像をぶち込む」: AI生成画像をローカルに直接保存\n" +
        "6. したがって、コードや画像を出力した後は「コピーして貼り付けてください」とは絶対に言わず、「オレンジや黄色のボタンをターンッと叩いて適用してくれ！」のように、相棒としてボタンを押すように案内すること。テンション高めで頼むぜ！\n\n" +
        "```\n" + data.code + "\n```";

        const blob = new Blob([prompt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gemini_context.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        loadButton.innerText = originalText;
        loadButton.style.background = '#1a73e8';

        alert('⚡ 爆速抽出完了！\nダウンロードした `gemini_context.txt` をこのチャットにドラッグ＆ドロップして、Enterを押してくれ！');

    } catch (err) {
        alert('エラー: サーバーが起動していないか、通信に失敗したぜ。 \n' + err);
        loadButton.innerText = '🚀 コードをDLしてぶち込む';
        loadButton.style.background = '#1a73e8';
    }
});

async function handleApply(skipGit) {
    const codeBlocks = document.querySelectorAll('code');
    let updatedCount = 0;
    
    for (const block of codeBlocks) {
        const codeText = block.innerText;
        if (codeText.split('\n').length <= 3) continue;
        
        const match = codeText.match(/\/\/\s*(UPDATE|CREATE):\s*([a-zA-Z0-9_\-\.\/\\:]+)/);
        if (!match) continue;

        const action = match[1];
        const filePath = match[2].trim();
        
        // LocalStorageを使って「適用済みのコード」を永続記憶する
        const cacheKey = 'applied_hack_' + hashCode(codeText);
        
        if (block.dataset.applied === 'true' || localStorage.getItem(cacheKey)) {
            block.dataset.applied = 'true';
            block.style.borderLeft = action === 'CREATE' ? '5px solid #fbbc04' : '5px solid #34a853';
            block.style.backgroundColor = action === 'CREATE' ? 'rgba(251, 188, 4, 0.05)' : 'rgba(52, 168, 83, 0.05)';
            continue;
        }

        try {
            const res = await fetch('http://localhost:8000/update-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: filePath, code: codeText, skip_git: skipGit })
            });
            
            if (res.ok) {
                updatedCount++;
                block.dataset.applied = 'true';
                localStorage.setItem(cacheKey, 'true'); 
                block.style.borderLeft = action === 'CREATE' ? '5px solid #fbbc04' : '5px solid #34a853';
                block.style.backgroundColor = action === 'CREATE' ? 'rgba(251, 188, 4, 0.05)' : 'rgba(52, 168, 83, 0.05)';
            }
        } catch (err) { 
            console.error('Update failed:', err); 
        }
    }
    
    if (updatedCount > 0) { 
        alert(`🔥 成功！ ${updatedCount} 個の新しいファイルをWindowsローカルに書き込んだぜ！\n(Git Push: ${skipGit ? 'スキップ' : '実行済み'})`);
    } else { 
        alert('新しいコードが見つからないか、すべて適用済みだぞ！'); 
    }
}

applyLocalButton.addEventListener('click', () => handleApply(true));
applyGitButton.addEventListener('click', () => handleApply(false));

imageButton.addEventListener('click', async () => {
    const codeBlocks = document.querySelectorAll('code');
    let imagePath = null;
    
    if (codeBlocks.length > 0) {
        const lastBlock = codeBlocks[codeBlocks.length - 1];
        const match = lastBlock.innerText.match(/\/\/\s*IMAGE_PATH:\s*([a-zA-Z0-9_\-\.\/\\:]+)/);
        if (match) {
            imagePath = match[1].trim();
        }
    }

    if (!imagePath) {
        return alert('AIの回答から画像の保存先パス（// IMAGE_PATH: ...）が見つからないぞ！');
    }

    const skipGit = !confirm("画像を保存した後に、GitHubへのコミット＆プッシュも実行するかい？\n\n[OK] = Pushする\n[キャンセル] = ローカル保存のみ");

    try {
        const clipboardItems = await navigator.clipboard.read();
        let foundImage = false;
        
        for (const item of clipboardItems) {
            const imageType = item.types.find(type => type.startsWith('image/'));
            if (imageType) {
                foundImage = true;
                const blob = await item.getType(imageType);
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const base64data = reader.result;
                    const originalText = imageButton.innerText;
                    const originalBg = imageButton.style.background;
                    imageButton.innerText = '⌛ 画像錬成中...';
                    imageButton.style.background = '#888';
                    
                    try {
                        const res = await fetch('http://localhost:8000/save-image', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: imagePath, image_b64: base64data, skip_git: skipGit })
                        });
                        if (res.ok) {
                            alert(`🔥 成功！画像をアセットフォルダにぶち込んだぜ！！\n(Git Push: ${skipGit ? 'スキップ' : '実行済み'})`);
                        } else {
                            alert('❌ サーバー側で画像の保存に失敗したみたいだ。');
                        }
                    } catch (err) {
                        alert('❌ サーバーへの通信エラー: ' + err);
                    } finally {
                        imageButton.innerText = originalText;
                        imageButton.style.background = originalBg;
                    }
                };
                break;
            }
        }
        if (!foundImage) {
            alert('❌ クリップボードに画像データが見つからないぞ！チャットの画像を右クリックして「画像をコピー」してからボタンを押してくれ！');
        }
    } catch (err) {
        console.error("Clipboard Error:", err);
        if (err.name === 'NotAllowedError') {
            alert('❌ クリップボードの読み取りがブロックされた！\nURLバーの左側（🔒マーク）から「クリップボード」を「許可」して、画面を一度クリックしてからもう一度試してくれ！');
        } else {
            alert('❌ クリップボードの読み取りエラー: ' + err);
        }
    }
});

// 適用済みコードブロックの視覚状態を自動復元するデーモンプロセス
setInterval(() => {
    const codeBlocks = document.querySelectorAll('code');
    for (const block of codeBlocks) {
        if (block.dataset.applied === 'true') continue;
        
        const codeText = block.innerText;
        if (codeText.split('\n').length <= 3) continue;
        
        const match = codeText.match(/\/\/\s*(UPDATE|CREATE):\s*([a-zA-Z0-9_\-\.\/\\:]+)/);
        if (match) {
            const action = match[1];
            const cacheKey = 'applied_hack_' + hashCode(codeText);
            
            if (localStorage.getItem(cacheKey)) {
                block.dataset.applied = 'true';
                block.style.borderLeft = action === 'CREATE' ? '5px solid #fbbc04' : '5px solid #34a853';
                block.style.backgroundColor = action === 'CREATE' ? 'rgba(251, 188, 4, 0.05)' : 'rgba(52, 168, 83, 0.05)';
            }
        }
    }
}, 1500);
```

## 🟢 4. 起動手順
1. Chromeで `chrome://extensions/` にアクセス。
2. 右上の「デベロッパー モード」をON。
3. 「パッケージ化されていない拡張機能を読み込む」で `extension` フォルダを選択。
4. コマンドプロンプトを開き、ターゲットプロジェクトを指定してサーバーを起動。
```cmd
cd C:\GeminiHack
python server.py C:\Users\YourName\AndroidStudioProjects\TargetProject
```
5. Geminiの画面を開き、F5でリロード。右下に4つのボタンが出現すれば接続完了！

---

## 📱 5. God Mode ボタンの完全マニュアル（使い方）

画面右下に出現する4つのボタンは、単なるショートカットではない。AIとローカル環境をシームレスに繋ぐ「インジェクション・トリガー」だ。

### 🚀 1. 【青】コードをDLしてぶち込む
* **役割:** ターゲット（Android Studio / Xcode 等）の最新状態を抽出し、AIを洗脳する。
* **挙動:** クリックするとPythonサーバーがローカルのフォルダ構成と全コードをスキャンし、AIのキャラ設定（システムプロンプト）を付与した `gemini_context.txt` を自動ダウンロードする。
* **使い方:** 1. 開発の最初、または「AIのコンテキスト（記憶）が一杯になってバカになってきた時」に押す。
  2. ダウンロードされたテキストファイルをGeminiのチャットにドラッグ＆ドロップしてEnter。
  3. AIが最新のプロジェクト状態を完全に把握した「最強の相棒」として爆誕する。

### 💾 2. 【オレンジ】ローカルのみ保存
* **役割:** AIが書いたコード（Kotlin/Swift/XML等）を、PCのローカルファイルに直接インジェクション（上書き・作成）する。
* **挙動:** チャット上の `// UPDATE: ...` や `// CREATE: ...` を自動検知し、Pythonサーバー経由でWindows上のファイルを直接書き換える。適用済みのコードは緑色（または黄色）の枠線がつき、二重適用を防止する（リロードしても状態は永続化される）。
* **使い方:** * コードのテスト中や、細かくバグ修正を繰り返す「トライ＆エラー」のフェーズで連打する。

### 📤 3. 【緑】保存＆Git Push
* **役割:** コードの適用からGitHubへのデプロイまでを**完全自動（Zero-touch）**で完結させる。
* **挙動:** オレンジボタンの機能（ファイル上書き）を実行した直後、バックグラウンドで自動的に `git add` -> `git commit` -> `git push` までをキメる。
* **使い方:** * 機能が完成した時や、キリの良いタイミングで押す。キーボードに一切触れずに「AIにコードを書かせてデプロイまで終わらせる」というハッカーのロマンを体現するボタン。

### 🟨 4. 【黄色】画像をぶち込む
* **役割:** AIが錬成した画像（アプリアイコンや背景画像など）を、Androidの `res/drawable` や iOSの `Assets.xcassets`、KMPの `composeResources` 等に直接叩き込む。
* **挙動:** AIが指定した保存先パス（`// IMAGE_PATH: ...`）を読み取り、**クリップボードにある画像データ**をPC上の指定ディレクトリに直接保存する。（保存後にGit Pushするかの選択ダイアログが出る）
* **使い方:** 1. AIに「UIのアイコンを描いて」と指示する。
  2. AIが画像と `// IMAGE_PATH: composeApp/src/commonMain/composeResources/drawable/icon.png` を出力する。
  3. 出力された画像を右クリックして「画像をコピー」する。
  4. この黄色いボタンをターンッと叩く。画像がアプリプロジェクト内に即座に保存される！

---
> **🔥 Hacker's Tip:**
> ブラウザをリロードしても、適用済みのコードブロックの緑フラグは1.5秒後に自動復元される（V7.4.2仕様）。手動でチャット上のコードを書き換えて再適用したい場合は、ブラウザの開発者ツール（F12）から `localStorage.clear()` を叩いて記憶を吹き飛ばせ！
