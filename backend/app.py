import os
import json
import hashlib
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

# --- Flaskアプリの初期設定 ---
BASE_PATH = '/sakaki-map'
app = Flask(__name__, static_folder='dist', static_url_path=BASE_PATH)

# CORS設定（外部からのアクセス許可）
CORS(
    app,
    resources={rf"{BASE_PATH}/api/*": {"origins": "*"}},
    allow_headers=["Content-Type"],
    methods=["GET", "POST", "OPTIONS"],
)

# SQLiteデータベースの設定
base_dir = os.path.abspath(os.path.dirname(__file__))
db_dir = os.path.join(base_dir, 'instance')
os.makedirs(db_dir, exist_ok=True)
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(db_dir, 'sakaki_map.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- データベースのモデル定義（テーブル設計） ---

# Accountモデル（生徒のアカウント情報とLv1設定を管理する）
class Account(db.Model):
    __tablename__ = 'accounts'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(200))
    pinColor = db.Column(db.String(50), nullable=False, server_default='red')
    textSize = db.Column(db.Numeric, nullable=False, server_default='15')
    fontFamily = db.Column(db.String(100), nullable=False, server_default='sans-serif')

    memories = db.relationship('Memory', backref='author', lazy=True)
    added_images = db.relationship('MemoryImage', backref='author', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'pinColor': self.pinColor,
            'textSize': float(self.textSize),
            'fontFamily': self.fontFamily
        }

# Memoryモデル（地図上のピン・思い出の場所を管理する）
class Memory(db.Model):
    __tablename__ = 'memories'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    detail = db.Column(db.String(500))
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'))

    images = db.relationship('MemoryImage', backref='memory', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'detail': self.detail,
            'account_id': self.account_id,
            'imageUrl': [img.imageUrl for img in self.images]
        }

# MemoryImageモデル（思い出に紐づく画像パスを管理する）
class MemoryImage(db.Model):
    __tablename__ = 'memory_images'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    memories_id = db.Column(db.Integer, db.ForeignKey('memories.id'), nullable=False)
    imageUrl = db.Column(db.Text, nullable=False)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'))

# --- アプリ起動時の初期化処理 ---
with app.app_context():
    db.create_all()

# --- APIの定義（フロントエンドとの通信窓口） ---

# GET /api/memories : 保存されている全員の思い出データを取得する
@app.route(f'{BASE_PATH}/api/memories', methods=['GET'])
def get_memories():
    memories = Memory.query.all()
    return jsonify([m.to_dict() for m in memories]), 200


# POST /api/memories : 送信されるJSONを受け取り保存する
@app.route(f'{BASE_PATH}/api/memories', methods=['POST'])
def upload_memories():
    data = request.get_json()

    # リクエストデータの検証を行う
    if not data or not isinstance(data, list):
        return jsonify({'error': 'データはJSONの配列（リスト）形式である必要がある'}), 400

    try:
        for item in data:
            memory_id = item.get('id')
            if not memory_id:
                continue

            existing_memory = db.session.get(Memory, memory_id)
            
            # 既存データが存在する場合は上書き更新する
            if existing_memory:
                existing_memory.name = item.get('name', existing_memory.name)
                existing_memory.latitude = item.get('latitude', existing_memory.latitude)
                existing_memory.longitude = item.get('longitude', existing_memory.longitude)
                existing_memory.detail = item.get('detail', existing_memory.detail)
                if 'account_id' in item:
                    existing_memory.account_id = item.get('account_id')
                    
            # 既存データが存在しない場合は新規作成する
            else:
                name = item.get('name')
                lat = item.get('latitude')
                lon = item.get('longitude')

                if name is None or lat is None or lon is None:
                    return jsonify({'error': f'ID {memory_id} のデータ保存に失敗した。「name」「latitude」「longitude」は必須項目である。'}), 400

                new_memory = Memory(
                    id=memory_id,
                    name=name,
                    latitude=lat,
                    longitude=lon,
                    detail=item.get('detail'),
                    account_id=item.get('account_id')
                )
                db.session.add(new_memory)
                db.session.flush()
            
            # 画像データの更新処理を行う
            new_image_urls = item.get('imageUrl')
            if new_image_urls is not None:
                MemoryImage.query.filter_by(memories_id=memory_id).delete()
                
                if isinstance(new_image_urls, str):
                    try:
                        new_image_urls = json.loads(new_image_urls)
                    except:
                        new_image_urls = [new_image_urls]
                
                for path in new_image_urls:
                    new_img = MemoryImage(
                        memories_id=memory_id, 
                        imageUrl=path,
                        account_id=item.get('account_id')
                    )
                    db.session.add(new_img)

        # データベースへの変更を確定する
        db.session.commit()
        return jsonify({'message': 'サーバーへのデプロイに成功した'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error saving memories: {e}")
        return jsonify({'error': f'保存エラー: 入力データを確認すること。詳細: {str(e)}'}), 500


# POST /api/update-path : 画像パスを更新する（Viteプラグインからの送信用）
@app.route(f'{BASE_PATH}/api/update-path', methods=['POST'])
def update_path():
    data = request.get_json()

    # リクエストデータの検証を行う
    if not data:
        return jsonify({'error': 'リクエストボディが空である'}), 400

    pin_id = data.get('id')
    image_path_data = data.get('image_path')

    if pin_id is None or image_path_data is None:
        return jsonify({'error': '「id」と「image_path」は必須である'}), 400

    try:
        # 対象の思い出レコードを取得する
        memory = db.session.get(Memory, pin_id)

        if not memory:
            return jsonify({'error': f'ID {pin_id} のレコードが見つからない'}), 404

        # 古い画像を削除し、新しい画像を登録する
        MemoryImage.query.filter_by(memories_id=pin_id).delete()

        # 配列への変換処理を行う
        if isinstance(image_path_data, str):
            try:
                paths = json.loads(image_path_data)
            except:
                paths = [image_path_data]
        else:
            paths = image_path_data

        # 新しい画像を保存する
        for path in paths:
            new_img = MemoryImage(memories_id=pin_id, imageUrl=path)
            db.session.add(new_img)

        # データベースへの変更を確定する
        db.session.commit()

        return jsonify({
            'message': f'ID {pin_id} の画像パスを更新した',
            'id': pin_id
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error updating image path: {e}")
        return jsonify({'error': f'更新エラー: {str(e)}'}), 500

# POST /api/login : ログイン処理
@app.route(f'{BASE_PATH}/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'ユーザー名とパスワードを入力してください'}), 400

    username = data.get('username')
    password = data.get('password')

    account = Account.query.filter_by(username=username).first()
    if not account:
        return jsonify({'error': 'ユーザー名が間違っています'}), 401

    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    if account.password_hash != hashed_password:
        return jsonify({'error': 'パスワードが間違っています'}), 401

    return jsonify({
        'message': 'ログイン成功',
        'user': account.to_dict()
    }), 200

# GET /api/accounts : 保存されている全員のアカウントデータを取得する
@app.route(f'{BASE_PATH}/api/accounts', methods=['GET'])
def get_accounts():
    accounts = Account.query.all()
    return jsonify([a.to_dict() for a in accounts]), 200

# POST /api/accounts : アカウントを作成・更新する
@app.route(f'{BASE_PATH}/api/accounts', methods=['POST'])
def upload_accounts():
    data = request.get_json()

    if not data:
        return jsonify({'error': 'データが空である'}), 400

    # 単一のオブジェクトが送られてきた場合はリストに変換する
    if isinstance(data, dict):
        data = [data]

    if not isinstance(data, list):
        return jsonify({'error': 'データはJSONの配列（リスト）形式である必要がある'}), 400

    try:
        for item in data:
            account_id = item.get('id')
            username = item.get('username')

            if not username:
                continue

            existing_account = None
            if account_id:
                existing_account = db.session.get(Account, account_id)
            
            # idで見つからない場合、usernameで検索する
            if not existing_account:
                existing_account = Account.query.filter_by(username=username).first()

            # 既存データが存在する場合は上書き更新する
            if existing_account:
                existing_account.username = username
                if 'password_hash' in item:
                    existing_account.password_hash = item.get('password_hash')
                if 'pinColor' in item:
                    existing_account.pinColor = item.get('pinColor')
                if 'textSize' in item:
                    existing_account.textSize = item.get('textSize')
                if 'fontFamily' in item:
                    existing_account.fontFamily = item.get('fontFamily')
                    
            # 既存データが存在しない場合は新規作成する
            else:
                new_account = Account(
                    id=account_id if account_id else None,
                    username=username,
                    password_hash=item.get('password_hash'),
                    pinColor=item.get('pinColor', 'red'),
                    textSize=item.get('textSize', 15),
                    fontFamily=item.get('fontFamily', 'sans-serif')
                )
                db.session.add(new_account)

        # データベースへの変更を確定する
        db.session.commit()
        return jsonify({'message': 'アカウントの保存に成功した'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error saving accounts: {e}")
        return jsonify({'error': f'保存エラー: 入力データを確認すること。詳細: {str(e)}'}), 500


# --- アプリの起動 ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)