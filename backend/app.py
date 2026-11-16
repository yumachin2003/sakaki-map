import os
import json
import hashlib
import base64
from urllib.parse import urlparse
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers.structs import (
    PublicKeyCredentialDescriptor,
    UserVerificationRequirement,
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url

# --- Flaskアプリの初期設定 ---
BASE_PATH = '/sakaki-map'
app = Flask(__name__, static_folder='dist', static_url_path=BASE_PATH)

# CORS設定（外部からのアクセス許可）
CORS(
    app,
    resources={rf"{BASE_PATH}/api/*": {"origins": "*"}},
    allow_headers=["Content-Type"],
    methods=["GET", "POST", "DELETE", "OPTIONS"],
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
    disp_name = db.Column(db.String(30))
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True)
    password_hash = db.Column(db.String(200))
    pinColor = db.Column(db.String(50), nullable=False, server_default='red')
    textSize = db.Column(db.Numeric, nullable=False, server_default='15')
    fontFamily = db.Column(db.String(100), nullable=False, server_default='sans-serif')
    memories = db.relationship('Memory', backref='author', lazy=True)
    added_images = db.relationship('MemoryImage', backref='author', lazy=True)
    icon_images = db.relationship('AccountIconImage', backref='account', lazy=True, cascade="all, delete-orphan")
    passkeys = db.relationship('PasskeyCredential', backref='account', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        icon_url = self.icon_images[-1].imageUrl if self.icon_images else None
        return {
            'id': self.id,
            'disp_name': self.disp_name,
            'username': self.username,
            'email': self.email,
            'iconUrl': icon_url,
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

# AccountIconImageモデル（アカウントのアイコン画像を管理する）
class AccountIconImage(db.Model):
    __tablename__ = 'account_icon_images'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    imageUrl = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'account_id': self.account_id,
            'imageUrl': self.imageUrl
        }

# PasskeyCredentialモデル（WebAuthnパスキーの認証情報を管理する）
class PasskeyCredential(db.Model):
    __tablename__ = 'passkey_credentials'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    credential_id = db.Column(db.Text, unique=True, nullable=False)
    public_key = db.Column(db.LargeBinary, nullable=False)
    sign_count = db.Column(db.Integer, nullable=False, default=0)
    transports = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'account_id': self.account_id,
            'credential_id': self.credential_id,
            'sign_count': self.sign_count,
            'transports': json.loads(self.transports) if self.transports else []
        }

# --- アプリ起動時の初期化処理 ---
with app.app_context():
    db.create_all()
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('accounts')]
        with db.engine.connect() as conn:
            if 'disp_name' not in columns:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN disp_name VARCHAR(50);"))
            if 'email' not in columns:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN email VARCHAR(100);"))
            # 既存データでdisp_nameが未設定(NULL)の場合はusernameで自動初期化
            conn.execute(text("UPDATE accounts SET disp_name = username WHERE disp_name IS NULL;"))
            conn.commit()
    except Exception as e:
        print(f"Migration check: {e}")

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

def _set_account_icon(account_id, icon_url):
    """アカウントのアイコン画像を設定・更新する（空文字の場合は削除のみ）。"""
    AccountIconImage.query.filter_by(account_id=account_id).delete()
    if icon_url:
        db.session.add(AccountIconImage(account_id=account_id, imageUrl=icon_url))

# GET/POST /api/accounts/icon : アカウントのアイコン画像を取得・更新する
@app.route(f'{BASE_PATH}/api/accounts/icon', methods=['GET', 'POST'])
def account_icon():
    if request.method == 'GET':
        account_id = request.args.get('account_id') or request.args.get('id')
        username = request.args.get('username')

        if account_id or username:
            account = None
            if account_id:
                try:
                    account = db.session.get(Account, int(account_id))
                except ValueError:
                    return jsonify({'error': '「account_id」は数値で指定すること'}), 400
            elif username:
                account = Account.query.filter_by(username=username).first()

            if not account:
                return jsonify({'error': '対象のアカウントが見つからない'}), 404

            icon = AccountIconImage.query.filter_by(account_id=account.id).first()
            return jsonify({
                'account_id': account.id,
                'iconUrl': icon.imageUrl if icon else None
            }), 200

        icons = AccountIconImage.query.all()
        return jsonify([icon.to_dict() for icon in icons]), 200

    data = request.get_json()
    if not data:
        return jsonify({'error': 'リクエストボディが空である'}), 400

    account_id = data.get('account_id')
    image_url = data.get('iconUrl') or data.get('imageUrl') or data.get('image_path')

    if not account_id or not image_url:
        return jsonify({'error': '「account_id」と「iconUrl (imageUrl / image_path)」は必須である'}), 400

    try:
        account = db.session.get(Account, account_id)
        if not account:
            return jsonify({'error': f'ID {account_id} のアカウントが見つからない'}), 404

        _set_account_icon(account_id, image_url)
        db.session.commit()

        return jsonify({
            'message': f'ID {account_id} のアイコン画像を更新した',
            'iconUrl': image_url
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error updating account icon: {e}")
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

# POST /api/accounts : 既存アカウントのデータを変更・更新する
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

            if not account_id and not username:
                return jsonify({'error': '更新対象の「id」または「username」が必要です'}), 400

            existing_account = None
            if account_id:
                existing_account = db.session.get(Account, account_id)

            # idで見つからない場合、usernameで検索する
            if not existing_account and username:
                existing_account = Account.query.filter_by(username=username).first()

            if not existing_account:
                db.session.rollback()
                return jsonify({'error': '更新対象のアカウントが見つかりません（新規登録は /api/accounts/register を使用してください）'}), 404

            # 既存データを更新する
            if 'disp_name' in item:
                existing_account.disp_name = item.get('disp_name')
            if 'username' in item and username:
                existing_account.username = username
            if 'email' in item:
                existing_account.email = item.get('email')
            if 'password_hash' in item:
                existing_account.password_hash = item.get('password_hash')
            if 'pinColor' in item:
                existing_account.pinColor = item.get('pinColor')
            if 'textSize' in item:
                existing_account.textSize = item.get('textSize')
            if 'fontFamily' in item:
                existing_account.fontFamily = item.get('fontFamily')

            # アイコン画像の更新
            icon_url = item.get('iconUrl') or item.get('imageUrl')
            if icon_url is not None:
                _set_account_icon(existing_account.id, icon_url)

        # データベースへの変更を確定する
        db.session.commit()
        return jsonify({'message': 'アカウントの更新に成功した'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error updating accounts: {e}")
        return jsonify({'error': f'更新エラー: 入力データを確認すること。詳細: {str(e)}'}), 500

# POST /api/accounts/register : アカウントを新規作成する
@app.route(f'{BASE_PATH}/api/accounts/register', methods=['POST'])
def register_account():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'リクエストボディが空である'}), 400

    username = data.get('username')
    password = data.get('password')
    password_hash = data.get('password_hash')

    if not username or not str(username).strip():
        return jsonify({'error': '「username」は必須項目です'}), 400

    username = str(username).strip()

    if not password and not password_hash:
        return jsonify({'error': '「password」は必須項目です'}), 400

    # ユーザー名が既に使用されていないか確認
    existing_user = Account.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({'error': f'ユーザー名「{username}」は既に使用されています'}), 409

    # メールアドレスが指定されている場合の重複確認
    email = data.get('email')
    if email:
        email = str(email).strip()
        existing_email = Account.query.filter_by(email=email).first()
        if existing_email:
            return jsonify({'error': f'メールアドレス「{email}」は既に使用されています'}), 409

    # パスワードのハッシュ化（平文パスワードが渡された場合）
    if not password_hash and password:
        password_hash = hashlib.sha256(str(password).encode()).hexdigest()

    disp_name = data.get('disp_name')
    if not disp_name:
        disp_name = username

    try:
        new_account = Account(
            disp_name=disp_name,
            username=username,
            email=email if email else None,
            password_hash=password_hash,
            pinColor=data.get('pinColor', 'red'),
            textSize=data.get('textSize', 15),
            fontFamily=data.get('fontFamily', 'sans-serif')
        )
        db.session.add(new_account)
        db.session.flush()

        # アイコン画像が指定されている場合は登録
        icon_url = data.get('iconUrl') or data.get('imageUrl')
        if icon_url:
            _set_account_icon(new_account.id, icon_url)

        db.session.commit()
        return jsonify({
            'message': 'アカウントを新規作成しました',
            'account': new_account.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error registering account: {e}")
        return jsonify({'error': f'アカウント新規作成エラー: {str(e)}'}), 500


# POST/DELETE /api/accounts/delete : アカウントを削除する
@app.route(f'{BASE_PATH}/api/accounts/delete', methods=['POST', 'DELETE'])
def delete_account():
    data = request.get_json(silent=True) or {}
    account_id = data.get('id') or data.get('account_id') or request.args.get('id') or request.args.get('account_id')
    username = data.get('username') or request.args.get('username')
    password = data.get('password')

    if not account_id and not username:
        return jsonify({'error': '削除対象の「id」または「username」を指定してください'}), 400

    try:
        account = None
        if account_id:
            account = db.session.get(Account, account_id)
        if not account and username:
            account = Account.query.filter_by(username=username).first()

        if not account:
            return jsonify({'error': '指定されたアカウントが見つかりません'}), 404

        # パスワードがリクエストに含まれている場合は認証チェック
        if password:
            hashed_password = hashlib.sha256(str(password).encode()).hexdigest()
            if account.password_hash != hashed_password:
                return jsonify({'error': 'パスワードが間違っています'}), 401

        target_id = account.id

        # 関連データの連鎖削除処理
        # 1. 当該アカウントが作成した思い出 (memories) とその画像
        memories = Memory.query.filter_by(account_id=target_id).all()
        for mem in memories:
            MemoryImage.query.filter_by(memories_id=mem.id).delete()
            db.session.delete(mem)

        # 2. 当該アカウントが登録した画像
        MemoryImage.query.filter_by(account_id=target_id).delete()

        # 3. 当該アカウントのアイコン画像
        AccountIconImage.query.filter_by(account_id=target_id).delete()

        # 4. 当該アカウントのパスキー認証情報
        PasskeyCredential.query.filter_by(account_id=target_id).delete()

        # 5. アカウント本体の削除
        db.session.delete(account)
        db.session.commit()

        return jsonify({
            'message': 'アカウントを削除しました',
            'deleted_id': target_id
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error deleting account: {e}")
        return jsonify({'error': f'アカウント削除エラー: {str(e)}'}), 500


# --- WebAuthn（パスキー）関連 ---
_passkey_challenges = {}


def _get_webauthn_rp():
    """環境変数またはリクエストヘッダからWebAuthnのRP ID・Originを取得する。"""
    origin = os.environ.get('WEBAUTHN_ORIGIN') or request.headers.get('Origin') or request.host_url.rstrip('/')
    rp_id = os.environ.get('WEBAUTHN_RP_ID') or urlparse(origin).hostname or 'localhost'
    rp_name = os.environ.get('WEBAUTHN_RP_NAME', 'Sakaki Map')
    return rp_id, rp_name, origin


def _extract_challenge_from_credential(credential):
    """WebAuthnレスポンスのclientDataJSONからchallenge文字列を取り出す。"""
    client_data_b64 = credential.get('response', {}).get('clientDataJSON')
    if not client_data_b64:
        return None
    padded = client_data_b64 + '=' * (-len(client_data_b64) % 4)
    client_data = json.loads(base64.urlsafe_b64decode(padded).decode('utf-8'))
    return client_data.get('challenge')


# POST /api/accounts/passkey/register/options : パスキー登録用のチャレンジ・オプションを発行する
@app.route(f'{BASE_PATH}/api/accounts/passkey/register/options', methods=['POST'])
def passkey_register_options():
    data = request.get_json(silent=True) or {}
    account_id = data.get('account_id') or data.get('id')
    username = data.get('username')

    if not account_id and not username:
        return jsonify({'error': '「account_id」または「username」が必要です'}), 400

    account = db.session.get(Account, account_id) if account_id else Account.query.filter_by(username=username).first()
    if not account:
        return jsonify({'error': '対象のアカウントが見つかりません'}), 404

    rp_id, rp_name, _ = _get_webauthn_rp()
    existing_creds = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(p.credential_id))
        for p in account.passkeys
    ]

    options = generate_registration_options(
        rp_id=rp_id,
        rp_name=rp_name,
        user_id=str(account.id).encode('utf-8'),
        user_name=account.username,
        user_display_name=account.disp_name or account.username,
        exclude_credentials=existing_creds,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )

    challenge_b64 = bytes_to_base64url(options.challenge)
    _passkey_challenges[challenge_b64] = {
        'challenge': options.challenge,
        'account_id': account.id,
    }
    return jsonify(json.loads(options_to_json(options))), 200


# POST /api/accounts/passkey/register/verify : パスキー登録レスポンスを検証して保存する
@app.route(f'{BASE_PATH}/api/accounts/passkey/register/verify', methods=['POST'])
def passkey_register_verify():
    data = request.get_json(silent=True) or {}
    credential = data.get('credential') or data

    try:
        challenge_b64 = _extract_challenge_from_credential(credential)
    except Exception:
        return jsonify({'error': 'clientDataJSONの解析に失敗しました'}), 400

    challenge_entry = _passkey_challenges.pop(challenge_b64, None) if challenge_b64 else None
    if not challenge_entry:
        return jsonify({'error': '無効または期限切れのチャレンジです'}), 400

    account_id = data.get('account_id') or challenge_entry['account_id']
    rp_id, _, origin = _get_webauthn_rp()

    try:
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=challenge_entry['challenge'],
            expected_origin=origin,
            expected_rp_id=rp_id,
        )

        transports = credential.get('response', {}).get('transports') or credential.get('transports')
        new_passkey = PasskeyCredential(
            account_id=account_id,
            credential_id=bytes_to_base64url(verification.credential_id),
            public_key=verification.credential_public_key,
            sign_count=verification.sign_count,
            transports=json.dumps(transports) if transports else None,
        )
        db.session.add(new_passkey)
        db.session.commit()

        return jsonify({
            'message': 'パスキーを登録しました',
            'passkey': new_passkey.to_dict(),
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error verifying passkey registration: {e}")
        return jsonify({'error': f'パスキー登録検証エラー: {str(e)}'}), 400


# POST /api/accounts/passkey/login/options : パスキーログイン用のチャレンジ・オプションを発行する
@app.route(f'{BASE_PATH}/api/accounts/passkey/login/options', methods=['POST'])
def passkey_login_options():
    data = request.get_json(silent=True) or {}
    account_id = data.get('account_id') or data.get('id')
    username = data.get('username')

    allow_credentials = []
    if account_id or username:
        account = db.session.get(Account, account_id) if account_id else Account.query.filter_by(username=username).first()
        if not account:
            return jsonify({'error': '対象のアカウントが見つかりません'}), 404
        allow_credentials = [
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(p.credential_id))
            for p in account.passkeys
        ]

    rp_id, _, _ = _get_webauthn_rp()
    options = generate_authentication_options(
        rp_id=rp_id,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    challenge_b64 = bytes_to_base64url(options.challenge)
    _passkey_challenges[challenge_b64] = {'challenge': options.challenge}
    return jsonify(json.loads(options_to_json(options))), 200


# POST /api/accounts/passkey/login/verify : パスキー認証を検証してログインする
@app.route(f'{BASE_PATH}/api/accounts/passkey/login/verify', methods=['POST'])
def passkey_login_verify():
    data = request.get_json(silent=True) or {}
    credential = data.get('credential') or data
    cred_id = credential.get('id')

    if not cred_id:
        return jsonify({'error': '「credential.id」が必要です'}), 400

    try:
        challenge_b64 = _extract_challenge_from_credential(credential)
    except Exception:
        return jsonify({'error': 'clientDataJSONの解析に失敗しました'}), 400

    challenge_entry = _passkey_challenges.pop(challenge_b64, None) if challenge_b64 else None
    if not challenge_entry:
        return jsonify({'error': '無効または期限切れのチャレンジです'}), 400

    passkey = PasskeyCredential.query.filter_by(credential_id=cred_id).first()
    if not passkey:
        return jsonify({'error': '登録済みのパスキーが見つかりません'}), 404

    rp_id, _, origin = _get_webauthn_rp()

    try:
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=challenge_entry['challenge'],
            expected_rp_id=rp_id,
            expected_origin=origin,
            credential_public_key=passkey.public_key,
            credential_current_sign_count=passkey.sign_count,
        )

        passkey.sign_count = verification.new_sign_count
        db.session.commit()

        return jsonify({
            'message': 'パスキーでのログインに成功しました',
            'account': passkey.account.to_dict(),
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error verifying passkey login: {e}")
        return jsonify({'error': f'パスキー認証エラー: {str(e)}'}), 401


# GET/DELETE /api/accounts/passkey : 登録済みパスキーの一覧取得・削除
@app.route(f'{BASE_PATH}/api/accounts/passkey', methods=['GET', 'DELETE'])
def manage_passkeys():
    if request.method == 'GET':
        account_id = request.args.get('account_id') or request.args.get('id')
        username = request.args.get('username')

        if account_id or username:
            account = db.session.get(Account, int(account_id)) if account_id else Account.query.filter_by(username=username).first()
            if not account:
                return jsonify({'error': '対象のアカウントが見つかりません'}), 404
            return jsonify([p.to_dict() for p in account.passkeys]), 200

        return jsonify([p.to_dict() for p in PasskeyCredential.query.all()]), 200

    data = request.get_json(silent=True) or {}
    passkey_id = data.get('id') or request.args.get('id')
    credential_id = data.get('credential_id') or request.args.get('credential_id')

    if not passkey_id and not credential_id:
        return jsonify({'error': '削除対象の「id」または「credential_id」を指定してください'}), 400

    passkey = db.session.get(PasskeyCredential, passkey_id) if passkey_id else PasskeyCredential.query.filter_by(credential_id=credential_id).first()
    if not passkey:
        return jsonify({'error': '指定されたパスキーが見つかりません'}), 404

    try:
        db.session.delete(passkey)
        db.session.commit()
        return jsonify({'message': 'パスキーを削除しました'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'パスキー削除エラー: {str(e)}'}), 500


# --- アプリの起動 ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)