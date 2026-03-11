# سجل التناقضات التقنية (Contradiction Log)

## 1. AMEEN AI (Dependency: Azure)
- **المشكلة:** الاعتماد الكلي في README وعمليات الـ CI/CD على Azure Static Web Apps.
- **الملفات المتأثرة:** `ui/ameen/README.md`, `ui/ameen/.github/workflows/azure-swa.yml`.
- **الحل المستقبلي:** استبدال Azure بـ Docker + Nginx للاستضافة الذاتية.

## 2. Haven (Dependency: Gemini/HuggingFace)
- **المشكلة:** الكود يعتمد بشكل أساسي على Google Gemini و HuggingFace كـ Default Providers.
- **الملفات المتأثرة:** `apps/haven/index.html`, `apps/haven/README.md`.
- **الحل المستقبلي:** جعل Ollama هو الخيار الافتراضي (Default) وتحويل الـ Cloud Providers إلى "إضافات اختيارية".

## 3. التسويق مقابل الواقع
- **الادعاء:** "محلي 100%" في بعض الصفحات.
- **الواقع:** وجود طلبات Fetch مباشرة لـ `generativelanguage.googleapis.com`.
