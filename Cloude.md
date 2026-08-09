# 📋 مرجع النظام الشامل — نظام الملاك الوظيفي الذكي
**MOH Auth Desktop v2 — وثيقة مرجعية لأدوات الذكاء الاصطناعي (Claude Code وغيرها)**

---

## 🗂️ جدول المحتويات
1. [نظرة عامة على المشروع](#1-نظرة-عامة-على-المشروع)
2. [المكدس التقني](#2-المكدس-التقني)
3. [هيكل المشروع](#3-هيكل-المشروع)
4. [طبقة الأمان والترخيص](#4-طبقة-الأمان-والترخيص)
5. [قاعدة البيانات](#5-قاعدة-البيانات)
6. [النواة المعالِجة (Core Processing)](#6-النواة-المعالجة)
7. [طبقة الأوامر (Tauri Commands)](#7-طبقة-الأوامر)
8. [الواجهة الأمامية](#8-الواجهة-الأمامية)
9. [الضوابط والقواعد الأساسية](#9-الضوابط-والقواعد-الأساسية)
10. [كلمات المرور ومفاتيح التشغيل](#10-كلمات-المرور-ومفاتيح-التشغيل)
11. [أوامر التطوير والتشغيل](#11-أوامر-التطوير-والتشغيل)
12. [مسارات الملفات المهمة](#12-مسارات-الملفات-المهمة)

---

## 1. نظرة عامة على المشروع

| الخاصية | القيمة |
|---------|--------|
| **اسم التطبيق** | نظام الملاك الوظيفي الذكي |
| **الجهة** | دائرة الموازنة — قسم التنسيق والإحصاء |
| **الإصدار** | 2.0.0 |
| **Product Name** | MOH-Auth-System |
| **Identifier** | `com.moh.auth` |
| **اسم الحزمة Rust** | `moh_auth_desktop_v2` |
| **المنصة المدعومة** | Windows فقط (بسبب نظام التراخيص الذي يعتمد WMI) |
| **Copyright** | © Yahya Hafedh ALsabbagh 2026 |

**الغرض:** تطبيق سطح مكتب لمعالجة وتدقيق بيانات الملاك الوظيفي للوزارات العراقية، يشمل:
- كشف التكرار في ملفات الإكسل
- التحقق من صحة العناوين والدرجات الوظيفية
- استيراد وتحليل بيانات الموظفين والإحصاءات
- لوحة تحليلية مرئية شاملة

---

## 2. المكدس التقني

### Backend (Rust + Tauri)
| المكتبة | الإصدار | الغرض |
|---------|---------|--------|
| `tauri` | 2.0.0 | إطار التطبيق |
| `duckdb` | 1.1 (bundled) | قاعدة البيانات المحلية |
| `calamine` | 0.26 | قراءة ملفات Excel |
| `rust_xlsxwriter` | 0.82 | كتابة ملفات Excel |
| `aes-gcm` | 0.10 | تشفير ملف الترخيص (AES-256-GCM) |
| `sha2` | 0.10 | توليد machine ID (SHA-256) |
| `pbkdf2` + `hmac` | 0.11 / 0.12 | اشتقاق مفتاح التشفير |
| `wmi` | 0.14 | قراءة رقم اللوحة الأم والمعالج (Windows فقط) |
| `sysinfo` | 0.39.3 | قراءة uptime لكشف التلاعب بالوقت |
| `rapidfuzz` | 0.5 | الفحص الضبابي للأسماء |
| `rayon` | 1.10 | المعالجة المتوازية |
| `regex` | 1.11 | تنظيف النصوص العربية |
| `chrono` | 0.4 | التواريخ |
| `directories` | 5.0 | مسارات AppData |
| `lazy_static` | 1.5 | البيانات الثابتة |

### Frontend (React + TypeScript)
| التقنية | الوصف |
|---------|--------|
| **React** | مع React Router v6 |
| **TypeScript** | للواجهة الكاملة |
| **Tailwind CSS** | للتصميم (مخصص مع لون navy) |
| **Recharts** | للرسوم البيانية في التحليلات |
| **Lucide React** | للأيقونات |
| **Vite** | أداة البناء |
| **Dev Port** | `http://localhost:1420` |

---

## 3. هيكل المشروع

```
d:\Programming\MOH\MOH\
├── src\                          # الواجهة الأمامية (React/TypeScript)
│   ├── App.tsx                   # المكوّن الجذري — التوجيه وحالة الصلاحيات
│   ├── main.tsx                  # نقطة الدخول
│   ├── index.css                 # CSS الأساسي
│   ├── hooks\
│   │   └── useLicense.ts         # Hook لإدارة حالة الترخيص
│   ├── components\
│   │   ├── BackdoorModal.tsx      # لوحة التحكم السرية للمطور
│   │   ├── FileUploadZone.tsx     # منطقة رفع الملفات
│   │   ├── DuplicateCheckerCard.tsx  # بطاقة كشف التكرار
│   │   ├── TitleValidatorCard.tsx    # بطاقة التحقق من العناوين
│   │   ├── SortCard.tsx           # بطاقة الفرز والتجميع
│   │   ├── SearchableCombobox.tsx # قائمة منسدلة قابلة للبحث
│   │   ├── ColumnAlignmentModal.tsx  # نافذة محاذاة الأعمدة
│   │   ├── ConflictResolution.tsx    # حل التعارضات
│   │   └── DatasetEditorModal.tsx    # نافذة تعديل مجموعة البيانات
│   └── views\
│       ├── Home.tsx               # الصفحة الرئيسية (أدوات المعالجة)
│       ├── DataCenter.tsx         # مركز إدارة البيانات (Admin فقط)
│       ├── DatabaseManager.tsx    # إدارة قاعدة البيانات
│       ├── AnalyticsDashboard.tsx # لوحة التحليلات المرئية
│       └── EmployeeManager.tsx    # إدارة الموظفين
│
├── src-tauri\                    # الخلفية (Rust)
│   ├── Cargo.toml                # التبعيات
│   ├── tauri.conf.json           # إعدادات التطبيق
│   └── src\
│       ├── main.rs               # نقطة دخول Rust
│       ├── commands.rs           # جميع أوامر Tauri المكشوفة للواجهة
│       ├── core\
│       │   ├── models.rs         # نموذج Employee
│       │   ├── cleaner.rs        # تنظيف النصوص العربية (542 سطر)
│       │   ├── validator.rs      # التحقق من العناوين الوظيفية
│       │   ├── duplicate.rs      # كشف التكرار البسيط (مطابقة تامة)
│       │   ├── fuzzy.rs          # الفحص الذكي الضبابي (RapidFuzz)
│       │   └── aggregator.rs     # التجميع والإحصاء
│       ├── database\
│       │   ├── setup.rs          # تهيئة DuckDB وجداولها
│       │   ├── queries.rs        # استعلامات البيانات الإحصائية
│       │   ├── importer.rs       # استيراد بيانات الإحصاءات من Excel
│       │   ├── exporter.rs       # تصدير البيانات إلى Excel
│       │   ├── employee_importer.rs  # استيراد بيانات الموظفين
│       │   └── employee_queries.rs   # استعلامات جدول الموظفين
│       ├── security\
│       │   └── license.rs        # نظام الترخيص الكامل
│       └── data\                 # ملفات مضمّنة في البرنامج (include_bytes!)
│           ├── job_titles.xlsx   # قائمة العناوين والدرجات الوظيفية المرجعية
│           └── Administrative_tab.xlsx  # التسلسل الهرمي للوزارات والدوائر
│
├── index.html                    # HTML الرئيسي
├── package.json                  # تبعيات Node.js
├── vite.config.ts                # إعداد Vite
├── tailwind.config.js            # إعداد Tailwind (يشمل لون navy مخصص)
└── تفاصيل.txt                   # ملاحظات المطور (أوامر وكلمات مرور)
```

---

## 4. طبقة الأمان والترخيص

> ⚠️ **هذا هو القسم الأهم في النظام. أي تعديل هنا يجب أن يكون بالغ الحذر.**

### 4.1 آلية عمل الترخيص

النظام يعتمد ترخيصاً **مرتبطاً بالجهاز** (Hardware-Locked License) يعمل عبر 4 طبقات حماية متداخلة:

```
[1] Decoy Files Check  →  [2] HWID Check  →  [3] Time Tamper Check  →  [4] Run Count / Session
```

### 4.2 Machine ID (HWID)

يُولَّد من جهاز المستخدم عبر WMI بالصيغة:
```
SHA256( BaseBoard.SerialNumber + ":" + Processor.ProcessorId )
```
- يدعم Windows فقط
- إذا فشل، يُرجع `SecurityError::UnsupportedPlatform`

### 4.3 ملف الترخيص

| الخاصية | القيمة |
|---------|--------|
| **اسم الملف** | `system.dat` |
| **المسار** | `%LOCALAPPDATA%\moh-auth-desktop-v2\system.dat` |
| **التشفير** | AES-256-GCM |
| **مفتاح التشفير** | مشتق من Machine ID عبر PBKDF2-HMAC-SHA256 (100,000 iteration) |
| **Salt الثابت** | `b"MOH::STATIC::SALT::2026"` |

**بنية بيانات الترخيص (`LicenseData`):**
```rust
pub struct LicenseData {
    pub machine_id: String,           // HWID المرتبط بالجهاز
    pub run_count: u32,               // عداد مرات التشغيل
    pub max_runs: u32,                // الحد الأقصى لمرات التشغيل
    pub max_runtime_minutes: u32,     // الحد الأقصى لدقائق الجلسة
    pub first_run_time: u64,          // وقت أول تشغيل (UNIX timestamp)
    pub last_saved_time: u64,         // آخر وقت حفظ (لكشف التلاعب)
    pub is_time_tampered: bool,       // علم التلاعب بالوقت (لا يُعاد ضبطه)
    pub is_admin_unlocked: bool,      // صلاحية مركز البيانات
    pub is_delete_unlocked: bool,     // صلاحية حذف البيانات والتعديل
    pub is_upload_unlocked: bool,     // صلاحية رفع ملفات Excel
    pub is_analytics_unlocked: bool,  // صلاحية عرض التحليلات
}
```

### 4.4 ملفات الإيهام (Decoy Files)

ملفان إضافيان يُستخدمان كطبقة تمويه:

| الملف | المسار | المحتوى عند السماح |
|-------|--------|-------------------|
| `win32_telemetry.sys` | `%APPDATA%\windows\win32_telemetry.sys` | `win32_telemetry.sys` |
| `driver_activation_log.sys` | `%APPDATA%\windows\driver_activation_log.sys` | `{"driver_log_win32": true}` |

- عند **الحجب**: يتغير محتوى `win32_telemetry.sys` إلى `BLOCKED`
- إذا غاب أحد الملفين أو كان محتواه `BLOCKED` → `SecurityError::DecoyError`
- الواجهة تعرض شاشة خطأ "Missing or Outdated Dependency" (إيهام بخطأ PyQt6)

### 4.5 كشف التلاعب بالوقت

طبقتان متوازيتان:

**أ) عند تحميل الترخيص (Static Check):**
- يقارن `SystemTime::now()` مع `last_saved_time` المخزّن في الملف
- إذا كان الوقت الحالي أقل من وقت الحفظ → تلاعب مكتشف

**ب) أثناء تشغيل التطبيق (Dynamic Check):**
- يُحسب وقت إقلاع الجهاز (`boot_time = now - uptime`) عند بدء التطبيق
- يُخزَّن كـ `EXPECTED_BOOT_TIME` (Lazy Static، غير قابل للتغيير)
- كل ثانية يُقارَن Boot Time الحالي بالمتوقع
- فارق أكثر من **10 ثوانٍ** → تلاعب مكتشف → `process::exit(0)`

**عند اكتشاف التلاعب:**
- يُكتب `is_time_tampered = true` في ملف الترخيص (دائم، لا يُمحى)
- في هذه الحالة، الكود الوحيد القادر على فك القفل هو:
  ```
  MOH::MASTER77::BACKDOOR::2026::STRONG
  ```

### 4.6 مؤقت الجلسة (Session Timer)

يعتمد على **Monotonic Clock** (`std::time::Instant`) المقاوم للتلاعب:
- لا يتأثر بتغيير ساعة الجهاز
- لا يتأثر بـ Sleep/Hibernate (لأنه monotonic وليس wall clock)
- يُهيَّأ مرة واحدة عند تشغيل التطبيق
- يراقَب كل ثانية في Thread مستقل
- عند انتهاء الجلسة → `process::exit(0)` فوري

**بنية التحقق في كل أمر:**
```rust
check_session_heartbeat().map_err(to_string_error)?;
license::verify_and_touch_license().map_err(to_string_error)?;
```

### 4.7 الصلاحيات الأربع

| الصلاحية | الحقل في LicenseData | الوظيفة |
|----------|---------------------|---------|
| **Admin** | `is_admin_unlocked` | إظهار زر مركز البيانات |
| **Upload** | `is_upload_unlocked` | رفع ملفات Excel لقاعدة البيانات |
| **Analytics** | `is_analytics_unlocked` | الوصول للوحة التحليلات |
| **Delete** | `is_delete_unlocked` | حذف وتعديل السجلات في قاعدة البيانات |

- كل صلاحية **تُخزَّن في ملف الترخيص المشفّر** وتبقى عند التجديد
- تغيير الصلاحيات يتطلب كلمة مرور المطور (لا يكفي انتهاء الجلسة)

---

## 5. قاعدة البيانات

### 5.1 المحرك

- **DuckDB** (نسخة مضمّنة - bundled)
- ملف واحد: `%APPDATA%\moh\auth\data\analytics.db`
  (المسار الفعلي مثلاً: `C:\Users\<username>\AppData\Roaming\moh\auth\data\analytics.db`)
- حماية بـ `Mutex<()>` (`DB_LOCK`) لمنع الوصول المتزامن

### 5.2 الجداول

**أ) `department_metrics` — بيانات الإحصاءات الوظيفية:**
```sql
CREATE TABLE department_metrics (
    id BIGINT PRIMARY KEY DEFAULT nextval('seq_department_metrics_id'),
    ministry VARCHAR,           -- اسم الوزارة
    directorate VARCHAR,        -- اسم الدائرة/التشكيل
    approval_year INTEGER,      -- سنة الاعتماد
    job_title VARCHAR,          -- العنوان الوظيفي
    job_grade VARCHAR,          -- الدرجة الوظيفية
    job_code VARCHAR,           -- الرمز الوظيفي
    male_count INTEGER,         -- عدد الذكور
    female_count INTEGER,       -- عدد الإناث
    vacant_count INTEGER,       -- عدد الشواغر
    total_count INTEGER,        -- المجموع
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**ب) `employees_master` — سجل الموظفين المركزي:**
```sql
CREATE TABLE employees_master (
    id BIGINT PRIMARY KEY DEFAULT nextval('seq_employees_master_id'),
    ministry VARCHAR NOT NULL,
    directorate VARCHAR NOT NULL,
    approval_year INTEGER NOT NULL,
    row_number INTEGER,
    original_name VARCHAR NOT NULL,     -- الاسم الأصلي
    normalized_name VARCHAR NOT NULL,   -- الاسم المُطبَّع للبحث
    audit_status VARCHAR DEFAULT 'Valid',
    data_columns VARCHAR,               -- JSON لباقي أعمدة البيانات
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**ج) `hierarchy_lookup` — التسلسل الهرمي:**
```sql
CREATE TABLE hierarchy_lookup (
    ministry_code INTEGER,
    ministry_name VARCHAR,
    dept_code INTEGER,
    dept_name VARCHAR
)
```
- يُملأ تلقائياً من ملف `Administrative_tab.xlsx` المُضمَّن في البرنامج
- يُعاد إنشاؤه عند كل تشغيل (`DROP TABLE IF EXISTS` ثم `CREATE`)

**د) `employee_column_registry` — سجل أسماء الأعمدة المعروفة:**
```sql
CREATE TABLE employee_column_registry (
    column_name VARCHAR PRIMARY KEY,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### 5.3 قواعد الاستعلام المهمة

- استعلامات `department_metrics` تستثني صفوف المجاميع تلقائياً:
```sql
WHERE (job_title NOT LIKE 'مجموع %' AND job_title NOT LIKE 'المجموع %'
   AND job_title != 'المجموع' AND job_title NOT LIKE '%مجموع كلي%'
   AND job_title NOT LIKE '%مجموع الدرجة%' AND job_title NOT LIKE '%مجموع درجة%')
```
- الباب **43** في `hierarchy_lookup` له معالجة خاصة: كل صف كيان مستقل بكود اصطناعي `(dept_code * 100 + 43)`

---

## 6. النواة المعالجة

### 6.1 `cleaner.rs` — تنظيف النصوص العربية

الوحدة الأكبر والأهم للمعالجة. تحتوي على Regex patterns لعشرات حالات التطبيع:
- تطبيع همزة الألف (`أ، إ، آ` → `ا`)
- إزالة المسافات الزائدة
- توحيد كلمة "رئيس" بمتغيراتها
- توحيد مئات الكلمات الوظيفية بتهجياتها المختلفة (تقني، معلومات، كيمياء، فيزياء، إحصاء...)
- دوالها الرئيسية:
  - `clean_job_title_column()` — تنظيف عمود العنوان الوظيفي
  - `clean_job_grade_column()` — تنظيف عمود الدرجة الوظيفية
  - `normalize_arabic_name()` — تطبيع اسم الموظف للبحث

### 6.2 `validator.rs` — التحقق من العناوين

- يقرأ ملف `job_titles.xlsx` المُضمَّن عبر `include_bytes!`
- الأعمدة المتوقعة في الملف المرجعي: `العنوان الوظيفي`, `الدرجة الوظيفية`, `الرمز الوظيفي`
- يُنتج ملف Excel مُلوَّن يُظهر حالة كل عنوان (صحيح/خاطئ/غير موجود)

### 6.3 `duplicate.rs` — كشف التكرار البسيط

- مطابقة تامة بعد التطبيع
- يُنتج ملف Excel بقوائم التكرار

### 6.4 `fuzzy.rs` — الفحص الذكي الضبابي

يستخدم **RapidFuzz** مع معالجة متوازية عبر **Rayon**:
- **التكرار التام (Exact):** أسماء متطابقة 100% بعد التطبيع
- **التشابه الضبابي (Fuzzy):** عتبة قابلة للتخصيص (افتراضي 80%، النطاق 50%-99%)
- أنواع التطابق: `تشابه عالي جداً` / `تشابه عالي` / `تشابه متوسط`

```rust
pub struct SmartScanResult {
    pub total_rows: usize,
    pub exact_duplicates: Vec<ExactDuplicateGroup>,
    pub fuzzy_matches: Vec<FuzzyMatchResult>,
    pub scan_duration_ms: u64,
}
```

### 6.5 `aggregator.rs` — التجميع

يُجمِّع بيانات الإكسل ويُنتج إحصاءات مُدمَجة.

---

## 7. طبقة الأوامر

جميع الأوامر في `commands.rs` تُكشف للواجهة عبر `tauri::generate_handler!`

### 7.1 أوامر الترخيص

| الأمر | الوصف |
|-------|--------|
| `get_license_status` | يُرجع حالة الترخيص الكاملة (يُستدعى عند البدء وكل 30 ثانية) |
| `renew_license_backdoor` | يُجدِّد الترخيص بكلمة المرور + عدد التشغيلات + وقت الجلسة |

### 7.2 أوامر الصلاحيات

| الأمر | يتطلب كلمة مرور | الوصف |
|-------|----------------|--------|
| `toggle_admin_status` | `MASTER` أو `MASTER77` | تشغيل/إيقاف صلاحية Admin |
| `get_admin_status` | لا | قراءة حالة Admin |
| `toggle_delete_status` | `MASTER` فقط | تشغيل/إيقاف صلاحية الحذف |
| `get_delete_status` | لا | قراءة حالة الحذف |
| `toggle_upload_status` | `MASTER` فقط | تشغيل/إيقاف صلاحية الرفع |
| `get_upload_status` | لا | قراءة حالة الرفع |
| `toggle_analytics_status` | `MASTER` فقط | تشغيل/إيقاف صلاحية التحليلات |
| `get_analytics_status` | لا | قراءة حالة التحليلات |

### 7.3 أوامر معالجة الملفات

| الأمر | الوصف |
|-------|--------|
| `read_excel_headers` | قراءة أسماء الأعمدة من ملف Excel |
| `run_duplicate_check` | كشف التكرار البسيط (مطابقة تامة) |
| `run_title_validation` | التحقق من العناوين والدرجات الوظيفية |
| `run_aggregation` | تجميع البيانات وإنتاج إحصاءات |
| `run_smart_duplicate_scan` | الفحص الضبابي الذكي للأسماء |
| `export_smart_scan_excel` | تصدير نتائج الفحص الضبابي |
| `get_reference_data` | إرجاع قائمة العناوين الوظيفية المرجعية |

### 7.4 أوامر قاعدة البيانات (الإحصاءات)

| الأمر | يتحقق من الجلسة | يتحقق من الصلاحية |
|-------|----------------|------------------|
| `import_data_to_db` | ✅ | — (الواجهة تخفي التبويب بدون Upload) |
| `fetch_all_metrics` | ✅ | — |
| `fetch_kpi_summary` | ✅ | — |
| `fetch_filter_options` | ✅ | — |
| `fetch_filtered_analytics` | ✅ | — |
| `fetch_database_summary` | ❌ | — |
| `delete_dataset` | ❌ | Delete |
| `fetch_hierarchy_options` | ❌ | — |
| `fetch_dataset_details` | ✅ | — |
| `update_dataset_records` | ✅ | Delete |
| `export_dataset_to_excel` | ✅ | — |

### 7.5 أوامر إدارة الموظفين

| الأمر | يتحقق من الجلسة | يتحقق من الصلاحية |
|-------|----------------|------------------|
| `import_employees_to_db` | ✅ | — |
| `align_employee_columns` | ❌ | — |
| `fetch_employees_summary` | ❌ | — |
| `fetch_employee_details` | ✅ | — |
| `fetch_employee_columns` | ❌ | — |
| `delete_employee_dataset` | ❌ | Delete |
| `export_employees_to_excel` | ✅ | — |
| `search_employees_globally` | ✅ | — |

---

## 8. الواجهة الأمامية

### 8.1 مسارات التطبيق (Routes)

| المسار | المكوّن | الوصول |
|--------|---------|--------|
| `/` | `Home` | متاح للجميع (بعد فتح الترخيص) |
| `/data-center` | `DataCenter` | يتطلب `isAdminUnlocked = true` |

### 8.2 `App.tsx` — المكوّن الجذري

**الحالات الرئيسية:**
1. **Loading:** عرض دوّامة تحميل أثناء استعلام الترخيص
2. **Locked (`isLocked = true`):** عرض شاشة "Missing or Outdated Dependency" (إيهام)
3. **Main App:** الواجهة الكاملة مع شريط العنوان المخصص

**الحالات الممررة لـ DataCenter:**
```tsx
<DataCenter
  isDeleteUnlocked={isDeleteUnlocked}
  isUploadUnlocked={isUploadUnlocked}
  isAnalyticsUnlocked={isAnalyticsUnlocked}
/>
```

### 8.3 `useLicense.ts` — Hook الترخيص

- يُستدعى `get_license_status` عند البدء
- يُعاد الاستعلام كل **30 ثانية** (`POLL_INTERVAL_MS = 30_000`)
- يُخزَّن Machine ID في `localStorage` تحت المفتاح `moh_machine_id_cache`

### 8.4 `BackdoorModal.tsx` — لوحة التحكم السرية

**طريقة الفتح:** `Ctrl + Shift + Alt + 9`

**الوظائف:**
1. تبديل صلاحية Admin (تتطلب كلمة مرور)
2. تبديل صلاحية رفع البيانات (تتطلب كلمة مرور)
3. تبديل صلاحية التحليلات (تتطلب كلمة مرور)
4. تبديل صلاحية الحذف (تتطلب كلمة مرور)
5. تجديد الترخيص (كلمة مرور + عدد تشغيلات + دقائق الجلسة)

### 8.5 `DataCenter.tsx` — مركز البيانات

**التبويبات الأربعة (ديناميكية حسب الصلاحيات):**

| التبويب | الوصف | يظهر عند تفعيل |
|---------|-------|----------------|
| `upload` | رفع ملفات Excel لقاعدة البيانات | `isUploadUnlocked` |
| `analytics` | لوحة التحليلات المرئية | `isAnalyticsUnlocked` |
| `manage` | إدارة قاعدة البيانات (حذف/تعديل) | `isDeleteUnlocked` |
| `employees` | إدارة بيانات الموظفين | `isUploadUnlocked` |

> التبويبات تُفلتر ديناميكياً — فقط التبويبات التي تتوفر صلاحيتها تظهر.

**نوعا الملفات المدعومة في تبويب الرفع:**
- `statistics` — بيانات الإحصاءات (الملاك الوظيفي بتنسيق الجداول)
- `employees` — بيانات الموظفين (قائمة بأسمائهم وبياناتهم)

### 8.6 `AnalyticsDashboard.tsx` — التحليلات

يعرض:
- KPIs: إجمالي الذكور، الإناث، الشواغر، المجموع
- Pie Chart: توزيع الجنس
- Bar Charts: توزيع الدرجات والجنس حسب العنوان
- جدول بيانات مفصّل مع فلترة وبحث وترقيم صفحات

### 8.7 `EmployeeManager.tsx` — إدارة الموظفين

- عرض ملخص الدفعات المستوردة (وزارة / دائرة / سنة / عدد)
- عرض تفصيلي مع ترقيم صفحات وبحث
- كشف الأسماء المكررة داخل الدفعة
- تصدير إلى Excel
- حذف دفعة كاملة (يتطلب Delete)
- بحث عالمي عبر جميع الوزارات

---

## 9. الضوابط والقواعد الأساسية

### ⛔ قواعد النظام (لا يجوز المساس بها)

1. **نظام الترخيص لا يُلغى ولا يُتجاوز أبداً** — كل أمر يحتاج للتحقق من الجلسة والترخيص قبل التنفيذ.

2. **ملف `system.dat` مشفّر بمفتاح مشتق من HWID** — لا يمكن نقله لجهاز آخر، لا يمكن فك تشفيره بدون نفس الجهاز.

3. **علم `is_time_tampered` لا يُعاد ضبطه بكلمة المرور العادية** — يُعاد الضبط فقط بـ `MOH::MASTER77::BACKDOOR::2026::STRONG`.

4. **الصلاحيات الأربع تُخزَّن في الترخيص وتبقى عند التجديد** — `initialize_license()` يحافظ على الصلاحيات الموجودة.

5. **قاعدة البيانات تحت قفل Mutex** — استخدام `DB_LOCK` دائماً في أي وصول جديد.

6. **جدول `hierarchy_lookup` يُعاد إنشاؤه دائماً** (`DROP TABLE IF EXISTS`) عند كل تشغيل.

7. **الملفات المضمّنة (`job_titles.xlsx`, `Administrative_tab.xlsx`) مضمّنة عبر `include_bytes!`** — لا يمكن تحديثها بدون إعادة بناء البرنامج.

8. **التطبيق لا يعمل خارج Windows** — WMI مطلوب لتوليد HWID.

9. **نافذة التطبيق بلا إطار نظام تشغيل** (`decorations: false`) — يستخدم title bar مخصص مع `data-tauri-drag-region`.

10. **شريط العنوان يُخفى عند الطباعة** (`print:hidden`) — الواجهة مهيأة للطباعة بـ CSS خاص.

### ✅ أنماط البرمجة المتبعة

- **Tauri invoke:** كل استدعاء للـ backend يُمرَّر عبر `invoke<ReturnType>("command_name", { ...params })`
- **camelCase في الأوامر:** الأوامر التي تستقبل معاملات تُضاف لها `#[tauri::command(rename_all = "camelCase")]`
- **أعمدة data_columns في employees_master:** تُخزَّن كـ JSON string، وتُفكَّك في الواجهة
- **فلترة المجاميع:** عند عرض `department_metrics` يجب دائماً فلترة صفوف "مجموع" (الاستعلام موجود في `queries.rs:fetch_all_metrics`)
- **RTL:** الواجهة بالكامل `dir="rtl"` — أي مكوّن جديد يجب أن يحترم هذا الاتجاه
- **Font:** `font-cairo` هو الخط الافتراضي للعربية

---

## 10. كلمات المرور ومفاتيح التشغيل

| الكود | الاستخدام |
|-------|-----------|
| `MOH::MASTER::BACKDOOR::2026::STRONG` | كلمة المرور الرئيسية — تُجدِّد الترخيص، تُبدِّل جميع الصلاحيات |
| `MOH::MASTER77::BACKDOOR::2026::STRONG` | كلمة المرور القوية — تعمل حتى لو كان `is_time_tampered = true`، تُجدِّد الترخيص |
| `MOH::MASTER777::BACKDOOR2018::2026::STRONG_0` | **غير مستخدم في الكود** — مُدرَج فقط في `تفاصيل.txt` كملاحظة |
| `4CPRK-NM3K3-X6XXQ-RXX86-WXCHW` | كلمة مرور بديلة (تعمل فقط في الحالة العادية غير المُلاعَب بها) |

> **ملاحظة:** `toggle_admin_status` يقبل `MASTER` و`MASTER77` فقط (لا MASTER777).
> `toggle_delete/upload/analytics_status` يقبل `MASTER` فقط.

---

## 11. أوامر التطوير والتشغيل

```powershell
# تشغيل التطبيق في وضع التطوير
cmd /c "npm run tauri dev"

# إيقاف عمليات Cargo المتراكمة
taskkill /F /IM cargo.exe

# بناء التطبيق للإنتاج
npm run tauri build
```

---

## 12. مسارات الملفات المهمة

| الملف | المسار الكامل |
|-------|--------------|
| **ملف الترخيص** | `%LOCALAPPDATA%\moh-auth-desktop-v2\system.dat` |
| **Decoy 1** | `%APPDATA%\windows\win32_telemetry.sys` |
| **Decoy 2** | `%APPDATA%\windows\driver_activation_log.sys` |
| **قاعدة البيانات** | `C:\Users\<user>\AppData\Roaming\moh\auth\data\analytics.db` |

---

## 📌 ملاحظات للمطور

1. **عند إضافة أمر جديد:** يجب تسجيله في `tauri::generate_handler![...]` داخل `main.rs`.

2. **عند إضافة حقل لـ `LicenseData`:** أضف `#[serde(default)]` للحقول الجديدة لضمان التوافق مع الملفات القديمة.

3. **البيانات المُضمَّنة (`include_bytes!`):** تعيش في `src-tauri/data/` وتُضمَّن وقت الترجمة — أي تحديث يتطلب إعادة `cargo build`.

4. **اللغة العربية في Regex:** الكلمات محددة بـ `\b` (word boundary) — تأكد من أن المحرك يدعمها مع اليونيكود عند إضافة patterns جديدة.

5. **DuckDB vs SQLite:** النظام يستخدم DuckDB وليس SQLite — الـ API مختلف قليلاً، استخدم `duckdb::Connection` وليس `rusqlite`.

6. **الطباعة:** الصفحات تعتمد `print:` Tailwind utility للتخفي/الظهور عند الطباعة — احرص عليها في أي مكوّن جديد.

7. **`decorations: false`:** نافذة بدون إطار — أي drag يجب أن يكون على عناصر تحمل `data-tauri-drag-region`.

---

*آخر تحديث: 2026-08-10 | المطور: Yahya Hafedh ALsabbagh*

