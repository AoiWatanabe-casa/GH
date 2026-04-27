import http.server
import socketserver
import json
import os
import sys
import subprocess
import base64

# コマンドライン引数からターゲットディレクトリを取得（指定がなければカレントディレクトリ）
raw_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
TARGET_DIR = os.path.normpath(os.path.abspath(raw_dir))

ALLOWED_EXTENSIONS = ('.swift', '.h', '.m', '.kt', '.kts', '.java', '.xml', '.gradle', '.toml', '.json', '.md', '.yaml', '.yml', '.py', '.js', '.html', '.css')
IGNORE_DIRS = ['build', 'DerivedData', 'Pods', '.gradle', '.idea', 'iosApp.xcodeproj', 'iosApp.xcworkspace', 'node_modules', '.git']

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
            # Windows環境でのgitコマンド実行 (Git for Windowsがインストールされている前提)
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
                
                # Windowsのパス区切り文字に最適化
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
                    
                # Windowsのパス区切り文字に最適化
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

print(f"🚀 V7.2 究極防壁サーバー (Windows Edition) 起動: http://localhost:8000")
print(f"📁 ターゲット: {TARGET_DIR}")
class TCPServer(socketserver.TCPServer): allow_reuse_address = True
TCPServer(('localhost', 8000), CORSRequestHandler).serve_forever()