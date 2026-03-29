from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import SessionLocal, engine, wait_for_db
from app.models.location import Location
from app.models.user import User


REAL_LOCATIONS = [
    {
        "name": "大落水村",
        "description": "泸沽湖开发较早的村落，保留摩梭传统聚落形态，可体验猪槽船与篝火晚会。",
        "audio_url": "",
        "latitude": 27.6868,
        "longitude": 100.7902,
        "category": "culture",
        "qr_code_url": "/qrcodes/daluoshui.png",
    },
    {
        "name": "里格半岛",
        "description": "泸沽湖标志性半岛景观，适合观湖日出与环湖步行，兼具自然与人文体验。",
        "audio_url": "",
        "latitude": 27.7248,
        "longitude": 100.7752,
        "category": "nature",
        "qr_code_url": "/qrcodes/lige.png",
    },
    {
        "name": "走婚桥",
        "description": "位于草海区域的木桥，是摩梭走婚文化的重要象征地标。",
        "audio_url": "",
        "latitude": 27.7172,
        "longitude": 100.7819,
        "category": "culture",
        "qr_code_url": "/qrcodes/zouhunqiao.png",
    },
    {
        "name": "草海",
        "description": "高原湿地景观区，芦苇繁茂，适合清晨和傍晚观景与拍摄。",
        "audio_url": "",
        "latitude": 27.7206,
        "longitude": 100.7834,
        "category": "nature",
        "qr_code_url": "/qrcodes/caohai.png",
    },
    {
        "name": "格姆女神山",
        "description": "摩梭人心中的神山，可乘索道登高俯瞰泸沽湖全景。",
        "audio_url": "",
        "latitude": 27.7442,
        "longitude": 100.8084,
        "category": "nature",
        "qr_code_url": "/qrcodes/gemu.png",
    },
    {
        "name": "情人滩",
        "description": "湖岸线平缓开阔，黄昏光线柔和，是热门旅拍点位。",
        "audio_url": "",
        "latitude": 27.6999,
        "longitude": 100.7736,
        "category": "nature",
        "qr_code_url": "/qrcodes/qingrentan.png",
    },
    {
        "name": "女神湾",
        "description": "以日落景色闻名，湖面开阔，适合静态观景与慢节奏停留。",
        "audio_url": "",
        "latitude": 27.7094,
        "longitude": 100.7326,
        "category": "nature",
        "qr_code_url": "/qrcodes/nvshenwan.png",
    },
]


def run_seed() -> None:
    wait_for_db(max_attempts=30, delay_seconds=2.0)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            db.add(
                User(
                    username="admin",
                    password_hash=get_password_hash("admin123"),
                    role="admin",
                )
            )

        for item in REAL_LOCATIONS:
            exists = db.query(Location).filter(Location.name == item["name"]).first()
            if not exists:
                db.add(Location(**item))

        db.commit()
        print("Seed completed")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
