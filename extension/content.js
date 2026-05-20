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
    
    // DOMのインデックス(i)依存を廃止し、再び for...of に戻す
    for (const block of codeBlocks) {
        const codeText = block.innerText;
        const match = codeText.match(/\/\/\s*(UPDATE|CREATE):\s*([^\n\r]+)/);
        if (!match) continue;

        const action = match[1];
        const filePath = match[2].trim();
        
        // ★ V7.5.4 神機能: 文脈（AIの直前の発言）を読み取ってハッシュに混ぜる！
        let contextText = "";
        const preTag = block.closest('pre');
        if (preTag && preTag.previousElementSibling) {
            contextText = preTag.previousElementSibling.innerText || "";
        } else if (preTag && preTag.parentElement) {
            contextText = preTag.parentElement.innerText.substring(0, 100);
        }
        const cacheKey = 'applied_hack_' + hashCode(contextText + codeText);
        
        const status = localStorage.getItem(cacheKey) || block.dataset.applied;
        if (status === 'true' || status === 'rejected') {
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
        alert('新しいコードが見つからないか、すべて適用済み・却下済みだぞ！'); 
    }
}

applyLocalButton.addEventListener('click', () => handleApply(true));
applyGitButton.addEventListener('click', () => handleApply(false));

imageButton.addEventListener('click', async () => {
    const codeBlocks = document.querySelectorAll('code');
    let imagePath = null;
    
    if (codeBlocks.length > 0) {
        const lastBlock = codeBlocks[codeBlocks.length - 1];
        const match = lastBlock.innerText.match(/\/\/\s*IMAGE_PATH:\s*([^\n\r]+)/);
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

// 適用済み/却下済みフラグの監視と、却下ボタンのインジェクション
setInterval(() => {
    const codeBlocks = document.querySelectorAll('code');
    
    for (const block of codeBlocks) {
        const codeText = block.innerText;
        const match = codeText.match(/\/\/\s*(UPDATE|CREATE):\s*([^\n\r]+)/);
        if (!match) continue;

        const action = match[1];
        
        // ★ V7.5.4: 監視デーモン側でも文脈ハッシュを使う
        let contextText = "";
        const preTag = block.closest('pre');
        if (preTag && preTag.previousElementSibling) {
            contextText = preTag.previousElementSibling.innerText || "";
        } else if (preTag && preTag.parentElement) {
            contextText = preTag.parentElement.innerText.substring(0, 100);
        }
        const cacheKey = 'applied_hack_' + hashCode(contextText + codeText);
        
        const status = localStorage.getItem(cacheKey);

        if (!block.dataset.hasRejectBtn) {
            block.dataset.hasRejectBtn = 'true';
            
            const rejectBtn = document.createElement('button');
            rejectBtn.innerText = '❌ このコードを却下';
            rejectBtn.style.cssText = 'display:inline-block; margin-bottom:8px; padding:6px 12px; background:#ea4335; color:white; border:none; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.2); transition:0.2s;';
            
            rejectBtn.onclick = () => {
                const currentStatus = localStorage.getItem(cacheKey) || block.dataset.applied;
                
                if (currentStatus === 'rejected') {
                    localStorage.removeItem(cacheKey);
                    block.dataset.applied = 'false';
                    block.style.borderLeft = 'none';
                    block.style.backgroundColor = 'transparent';
                    rejectBtn.innerText = '❌ このコードを却下';
                    rejectBtn.style.background = '#ea4335';
                } else {
                    localStorage.setItem(cacheKey, 'rejected');
                    block.dataset.applied = 'rejected';
                    block.style.borderLeft = '5px solid #ea4335';
                    block.style.backgroundColor = 'rgba(234, 67, 53, 0.05)';
                    rejectBtn.innerText = '🔄 却下を解除 (適用対象に戻す)';
                    rejectBtn.style.background = '#5f6368';
                }
            };
            
            block.parentNode.insertBefore(rejectBtn, block);
        }

        // 自動復元処理
        if (status === 'true' && block.dataset.applied !== 'true') {
            block.dataset.applied = 'true';
            block.style.borderLeft = action === 'CREATE' ? '5px solid #fbbc04' : '5px solid #34a853';
            block.style.backgroundColor = action === 'CREATE' ? 'rgba(251, 188, 4, 0.05)' : 'rgba(52, 168, 83, 0.05)';
        } else if (status === 'rejected' && block.dataset.applied !== 'rejected') {
            block.dataset.applied = 'rejected';
            block.style.borderLeft = '5px solid #ea4335';
            block.style.backgroundColor = 'rgba(234, 67, 53, 0.05)';
            const prevBtn = block.previousElementSibling;
            if(prevBtn && prevBtn.tagName === 'BUTTON') {
                prevBtn.innerText = '🔄 却下を解除 (適用対象に戻す)';
                prevBtn.style.background = '#5f6368';
            }
        }
    }
}, 1500);