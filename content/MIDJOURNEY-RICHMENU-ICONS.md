# 🎨 Midjourney Prompts — ไอคอน Rich Menu (6 ปุ่ม)

> ธีม: royal purple + gold, luxury, mystical. ทุกอันเป็น **ไอคอนเดี่ยว สี่เหลี่ยมจัตุรัส** ใช้วางในการ์ดปุ่ม
> เป้าหมาย: ได้ชุดไอคอนที่ **สไตล์เดียวกันทั้ง 6** → ตัดพื้นหลังออกแล้ว composite ทับนีบิวลาใน `richmenu.svg`

## ⚙️ วิธีให้ออกมาเป็น "ชุดเดียวกัน" (สำคัญ)
1. รันอันที่ 1 ก่อน เลือกอันที่ชอบ → คลิกขวา **`Use as Style Reference`** ได้ค่า `--sref XXXXXX`
2. เอา `--sref XXXXXX` เดิม ต่อท้าย **ทั้ง 6 prompt** → ไอคอนจะสไตล์ตรงกัน
3. ทุก prompt ลงท้าย `--ar 1:1 --v 7 --style raw` แล้ว
4. อยากตัดพื้นหลังง่าย: เปลี่ยน `flat deep purple background` เป็น `plain solid white background` แล้วใช้ remove.bg / Photoshop ตัด

---

## 1️⃣ ดูดวงวันนี้ — จันทร์เสี้ยว + ดาว
```
luxury app icon, a single elegant golden crescent moon with one bright star nestled in its cradle, polished gold gradient with soft inner glow, minimalist symmetrical emblem, flat deep royal-purple background, subtle sparkle dust, premium mystical astrology brand, clean 3D vector style, soft studio lighting, centered, lots of negative space --ar 1:1 --v 7 --style raw
```

## 2️⃣ พื้นดวงของฉัน — ดวงอาทิตย์ / จักรราศี
```
luxury app icon, a radiant golden sun emblem with refined triangular rays and a thin outer ring, polished gold gradient, minimalist symmetrical, flat deep royal-purple background, faint zodiac wheel detail, soft glow, premium mystical astrology brand, clean 3D vector style, centered, negative space --ar 1:1 --v 7 --style raw
```

## 3️⃣ ไพ่ทาโรต์ — ไพ่
```
luxury app icon, three elegant tarot cards fanned out, golden ornate borders with a glowing star symbol on the center card, polished gold gradient, minimalist, flat deep royal-purple background, soft sparkle, premium mystical fortune-teller brand, clean 3D vector style, centered, negative space --ar 1:1 --v 7 --style raw
```

## 4️⃣ ผูกดวงคู่ — หัวใจคู่ / จันทร์คู่
```
luxury app icon, two interlocked golden hearts connected by a delicate thread of tiny stars, polished gold gradient with soft pink-gold glow, minimalist romantic emblem, flat deep royal-purple background, gentle sparkle, premium mystical astrology brand, clean 3D vector style, centered, negative space --ar 1:1 --v 7 --style raw
```

## 5️⃣ สมัคร / ต่ออายุ — เพชร / อัญมณี
```
luxury app icon, a single faceted golden gemstone diamond with luminous facets and a soft star glint, polished gold gradient, minimalist symmetrical, flat deep royal-purple background, subtle sparkle, premium luxury brand, clean 3D vector style, centered, negative space --ar 1:1 --v 7 --style raw
```

## 6️⃣ โปรไฟล์ของฉัน — คน / ดวงส่วนตัว
```
luxury app icon, a simple elegant golden person silhouette inside a soft glowing circle, polished gold gradient, minimalist symmetrical emblem, flat deep royal-purple background, faint constellation dots, soft glow, premium mystical astrology brand, clean 3D vector style, centered, negative space --ar 1:1 --v 7 --style raw
```

---

## หลัง gen เสร็จ
- เซฟไฟล์เป็น `icon-daily.png`, `icon-natal.png`, `icon-tarot.png`, `icon-couple.png`, `icon-signup.png`, `icon-profile.png`
- ตัดพื้นหลังออก (PNG โปร่ง) วางใน `richmenu/icons/`
- บอกผม → ผมแก้ `build-richmenu.js` ให้ composite ไอคอน PNG แทนไอคอน SVG เดิม (วางตรง tap zone เป๊ะ)
