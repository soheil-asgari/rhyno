import os
import re
import pandas as pd
import uvicorn
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from io import BytesIO, StringIO
from openai import OpenAI
import base64

# --- تنظیمات ---
# کلید API خود را اینجا بگذارید یا در فایل .env کنار همین فایل قرار دهید
OPENROUTER_API_KEY = "sk-or-v1-......"  # <--- کلید خود را اینجا بگذارید

app = FastAPI()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
    default_headers={"HTTP-Referer": "https://rhyno.ir", "X-Title": "Rhyno"},
)


class OcrResponse(BaseModel):
    success: bool
    data: dict = None
    error: str = None


def clean_number(val):
    """تبدیل رشته به عدد تمیز (حذف کاما و حروف)"""
    if pd.isna(val) or str(val).strip() in ["", "-", "null", "None"]:
        return 0
    s = str(val).replace(",", "").replace("،", "")
    s = re.sub(r"[^\d.-]", "", s)
    try:
        return float(s)
    except:
        return 0


def detect_columns_logic(df):
    """
    تشخیص هوشمند ستون‌ها با تست ریاضی و منطق
    """
    # تبدیل همه ستون‌ها به عدد برای تست
    num_df = df.copy()
    for col in num_df.columns:
        num_df[col] = num_df[col].apply(clean_number)

    cols = df.columns.tolist()
    col_deposit = None
    col_withdraw = None
    col_desc = None

    # 1. پیدا کردن ستون شرح (معمولاً طولانی‌ترین متن را دارد)
    try:
        col_desc = max(cols, key=lambda c: df[c].astype(str).str.len().mean())
    except:
        col_desc = cols[2] if len(cols) > 2 else None

    # 2. پیدا کردن ستون‌های واریز و برداشت
    # روش: اگر 3 ستون عددی داشتیم -> [برداشت، واریز، مانده] یا [واریز، برداشت، مانده]
    # اگر 2 ستون عددی داشتیم -> [برداشت، واریز] (مانده ندارد)

    numeric_cols = []
    for col in cols:
        if num_df[col].sum() > 0 and col != col_desc:
            numeric_cols.append(col)

    # اگر فقط یک ستون مبلغ داریم (مثل فایل بانک ملی شما که قاطی کرده بود)
    # این کد پایتون آن را هندل نمی‌کند مگر اینکه ستون بدهکار/بستانکار جدا باشند.
    # اما اگر جدا باشند، پانداس عالی عمل می‌کند.

    # فرض استاندارد بانک‌های ایرانی: معمولاً ترتیب: برداشت | واریز | مانده
    # یا: بدهکار | بستانکار | مانده

    # تلاش برای مپ کردن از روی اسم ستون (اگر AI هدر را درست برگردانده باشد)
    for col in cols:
        c_low = col.lower()
        if "bed" in c_low or "with" in c_low or "بدهکار" in c_low or "برداشت" in c_low:
            col_withdraw = col
        if "bes" in c_low or "dep" in c_low or "بستانکار" in c_low or "واریز" in c_low:
            col_deposit = col

    # اگر از روی اسم پیدا نشد، از روی ایندکس (از آخر به اول)
    if not col_deposit or not col_withdraw:
        # معمولا مانده آخرین ستون عددی است، آن را نادیده می‌گیریم
        if len(numeric_cols) >= 3:
            # numeric_cols[-1] = مانده
            col_deposit = numeric_cols[-2]
            col_withdraw = numeric_cols[-3]
        elif len(numeric_cols) == 2:
            col_deposit = numeric_cols[-1]
            col_withdraw = numeric_cols[-2]

    return col_deposit, col_withdraw, col_desc


@app.post("/ocr", response_model=OcrResponse)
async def process_image(file: UploadFile = File(...)):
    try:
        content = await file.read()
        base64_image = base64.b64encode(content).decode("utf-8")
        data_url = f"data:image/jpeg;base64,{base64_image}"

        # درخواست به AI برای تبدیل تصویر به CSV (بدون هیچ پردازشی، فقط دیدن)
        response = client.chat.completions.create(
            model="google/gemini-2.5-pro",
            messages=[
                {
                    "role": "system",
                    "content": """You are a perfect OCR machine. 
Output the table in CSV format using pipe '|' separator.
INCLUDE ALL COLUMNS VISIBLE (Date, Time, Desc, Debit, Credit, Balance, Tracking).
Do not merge rows. Do not calculate. Just transcribe.""",
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Transcribe to CSV (pipe separated)."},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
            temperature=0,
        )

        csv_text = response.choices[0].message.content
        # تمیز کردن خروجی مارک‌داون
        lines = [line for line in csv_text.split("\n") if "|" in line]
        clean_csv = "\n".join(lines)

        # تبدیل به جدول پانداس (اینجاست که ستون‌ها مرتب می‌شوند)
        df = pd.read_csv(StringIO(clean_csv), sep="|", engine="python")
        df.columns = [c.strip() for c in df.columns]
        df = df.dropna(axis=1, how="all").dropna(how="all")

        # تشخیص ستون‌ها
        col_dep, col_with, col_desc = detect_columns_logic(df)

        # پیدا کردن ستون تاریخ و رهگیری
        # تاریخ معمولاً اولین ستون است
        col_date = df.columns[0] if len(df.columns) > 0 else None
        # رهگیری معمولاً آخرین ستون است (اگر مانده نباشد) یا بعد از مانده
        # یک منطق ساده: ستونی که شامل "کد" یا "track" باشد یا آخرین ستون
        col_track = df.columns[-1]

        final_txs = []
        for _, row in df.iterrows():
            d_amt = clean_number(row[col_dep]) if col_dep else 0
            w_amt = clean_number(row[col_with]) if col_with else 0

            # لاجیک حذف ردیف مانده (اگر هوش مصنوعی اشتباها ردیف مانده اول دوره را آورده بود)
            if d_amt == 0 and w_amt == 0:
                continue

            tx_type = "withdrawal"
            amount = 0

            if d_amt > 0:
                tx_type = "deposit"
                amount = d_amt
            elif w_amt > 0:
                tx_type = "withdrawal"
                amount = w_amt

            desc_val = str(row[col_desc]) if col_desc else ""

            # --- قانون امین امین نیا (تنخواه) در سمت پایتون (اختیاری) ---
            # اگر می‌خواهید همینجا تگ بزنید

            final_txs.append(
                {
                    "date": str(row[col_date]).strip(),
                    "time": "00:00",  # اگر ستون زمان پیدا نشد
                    "description": desc_val,
                    "amount": amount,
                    "type": tx_type,
                    "tracking_code": str(row[col_track]).strip(),
                }
            )

        return OcrResponse(success=True, data={"transactions": final_txs})

    except Exception as e:
        return OcrResponse(success=False, error=str(e))


if __name__ == "__main__":
    # سرور روی پورت 8005 اجرا می‌شود
    uvicorn.run(app, host="0.0.0.0", port=8005)
