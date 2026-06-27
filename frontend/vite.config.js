import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'fs';
import { exec } from 'child_process';

// === HMRをフックするカスタムプラグイン ===
function autoDeployAndDbUpdatePlugin() {
  return {
    name: 'auto-deploy-and-db-update',
    
    // ホットリロード時のフック
    async handleHotUpdate({ file, server }) {
      // 監視対象を lv3.js に絞る
      if (file.endsWith('lv3.js')) {

        try {
          const content = fs.readFileSync(file, 'utf-8');

          // 1. 正規表現で lv3.js の中身からIDと画像配列、フラグを抽出する
          const idMatch = content.match(/export const lv3PinId\s*=\s*(\d+)/);
          const uriMatch = content.match(/export const lv3ImageURI\s*=\s*(\[.*?\])/);
          const serverImgMatch = content.match(/export const useServerImg\s*=\s*(true|false)/);

          // 全てマッチして、かつ useServerImg が true の時だけ動かす
          if (idMatch && uriMatch && serverImgMatch && serverImgMatch[1] === 'true') {
            const id = parseInt(idMatch[1], 10);
            
            // シングルクォートをダブルクォートに変換してJSONパース（配列として取得）
            const arrayString = uriMatch[1].replace(/'/g, '"');
            const uris = JSON.parse(arrayString);

            if (uris.length === 0) return;

            // === サーバー情報の設定（sekilab.orgなどの環境に合わせて書き換えてね） ===
            const REMOTE_USER = 'ubuntu'; 
            const REMOTE_HOST = '153.126.153.105'; 
            const REMOTE_BASE_DIR = '/home/sakaki-map'; // サーバー側のプロジェクトルート
            const API_ENDPOINT = 'https://sekilab.org//sakaki-map/api/update-path'; // DB更新用のAPI

            // 2. 抽出したURIごとにSCPコマンドを実行する
            uris.forEach(uri => {
              // ローカルの相対パスを作成（vite.config.jsから見たパスに調整）
              // ※ public/ や src/ の中にある場合はパスを書き換える
              const localPath = `./${uri}`; 
              const remotePath = `${REMOTE_BASE_DIR}/${uri}`;

              // scpコマンドの組み立て
              const scpCommand = `scp ${localPath} ${REMOTE_USER}@${REMOTE_HOST}:${remotePath}`;
              
              exec(scpCommand, (error, stdout, stderr) => {
                if (error) {
                  console.error(`❌ [SCP Error] ${uri} の転送に失敗:`, error.message);
                  return;
                }
                console.log(`✅ [SCP Success] ${uri} をサーバーに転送完了！`);
              });
            });

            // 3. Node.js側から直接バックエンドのAPIを叩いてDBを更新する
            console.log('📡 [DB Update] データベースの更新リクエストを送信中...');
            
            fetch(API_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: id,
                image_path: uris // バックエンドが配列を受け取れる前提
              })
            })
            .then(res => res.json())
            .then(data => {
              console.log('✅ [DB Success] データベースのImageURI更新完了！', data);
            })
            .catch(err => {
              console.error('❌ [DB Error] データベース更新エラー:', err);
            });
          }
        } catch (error) {
          console.error('❌ [Plugin Error] lv3.jsのパース中にエラーが発生したよ:', error);
        }
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl(), autoDeployAndDbUpdatePlugin()],
  server: {
    open: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
