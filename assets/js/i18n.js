/**
 * BAITUL MANAL — Internationalization (i18n) & RTL Engine
 */

const translations = {
  en: {
    badge_exclusive: "EXCLUSIVE",
    badge_visit: "VISIT US",
    badge_new: "NEW ARRIVALS",
    announcement_1: "Free delivery across Kuwait on orders above KD 20",
    announcement_2: "Shop 133 & 134, Fahaheel Bazar, Kuwait",
    announcement_3: "Latest Women's Darra & Kids Collection in stock",
    nav_women: "Women",
    nav_girls: "Girls",
    nav_boys: "Boys",
    nav_baby: "Baby",
    nav_maid: "Maid Uniform",
    nav_offers: "Offers",
    nav_account: "My Account",
    nav_track: "Track Order",
    nav_home: "Home",
    nav_shop: "Shop",
    nav_wishlist: "Wishlist",
    hero_title: "Elegance Tailored for You",
    hero_subtitle: "Kuwait's premier collection for Women, Kids, and Essentials.",
    hero_slide1_tag: "NEW ARRIVALS",
hero_slide1_title: "The Elegant Darra Collection",
hero_slide1_desc: "Crafted for comfort, styled for luxury.",
btn_shop_now: "Shop Collection",
hero_slide2_tag: "LITTLE ONES",
hero_slide2_title: "Premium Kids & Baby Wear",
hero_slide2_desc: "100% breathable organic cotton for ultimate care.",
btn_shop_kids: "Explore Kids",
hero_slide3_tag: "SPECIALTY WORKWEAR",
hero_slide3_title: "Durable & Neat Maid Uniforms",
hero_slide3_desc: "Kuwait's trusted supplier of all standard sizes.",
btn_shop_maid: "View Uniforms",
cat_curated: "CURATED ESSENTIALS",
cat_explore: "Shop By Category",
cat_explore_action: "Explore →",
view_all_cat: "All Collections",
tag_featured: "HANDPICKED",
title_featured: "Featured Arrivals",
view_all: "View All",
badge_sale: "SALE",
badge_new_pill: "NEW",
tag_arrivals: "CURATED DROPS",
title_arrivals: "New In Store",
filter_all: "All",
btn_explore_all: "Explore Entire Collection",
qa_select_size: "Select Size",
qa_select_color: "Select Color",
qa_quantity: "Quantity",
btn_add_to_cart: "Add To Cart",
drawer_cart_title: "Your Shopping Bag",
cart_subtotal: "Subtotal",
cart_delivery_note: "Shipping & duties calculated at checkout.",
btn_view_cart: "View Full Bag",
btn_checkout: "Proceed to Checkout",
free_shipping_reached: "Congratulations! Free delivery unlocked 🎉",
add_more_for_free: "Add KD {amount} more for free delivery",
  },
  ar: {
    badge_exclusive: "حصرياً",
    badge_visit: "زورونا",
    badge_new: "وصل حديثاً",
    announcement_1: "توصيل مجاني لجميع مناطق الكويت للطلبات الأكثر من 20 د.ك",
    announcement_2: "محل رقم 133 و 134، سوق الفحيحيل، الكويت",
    announcement_3: "أحدث تشكيلات الدراريع النسائية وملابس الأطفال متوفرة الآن",
    nav_women: "النساء",
    nav_girls: "البنات",
    nav_boys: "الأولاد",
    nav_baby: "الأطفال",
    nav_maid: "يونيفورم",
    nav_offers: "العروض",
    nav_account: "حسابي",
    nav_track: "تتبع الطلب",
    nav_home: "الرئيسية",
    nav_shop: "المتجر",
    nav_wishlist: "المفضلة",
    hero_title: "أناقة صُممت لأجلك",
    hero_subtitle: "المجموعة الأولى في الكويت للأزياء النسائية والأطفال ومستلزماتهم.",
    hero_slide1_tag: "وصل حديثاً",
hero_slide1_title: "تشكيلة الدراريع الفاخرة",
hero_slide1_desc: "صُنعت للراحة، بتصميم يعكس الفخامة.",
btn_shop_now: "تسوق المجموعة",
hero_slide2_tag: "للصغار",
hero_slide2_title: "ملابس أطفال ومواليد فاخرة",
hero_slide2_desc: "قطن طبيعي ١٠٠٪ يوفر الراحة الفائقة لطفلك.",
btn_shop_kids: "تسوق للأطفال",
hero_slide3_tag: "أزياء مهنية",
hero_slide3_title: "يونيفورم خادمات عالي الجودة",
hero_slide3_desc: "الوجهة الموثوقة الأولى في الكويت لجميع المقاسات.",
btn_shop_maid: "عرض اليونيفورم",
cat_curated: "مختارات حصرية",
cat_explore: "تسوق حسب القسم",
cat_explore_action: "← استكشف",
view_all_cat: "جميع المجموعات",
tag_featured: "مختاراتنا لك",
title_featured: "أحدث التشكيلات المميزة",
view_all: "عرض الكل",
badge_sale: "خصم",
badge_new_pill: "جديد",
tag_arrivals: "مختارات حصرية",
title_arrivals: "وصل حديثاً بالمحل",
filter_all: "الكل",
btn_explore_all: "استكشف كامل التشكيلة",
qa_select_size: "اختر المقاس",
qa_select_color: "اختر اللون",
qa_quantity: "الكمية",
btn_add_to_cart: "أضف إلى السلة",
drawer_cart_title: "حقيبة التسوق",
cart_subtotal: "المجموع الفرعي",
cart_delivery_note: "يتم حساب التوصيل والرسوم عند الدفع.",
btn_view_cart: "عرض الحقيبة كاملة",
btn_checkout: "إتمام الشراء",
free_shipping_reached: "مبروك! حصلت على توصيل مجاني 🎉",
add_more_for_free: "أضف {amount} د.ك إضافية للشحن المجاني",
  }
};

const I18nManager = {
  currentLang: localStorage.getItem('bm_lang') || 'en',

  init() {
    this.applyLanguage(this.currentLang);
    this.bindEvents();
  },

  applyLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('bm_lang', lang);

    const htmlRoot = document.documentElement;
    htmlRoot.setAttribute('lang', lang);
    htmlRoot.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

    // Update all language toggle buttons across mobile and desktop
    document.querySelectorAll('.lang-switch-btn').forEach((btn) => {
      const textSpan = btn.querySelector('.lang-text');
      const label = lang === 'ar' ? 'English' : 'العربية';
      if (textSpan) {
        textSpan.textContent = label;
      } else {
        btn.textContent = label;
      }
    });

    // Update all translatable elements
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (translations[lang] && translations[lang][key]) {
        el.textContent = translations[lang][key];
      }
    });

    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  },

  toggleLanguage() {
    const nextLang = this.currentLang === 'en' ? 'ar' : 'en';
    this.applyLanguage(nextLang);
  },

  bindEvents() {
    document.querySelectorAll('.lang-switch-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.toggleLanguage());
    });
  },

  t(key) {
    return translations[this.currentLang]?.[key] || key;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  I18nManager.init();
});

window.I18nManager = I18nManager;