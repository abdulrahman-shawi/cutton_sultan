// app/shop/ShopCatalog.tsx — واجهة المتجر الإلكتروني العامة بنمط قوالب التجارة (على غرار ثيم Molla):
// ترويسة ببحث بارز، شريط أقسام، بانر ترحيبي، بطاقات أقسام، شبكة منتجات بعرض سريع،
// صناديق مزايا، شريط تواصل وفوتر متعدد الأعمدة — البيانات حية من /api/shop بلا تسجيل دخول.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  MessageCircle,
  PackageSearch,
  Percent,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import { formatPrice } from '../components/products/types';

interface CatalogEntry {
  color: string;
  size: string;
  subcategoryId: string;
  currency: 'SYP' | 'USD';
  quantity: number;
  salePrice: number;
}

interface CatalogProduct {
  id: string;
  name: string;
  modelNumber: string;
  categoryId: string;
  status: 'متوفر' | 'غير متوفر';
  imageUrl: string;
  entries: CatalogEntry[];
}

interface ShopPayload {
  storeName: string;
  contactEmail: string;
  socialLink: string;
  dollarRate: string;
  currency: string;
  categories: { id: string; name: string; description: string }[];
  subcategories: { id: string; categoryId: string; name: string }[];
  products: CatalogProduct[];
  // ترتيب معرفات المنتجات الأكثر مبيعاً (تنازلياً) — يُحسب على الخادم من فواتير البيع
  bestSellers: string[];
  // عروض المتجر النشطة للعرض في الرئيسية
  offers: ShopOffer[];
}

interface ShopOffer {
  id: string;
  title: string;
  description: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  items: ShopOfferItem[];
}

interface ShopOfferItem {
  name: string;
  model: string;
  variant: string;
  quantity: number;
  price: number;
  currency: 'SYP' | 'USD';
}

// حساب أسعار العرض بالليرة السورية: إجمالي البنود (بتحويل الدولار) ثم خصم النسبة أو المبلغ الثابت
function offerPricing(offer: ShopOffer, sypRate: number): { original: number; discount: number; final: number } {
  let total = 0;
  for (const item of offer.items) {
    const unitSyp = item.currency === 'USD' ? (sypRate > 0 ? item.price * sypRate : 0) : item.price;
    total += unitSyp * item.quantity;
  }
  total = Math.round(total);
  const discount =
    offer.discountType === 'percent'
      ? Math.round((total * Math.min(Math.max(offer.discountValue, 0), 100)) / 100)
      : Math.min(Math.max(offer.discountValue, 0), total);
  return { original: total, discount, final: Math.max(total - discount, 0) };
}

// رسالة الاستفسار الجاهزة التي تُملأ في محادثة المتجر عند طلب العرض
function offerInquiryMessage(offer: ShopOffer): string {
  const discountText = offer.discountType === 'percent' ? `خصم ${offer.discountValue}٪` : `خصم ${formatPrice(offer.discountValue)} ل.س`;
  return `مرحباً، أريد الاستفسار عن العرض التي اسمها «${offer.title}» (${discountText})`;
}

// تبويبات قسم المنتجات في الصفحة الرئيسية على غرار ثيم Molla
type HomeTab = 'new' | 'best' | 'available';
const HOME_TABS: { key: HomeTab; label: string }[] = [
  { key: 'new', label: 'أحدث المنتجات' },
  { key: 'best', label: 'الأكثر مبيعاً' },
  { key: 'available', label: 'متوفر الآن' },
];

// تبويبا قسم «تسوق حسب» في الرئيسية: بطاقات الأقسام أو بلاطات الشركات
type BrowseTab = 'category' | 'brand';
const BROWSE_TABS: { key: BrowseTab; label: string }[] = [
  { key: 'category', label: 'حسب القسم' },
  { key: 'brand', label: 'حسب الشركة' },
];

const PURPLE = '#7666e8';
const PURPLE_DARK = '#5b4bd1';
const PAGE_BG = '#f4f5f8';
const LINE = '#e9eaf0';

// لوحات متدرجة لبطاقات الأقسام عند غياب صورها
const CATEGORY_GRADIENTS = [
  'linear-gradient(135deg,#7666e8,#a08df5)',
  'linear-gradient(135deg,#e861a0,#f5a18d)',
  'linear-gradient(135deg,#31a9c1,#7fd6c2)',
  'linear-gradient(135deg,#e8a23c,#f5d06b)',
  'linear-gradient(135deg,#5f7ae8,#8fb0f5)',
  'linear-gradient(135deg,#4caf7d,#9bd6b0)',
];

function inStockEntries(product: CatalogProduct): CatalogEntry[] {
  return product.entries.filter((entry) => entry.quantity > 0);
}

function productTotalQuantity(product: CatalogProduct): number {
  return product.entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

function isProductAvailable(product: CatalogProduct): boolean {
  return product.status === 'متوفر' && productTotalQuantity(product) > 0;
}

// سعر المنتج بالليرة السورية فقط: الدولار يُحوّل بسعر الصرف من إعدادات المتجر،
// فتظهر كل الأسعار بوحدة واحدة (ل.س) — بلا أي عرض بعلامة الدولار
function priceLabel(product: CatalogProduct, sypRate: number): string[] {
  const available = inStockEntries(product);
  const prices = available
    .map((entry) => entryPriceInSyp(entry, sypRate))
    .filter((value): value is number => value !== null);
  if (prices.length === 0) return [];
  const min = Math.min(...prices);
  const hasMultiple = new Set(prices).size > 1;
  return [`${hasMultiple ? 'من ' : ''}${formatPrice(min)} ل.س`];
}

// تحويل سعر التفصيلة إلى ليرة سورية: السوري كما هو، والدولار بضربه بسعر الصرف —
// يعيد null عند تعذر التحويل (دولار بلا سعر صرف معرّف) فتُخفى تلك التفصيلة عن العرض
function entryPriceInSyp(entry: CatalogEntry, sypRate: number): number | null {
  if (entry.currency === 'SYP') return entry.salePrice;
  if (entry.currency === 'USD' && sypRate > 0) return Math.round(entry.salePrice * sypRate);
  return null;
}

function uniqueColors(product: CatalogProduct): string[] {
  const seen: string[] = [];
  for (const entry of product.entries) {
    const color = entry.color.trim();
    if (color && !seen.includes(color)) seen.push(color);
  }
  return seen;
}

function uniqueSizes(product: CatalogProduct): string[] {
  const seen: string[] = [];
  for (const entry of product.entries) {
    const size = entry.size.trim();
    if (size && !seen.includes(size)) seen.push(size);
  }
  return seen;
}

// الأقسام الفرعية (الشركات) الفريدة لتفصيلات المنتج — تُختار في النافذة ويتحدد السعر معها
function uniqueSubcategoryIds(product: CatalogProduct): string[] {
  const seen: string[] = [];
  for (const entry of product.entries) {
    const id = entry.subcategoryId?.trim();
    if (id && !seen.includes(id)) seen.push(id);
  }
  return seen;
}

// ترجمة أسماء الألوان العربية في بيانات المنتجات إلى أكواد لون لعرض دوائر الألوان —
// المطابقة بالتطابق المضبوط أولاً ثم بالاحتواء، وغير المعروف يُعرض رمادياً مع أول حرف
const COLOR_SWATCHES: Record<string, string> = {
  'أبيض': '#ffffff',
  'أسود': '#26262b',
  'أحمر': '#e11d48',
  'أزرق': '#2563eb',
  'أخضر': '#16a34a',
  'أصفر': '#eab308',
  'وردي': '#ec4899',
  'بنفسجي': '#9333ea',
  'برتقالي': '#f97316',
  'بني': '#8b5a2b',
  'رمادي': '#9ca3af',
  'بيج': '#d8c49a',
  'كحلي': '#1f3a93',
  'نيلي': '#27316b',
  'تركوازي': '#14b8a6',
  'ذهبي': '#d4af37',
  'فضي': '#c9ccd1',
  'عنابي': '#7f1d2f',
  'موف': '#b784e8',
  'سماوي': '#38bdf8',
  'زيتي': '#6b7f3e',
  'كريمي': '#f3e9d2',
};

function colorHex(name: string): string | null {
  const normalized = name.trim();
  if (!normalized) return null;
  if (COLOR_SWATCHES[normalized]) return COLOR_SWATCHES[normalized];
  for (const key of Object.keys(COLOR_SWATCHES)) {
    if (normalized.includes(key)) return COLOR_SWATCHES[key];
  }
  return null;
}

function ProductImage({ product, className }: { product: CatalogProduct; className: string }) {
  if (product.imageUrl) {
    return <img src={product.imageUrl} alt={product.name} loading="lazy" className={`${className} object-cover`} />;
  }
  return (
    <div
      className={`${className} grid place-items-center text-white`}
      style={{ background: `linear-gradient(135deg, ${PURPLE} 0%, #b7a9f7 100%)` }}
    >
      <span className="text-5xl font-bold opacity-90">{product.name.charAt(0)}</span>
    </div>
  );
}

const RECENTLY_VIEWED_KEY = 'sultan_shop_recent';

function readRecentIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENTLY_VIEWED_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

// تسجيل منتج في قائمة «شوهد مؤخراً» (أحدث أولاً، بحد أقصى 8) على جهاز العميل
function pushRecentId(id: string): string[] {
  const next = [id, ...readRecentIds().filter((item) => item !== id)].slice(0, 8);
  try {
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // التخزين غير متاح
  }
  return next;
}

// mode = home: واجهة الرابط الأساسي / — نفس هوية المتجر لكن بخمسة منتجات وزر للكتالوج الكامل
// mode = full: صفحة /shop الكاملة بالبحث والفلاتر — تستقبل ?q= و ?cat= و ?sub= من الصفحة الرئيسية
export default function ShopCatalog({ mode = 'full' }: { mode?: 'home' | 'full' }) {
  const isHome = mode === 'home';
  const router = useRouter();
  const [payload, setPayload] = useState<ShopPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [subcategoryId, setSubcategoryId] = useState('all');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickedColor, setPickedColor] = useState('');
  const [pickedSize, setPickedSize] = useState('');
  const [pickedSub, setPickedSub] = useState('');
  const [slide, setSlide] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [viewedOfferId, setViewedOfferId] = useState<string | null>(null);
  const productsSectionRef = useRef<HTMLElement>(null);
  const offersSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch('/api/shop', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('bad status');
        return response.json();
      })
      .then((data: ShopPayload) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  // صفحة الكتالوج الكامل تستقبل بحثاً أو قسماً أو شركةً قادمة من الصفحة الرئيسية عبر الرابط
  useEffect(() => {
    if (isHome || typeof window === 'undefined' || !payload) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      const cat = params.get('cat');
      const sub = params.get('sub');
      if (q) setSearch(q);
      if (cat) setCategoryId(cat);
      if (sub) {
        setSubcategoryId(sub);
        const parent = payload.subcategories.find((item) => item.id === sub)?.categoryId;
        if (parent) setCategoryId(parent);
      }
      if (q || cat || sub) setTimeout(() => scrollToProducts(), 300);
    } catch {
      // بارامترات غير مقروءة — نتجاهلها
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHome, payload]);

  // «شوهد مؤخراً» يُحمّل من جهاز العميل عند الدخول للرئيسية
  useEffect(() => {
    if (isHome) setRecentIds(readRecentIds());
  }, [isHome]);

  // ظهور زر «العودة للأعلى» بعد تمرير بعيد
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // قفل تمرير الصفحة عند فتح نافذة العرض السريع أو نافذة العرض (عرض تخفيضات)
  useEffect(() => {
    document.body.style.overflow = selectedId || viewedOfferId ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedId, viewedOfferId]);

  // عند فتح نافذة منتج: تحديد أول قسم فرعي ولون ومقاس تلقائياً فيظهر السعر والتوفر فوراً،
  // وتسجيل المنتج في «شوهد مؤخراً»
  useEffect(() => {
    const product = selectedId ? (payload?.products.find((item) => item.id === selectedId) ?? null) : null;
    setPickedSub(product ? (uniqueSubcategoryIds(product)[0] ?? '') : '');
    setPickedColor(product ? (uniqueColors(product)[0] ?? '') : '');
    setPickedSize(product ? (uniqueSizes(product)[0] ?? '') : '');
    if (selectedId && isHome) setRecentIds(pushRecentId(selectedId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const categories = payload?.categories ?? [];

  const productsOfCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of payload?.products ?? []) {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [payload]);

  const subcategoriesOfCategory = useMemo(() => {
    if (categoryId === 'all') return [];
    return (payload?.subcategories ?? []).filter((sub) => sub.categoryId === categoryId);
  }, [payload, categoryId]);

  const filteredProducts = useMemo(() => {
    if (!payload) return [];
    const query = search.trim().toLowerCase();
    return payload.products.filter((product) => {
      if (availableOnly && !isProductAvailable(product)) return false;
      if (categoryId !== 'all' && product.categoryId !== categoryId) return false;
      if (subcategoryId !== 'all' && !product.entries.some((entry) => entry.subcategoryId === subcategoryId)) {
        return false;
      }
      if (query) {
        const haystack = `${product.name} ${product.modelNumber}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [payload, search, categoryId, subcategoryId, availableOnly]);

  const scrollToProducts = () => {
    productsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // في الرئيسية: اختيار قسم ينقل إلى الكتالوج مرشحاً به — في الكتالوج: ترشيح محلي مباشر
  const pickCategory = (id: string) => {
    if (isHome) {
      router.push(id === 'all' ? '/shop' : `/shop?cat=${encodeURIComponent(id)}`);
      return;
    }
    setCategoryId(id);
    setSubcategoryId('all');
    scrollToProducts();
  };

  // في الرئيسية: البحث ينقل إلى الكتالوج بنفس العبارة
  const submitSearch = () => {
    if (!isHome) {
      scrollToProducts();
      return;
    }
    const q = search.trim();
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  };

  // خمسة منتجات للصفحة الرئيسية حسب التبويب النشط:
  // أحدث = ترتيب الكتالوج (الأحدث مضافاً أولاً) · الأكثر مبيعاً = ترتيب المبيعات الفعلي · متوفر = ذو رصيد حالي
  const [homeTab, setHomeTab] = useState<HomeTab>('new');
  // التبويب النشط في قسم «تسوق حسب» بالرئيسية — بطاقات الأقسام أو بلاطات الشركات
  const [browseTab, setBrowseTab] = useState<BrowseTab>('category');
  const featuredProducts = useMemo(() => {
    const all = payload?.products ?? [];
    if (homeTab === 'available') return all.filter(isProductAvailable).slice(0, 5);
    if (homeTab === 'best') {
      const rank = new Map((payload?.bestSellers ?? []).map((id, index) => [id, index]));
      return [...all].sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)).slice(0, 5);
    }
    return all.slice(0, 5);
  }, [payload, homeTab]);

  const offers = useMemo(() => payload?.offers ?? [], [payload]);

  // شرائح البانر الترحيبي: ترحيب دائماً، شريحة عروض عند وجود عروض نشطة، وشريحة محادثة دائماً
  const slides = useMemo(() => {
    const list: {
      key: string;
      eyebrow: string;
      title: string;
      text: string;
      primary: { label: string; action: 'scroll' | 'chat' | 'offers' };
    }[] = [
      {
        key: 'welcome',
        eyebrow: 'أسعار وتوفر مباشرة من المحل',
        title: payload?.storeName ?? 'قطنيات وبشاكير سلطان',
        text: 'تصفح الكتالوج كاملاً بألوانه ومقاساته وأسعاره المحدّثة لحظياً، وعند ما يعجبك كلمنا بالمحادثة ونحجزه لك.',
        primary: { label: 'تسوق الآن', action: 'scroll' },
      },
    ];
    if (offers.length > 0) {
      const top = [...offers].sort((a, b) => b.discountValue - a.discountValue)[0];
      list.push({
        key: 'offers',
        eyebrow: 'عروضنا الحالية',
        title: top.discountType === 'percent' ? `خصم حتى ${top.discountValue}٪` : `خصم ${formatPrice(top.discountValue)} ل.س`,
        text: top.title + (top.description ? ` — ${top.description}` : ''),
        primary: { label: 'اكتشف العروض', action: 'offers' },
      });
    }
    list.push({
      key: 'chat',
      eyebrow: 'خدمة مباشرة',
      title: 'اطلب عبر المحادثة',
      text: 'اختر منتجك وتواصل معنا مباشرة — فريق المحل جاهز للرد ومساعدتك بالاختيار.',
      primary: { label: 'ابدأ المحادثة', action: 'chat' },
    });
    return list;
  }, [payload, offers]);

  // شركات المنتجات (الأقسام الفرعية) فريدة بالاسم للعرض كبلاطات في الرئيسية
  const brandTiles = useMemo(() => {
    const seen = new Map<string, string>();
    for (const sub of payload?.subcategories ?? []) {
      const name = sub.name.trim();
      if (name && !seen.has(name)) seen.set(name, sub.id);
    }
    return Array.from(seen, ([name, id]) => ({ name, id }));
  }, [payload]);

  // صف منتجات لكل قسم رئيسي (حتى 3 أقسام × 8 منتجات) للتمرير الأفقي في الرئيسية
  const categoryRows = useMemo(() => {
    const all = payload?.products ?? [];
    return (payload?.categories ?? [])
      .slice(0, 3)
      .map((category) => ({
        ...category,
        products: all.filter((product) => product.categoryId === category.id).slice(0, 8),
      }))
      .filter((row) => row.products.length > 0);
  }, [payload]);

  const recentProducts = useMemo(() => {
    const all = payload?.products ?? [];
    return recentIds
      .map((id) => all.find((product) => product.id === id))
      .filter((product): product is CatalogProduct => Boolean(product))
      .slice(0, 5);
  }, [payload, recentIds]);

  const runSlideAction = (action: 'scroll' | 'chat' | 'offers') => {
    if (action === 'chat') router.push('/chat');
    else if (action === 'offers') offersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else scrollToProducts();
  };

  // فهرس الشريحة الضمني — يبقى ضمن النطاق إذا تغيّر عدد الشرائح (دخول/خروج عروض)
  const activeSlide = slide % Math.max(slides.length, 1);

  // تقدّم شرائح البانر الترحيبي تلقائياً كل 6 ثوانٍ
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setSlide((current) => (current + 1) % slides.length), 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  const selected = selectedId ? (payload?.products.find((product) => product.id === selectedId) ?? null) : null;
  const selectedCategory = selected ? categories.find((category) => category.id === selected.categoryId) : null;
  // سعر صرف الدولار إلى ليرة من إعدادات المتجر — بلا سعر صرف تُخفى أسعار الدولار عن العرض
  const sypRate = useMemo(() => {
    const rate = Number(payload?.dollarRate);
    return Number.isFinite(rate) && rate > 0 ? rate : 0;
  }, [payload]);
  const subcategoryNameOf = (id: string) => payload?.subcategories.find((sub) => sub.id === id)?.name ?? '';
  // مشتقات منتقي المتغيرات في نافذة العرض السريع: الأقسام الفرعية (الشركات) والألوان والمقاسات الفريدة،
  // التفصيلات المطابقة للاختيار الحالي، وتوفر القسم/اللون/المقاس في أي تفصيلة
  const modalSubs = selected ? uniqueSubcategoryIds(selected) : [];
  const modalColors = selected ? uniqueColors(selected) : [];
  const modalSizes = selected ? uniqueSizes(selected) : [];
  const variantMatches = selected
    ? selected.entries.filter(
        (entry) =>
          entry.subcategoryId?.trim() === pickedSub &&
          entry.color.trim() === pickedColor &&
          entry.size.trim() === pickedSize
      )
    : [];
  // صفوف العرض النهائية: سعر ل.س محوّل + الكمية — تُسقط التفصيلات التي يستحيل تحويل سعرها
  const variantRows = variantMatches
    .map((entry) => ({ price: entryPriceInSyp(entry, sypRate), quantity: entry.quantity }))
    .filter((row): row is { price: number; quantity: number } => row.price !== null);
  const subHasStock = (id: string) =>
    Boolean(selected?.entries.some((entry) => entry.subcategoryId?.trim() === id && entry.quantity > 0));
  const colorHasStock = (color: string) =>
    Boolean(selected?.entries.some((entry) => entry.color.trim() === color && entry.quantity > 0));
  const sizeHasStock = (size: string) =>
    Boolean(selected?.entries.some((entry) => entry.size.trim() === size && entry.quantity > 0));

  // العرض (التخفيض) المفتوح في نافذة التفاصيل وأسعاره المحسوبة بالليرة
  const viewedOffer = viewedOfferId ? (offers.find((offer) => offer.id === viewedOfferId) ?? null) : null;
  const viewedPricing = viewedOffer ? offerPricing(viewedOffer, sypRate) : null;

  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? '';

  // شبكة بطاقات الأقسام — تُستخدم في الرئيسية (تاب القسم) وفي صفحة الكتالوج
  const categoryCardsGrid = categories.length > 0 && (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {categories.map((category, index) => (
        <button
          key={category.id}
          type="button"
          onClick={() => pickCategory(category.id)}
          className="group text-right bg-white border overflow-hidden transition-shadow hover:shadow-lg"
          style={{ borderColor: LINE }}
        >
          <div
            className="h-24 grid place-items-center"
            style={{ background: CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length] }}
          >
            <span className="text-3xl font-bold text-white/95">{category.name.charAt(0)}</span>
          </div>
          <div className="p-3.5">
            <h3 className="font-semibold text-slate-900 group-hover:opacity-80 transition-opacity">
              {category.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{productsOfCategory.get(category.id) ?? 0} منتج</p>
          </div>
        </button>
      ))}
    </div>
  );

  // بلاطات الشركات (الأقسام الفرعية) للتمرير الأفقي — تُستخدم في الرئيسية (تاب الشركة)
  const brandTilesRow = brandTiles.length > 0 && (
    <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {brandTiles.map((brand, index) => (
        <button
          key={brand.id}
          type="button"
          onClick={() => router.push(`/shop?sub=${encodeURIComponent(brand.id)}`)}
          className="shrink-0 flex items-center gap-3 bg-white border px-5 py-3.5 transition-shadow hover:shadow-md"
          style={{ borderColor: LINE }}
        >
          <span
            className="w-9 h-9 rounded-full grid place-items-center text-white text-sm font-bold shrink-0"
            style={{ background: CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length] }}
          >
            {brand.name.charAt(0)}
          </span>
          <span className="font-semibold text-slate-800 whitespace-nowrap">{brand.name}</span>
        </button>
      ))}
    </div>
  );

  // في الرئيسية: عند توفر الأقسام والشركات معاً يجمعهما قسم واحد بتبويبين كاملين
  const showBrowseTabs = isHome && Boolean(categoryCardsGrid) && Boolean(brandTilesRow);

  // بطاقة منتج موحدة — تُستخدم في الرئيسية (5 منتجات) وفي الكتالوج الكامل
  const renderProductCard = (product: CatalogProduct) => {
    const available = isProductAvailable(product);
    const prices = priceLabel(product, sypRate);
    const colors = uniqueColors(product);
    return (
      <article
        key={product.id}
        className="group relative bg-white border overflow-hidden transition-shadow hover:shadow-lg"
        style={{ borderColor: LINE }}
      >
        <div className="relative overflow-hidden">
          <button
            type="button"
            onClick={() => setSelectedId(product.id)}
            className="block w-full"
            aria-label={`عرض صورة ${product.name}`}
          >
            <ProductImage
              product={product}
              className="aspect-square w-full transition-transform duration-500 group-hover:scale-105"
            />
          </button>
          {!available && (
            <span className="absolute top-3 right-3 bg-slate-900/80 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
              غير متوفر
            </span>
          )}
          {/* شريط الإجراء عند التحويم — العرض السريع مثبّت أسفل الصورة على غرار قوالب Molla */}
          <div className="absolute inset-x-3 bottom-3 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
            <button
              type="button"
              onClick={() => setSelectedId(product.id)}
              className="w-full flex items-center justify-center gap-2 bg-white/95 backdrop-blur border shadow-md rounded-full py-2.5 text-sm font-semibold text-slate-800 hover:bg-[#7666e8] hover:text-white transition-colors"
              style={{ borderColor: LINE }}
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
              عرض سريع
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSelectedId(product.id)}
          className="block w-full text-right p-3.5"
          aria-label={`عرض تفاصيل ${product.name}`}
        >
          <p className="text-[11px] font-semibold tracking-wide text-slate-400 mb-1">
            {categoryName(product.categoryId) || 'منتجات'}
          </p>
          <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 min-h-[2.6em]">
            {product.name}
          </h3>
          <div className="mt-1.5 space-y-0.5">
            {prices.length > 0 ? (
              prices.map((part) => (
                <p key={part} className="text-base font-bold" style={{ color: PURPLE_DARK }}>
                  {part}
                </p>
              ))
            ) : (
              <p className="text-sm text-slate-400">السعر عند الطلب</p>
            )}
          </div>
          {colors.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5">
              {colors.slice(0, 6).map((color) => {
                const hex = colorHex(color);
                return (
                  <span
                    key={color}
                    title={color}
                    className="w-4 h-4 rounded-full border border-black/10 grid place-items-center shrink-0"
                    style={{ background: hex ?? '#e8e9f0' }}
                  >
                    {!hex && (
                      <span className="text-[8px] font-bold text-slate-500 leading-none">{color.charAt(0)}</span>
                    )}
                  </span>
                );
              })}
              {colors.length > 6 && (
                <span className="text-[11px] text-slate-400">+{colors.length - 6}</span>
              )}
            </div>
          )}
        </button>
      </article>
    );
  };

  return (
    <div className="min-h-screen text-slate-800" style={{ background: PAGE_BG }}>
      {/* الأنيميشن المخصص: دخول الشرائح والشريط المتحرك */}
      <style>{`
        @keyframes shop-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shop-marquee { from { transform: translateX(0); } to { transform: translateX(50%); } }
        .animate-shopfade { animation: shop-fade .6s ease both; }
        .animate-shopmarquee { animation: shop-marquee 28s linear infinite; }
      `}</style>

      {/* الشريط العلوي الرفيع */}
      <div className="bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 h-9 flex items-center justify-between text-xs">
          <p className="truncate">مرحباً بكم في {payload?.storeName ?? 'متجر قطن سلطان'}</p>
          <div className="flex items-center gap-4 shrink-0">
            {payload?.socialLink && (
              <a href={payload.socialLink} target="_blank" rel="noreferrer" className="hover:text-white transition-colors hidden sm:inline">
                تابعنا
              </a>
            )}
            <Link href="/chat" className="hover:text-white transition-colors">
              محادثة المتجر
            </Link>
          </div>
        </div>
      </div>

      {/* الترويسة: الشعار وبحث بارز وتواصل */}
      <header className="bg-white border-b sticky top-0 z-30" style={{ borderColor: LINE }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-6 flex-wrap">
          <Link href={isHome ? '/' : '/shop'} className="flex items-center gap-3 shrink-0">
            <span
              className="w-11 h-11 grid place-items-center text-white text-xl font-bold"
              style={{ background: PURPLE }}
            >
              س
            </span>
            <span className="leading-tight">
              <span className="block font-bold text-slate-900">{payload?.storeName ?? 'قطن سلطان'}</span>
              <span className="block text-[11px] text-slate-400">قطنيات · بشاكير · مفارش</span>
            </span>
          </Link>

          <div className="relative flex-1 min-w-[220px] order-3 sm:order-2 w-full sm:w-auto">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitSearch();
              }}
              placeholder="ابحث عن منتج أو رقم موديل…"
              className="w-full rounded-full border bg-slate-50 pr-12 pl-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition"
              style={{ borderColor: LINE, '--tw-ring-color': PURPLE } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={submitSearch}
              aria-label="بحث"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full grid place-items-center text-white"
              style={{ background: PURPLE }}
            >
              <Search className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-2 order-2 sm:order-3 mr-auto sm:mr-0">
            <Link
              href="/chat"
              className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-3 rounded-full transition-opacity hover:opacity-90"
              style={{ background: PURPLE }}
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              <span className="hidden md:inline">تواصل معنا</span>
            </Link>
          </div>
        </div>

        {/* شريط الأقسام */}
        <nav className="border-t" style={{ borderColor: LINE }}>
          <div className="max-w-7xl mx-auto px-4 h-11 flex items-center gap-6 overflow-x-auto text-sm whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="flex items-center gap-1.5 font-semibold text-slate-900 shrink-0">
              <Layers className="w-4 h-4" style={{ color: PURPLE }} aria-hidden="true" />
              تصفح الأقسام
            </span>
            <button
              type="button"
              onClick={() => pickCategory('all')}
              className="transition-colors hover:text-slate-900"
              style={{ color: categoryId === 'all' ? PURPLE : '#6b6d84' }}
            >
              الكل
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => pickCategory(category.id)}
                className="transition-colors hover:text-slate-900"
                style={{ color: categoryId === category.id ? PURPLE : '#6b6d84' }}
              >
                {category.name}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* شريط العروض المتحرك أسفل الترويسة — يظهر عند وجود عروض نشطة */}
      {offers.length > 0 && (
        <div className="overflow-hidden" style={{ background: PURPLE_DARK }}>
          <div className="animate-shopmarquee flex w-max py-2">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center gap-10 px-5 text-xs font-semibold text-white" dir="rtl">
                {offers.map((offer) => (
                  <span key={`${offer.id}-${copy}`} className="flex items-center gap-2 whitespace-nowrap">
                    <Percent className="w-3.5 h-3.5" aria-hidden="true" />
                    {offer.title} — {offer.discountType === 'percent' ? `خصم ${offer.discountValue}٪` : `خصم ${formatPrice(offer.discountValue)} ل.س`}
                  </span>
                ))}
                <span className="whitespace-nowrap text-white/70">الأسعار والتوفر محدّثان لحظياً من المحل</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* البانر الترحيبي — سلايدر دوّار على غرار قوالب Molla */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(120deg, ${PURPLE_DARK}, ${PURPLE} 55%, #9a8af2)` }}>
        <div aria-hidden="true" className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/10" />
        <div aria-hidden="true" className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-white/5" />
        <div aria-hidden="true" className="absolute top-10 right-10 w-24 h-24 rounded-full border-8 border-white/10" />
        <div className="relative max-w-7xl mx-auto px-4 py-14 md:py-20 text-center text-white grid min-h-[300px] md:min-h-[320px]">
          {slides.map((item, index) => (
            <div
              key={item.key}
              className={`col-start-1 row-start-1 transition-opacity duration-700 ${
                index === activeSlide ? 'animate-shopfade opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <p className="text-sm font-semibold tracking-wide text-white/80 mb-3">{item.eyebrow}</p>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">{item.title}</h1>
              <p className="text-white/80 max-w-xl mx-auto mb-8 leading-relaxed">{item.text}</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => runSlideAction(item.primary.action)}
                  className="bg-white font-semibold text-sm px-7 py-3.5 rounded-full transition-transform hover:scale-[1.03]"
                  style={{ color: PURPLE_DARK }}
                >
                  {item.primary.label}
                </button>
                <Link
                  href="/chat"
                  className="border border-white/60 text-white font-semibold text-sm px-7 py-3.5 rounded-full transition-colors hover:bg-white/10"
                >
                  تواصل معنا
                </Link>
              </div>
            </div>
          ))}
        </div>
        {/* أسهم التنقل والنقاط */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setSlide((slide - 1 + slides.length) % slides.length)}
              aria-label="الشريحة السابقة"
              className="hidden md:grid absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSlide((slide + 1) % slides.length)}
              aria-label="الشريحة التالية"
              className="hidden md:grid absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2">
              {slides.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSlide(index)}
                  aria-label={`الشريحة ${index + 1}`}
                  className="h-2 rounded-full transition-all"
                  style={{ width: index === activeSlide ? 22 : 8, background: index === activeSlide ? '#fff' : 'rgba(255,255,255,0.45)' }}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <main className="max-w-7xl mx-auto px-4">
        {/* تسوق حسب القسم / الشركة — في الرئيسية تابان كاملان عند توفر الفئتين، وفي الكتالوج بطاقات الأقسام فقط */}
        {showBrowseTabs ? (
          <section className="py-12">
            <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
              <div>
                <p className="text-xs font-bold tracking-widest mb-1" style={{ color: PURPLE }}>
                  تسوق حسب
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  {browseTab === 'category' ? 'تسوق حسب القسم' : 'تسوق حسب الشركة'}
                </h2>
              </div>
              {/* التابان: حسب القسم / حسب الشركة */}
              <div
                className="flex gap-6 border-b overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ borderColor: LINE }}
              >
                {BROWSE_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setBrowseTab(tab.key)}
                    className="pb-2.5 -mb-px border-b-2 text-sm font-semibold transition-colors whitespace-nowrap"
                    style={{
                      borderColor: browseTab === tab.key ? PURPLE : 'transparent',
                      color: browseTab === tab.key ? PURPLE : '#6b6d84',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {browseTab === 'category' ? categoryCardsGrid : brandTilesRow}
          </section>
        ) : (
          <>
            {/* بطاقات الأقسام */}
            {categoryCardsGrid && (
              <section className="py-12">
                <div className="flex items-end justify-between mb-6">
                  <div>
                    <p className="text-xs font-bold tracking-widest mb-1" style={{ color: PURPLE }}>
                      الأقسام
                    </p>
                    <h2 className="text-2xl font-bold text-slate-900">تسوق حسب القسم</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => pickCategory('all')}
                    className="flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80"
                    style={{ color: PURPLE }}
                  >
                    عرض الكل
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                {categoryCardsGrid}
              </section>
            )}

            {/* تسوق حسب الشركة — بلاطات الشركات (الأقسام الفرعية) للتمرير الأفقي */}
            {isHome && brandTilesRow && (
              <section className="pb-12">
                <div className="mb-5">
                  <p className="text-xs font-bold tracking-widest mb-1" style={{ color: PURPLE }}>
                    شركاؤنا
                  </p>
                  <h2 className="text-2xl font-bold text-slate-900">تسوق حسب الشركة</h2>
                </div>
                {brandTilesRow}
              </section>
            )}
          </>
        )}

        {/* العروض النشطة — بطاقات الخصم على غرار قوالب Molla */}
        {isHome && offers.length > 0 && (
          <section ref={offersSectionRef} className="pb-12 scroll-mt-32">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs font-bold tracking-widest mb-1" style={{ color: PURPLE }}>
                  لفترة محدودة
                </p>
                <h2 className="text-2xl font-bold text-slate-900">عروضنا الحالية</h2>
              </div>
              <Link
                href="/chat"
                className="flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: PURPLE }}
              >
                اطلب عرضك بالمحادثة
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {offers.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => setViewedOfferId(offer.id)}
                  className="relative bg-white border overflow-hidden p-6 text-right transition-shadow hover:shadow-lg"
                  style={{ borderColor: LINE }}
                >
                  <span
                    className="inline-block text-xs font-bold text-white px-3 py-1.5 rounded-full mb-4"
                    style={{ background: PURPLE }}
                  >
                    {offer.discountType === 'percent' ? `خصم ${offer.discountValue}٪` : `خصم ${formatPrice(offer.discountValue)} ل.س`}
                  </span>
                  <h3 className="font-bold text-slate-900 mb-1.5">{offer.title}</h3>
                  {offer.description && <p className="text-sm text-slate-500 leading-relaxed mb-3">{offer.description}</p>}
                  <p className="text-xs text-slate-400">
                    {offer.items.length > 0 ? `ربطة من ${offer.items.length} أصناف — اضغط لعرض التفاصيل والسعر` : 'خصم على الفاتورة — اضغط للتفاصيل'}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* المنتجات: خمسة في الرئيسية مع زر الكتالوج — الكامل في صفحة /shop */}
        <section ref={productsSectionRef} className="pb-14 scroll-mt-32">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
            <div>
              <p className="text-xs font-bold tracking-widest mb-1" style={{ color: PURPLE }}>
                {isHome ? 'منتجات مختارة' : 'الكتالوج'}
              </p>
              <h2 className="text-2xl font-bold text-slate-900">{isHome ? 'تسوق الآن' : 'المنتجات'}</h2>
            </div>
            {isHome ? (
              <Link
                href="/shop"
                className="flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: PURPLE }}
              >
                عرض الكل
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </Link>
            ) : (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={availableOnly}
                    onClick={() => setAvailableOnly((value) => !value)}
                    className="w-10 h-[22px] rounded-full p-[3px] transition-colors"
                    style={{ background: availableOnly ? PURPLE : '#d4d5e0' }}
                  >
                    <span
                      className="block w-4 h-4 rounded-full bg-white shadow transition-transform"
                      style={{ transform: availableOnly ? 'translateX(-16px)' : 'translateX(0)' }}
                    />
                  </button>
                  <span className="text-sm text-slate-600">المتوفر فقط</span>
                </div>
                <p className="text-sm text-slate-400">{loading ? 'جارٍ التحميل…' : `${filteredProducts.length} منتج`}</p>
              </div>
            )}
          </div>

          {/* تبويبات Molla — الأحدث / الأكثر مبيعاً / متوفر الآن — في الرئيسية فقط */}
          {isHome && (
            <div className="flex gap-6 border-b mb-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ borderColor: LINE }}>
              {HOME_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setHomeTab(tab.key)}
                  className="pb-2.5 -mb-px border-b-2 text-sm font-semibold transition-colors whitespace-nowrap"
                  style={{
                    borderColor: homeTab === tab.key ? PURPLE : 'transparent',
                    color: homeTab === tab.key ? PURPLE : '#6b6d84',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* تبويبات الأقسام — صفحة الكتالوج الكامل فقط */}
          {!isHome && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto mb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabChip active={categoryId === 'all'} onClick={() => pickCategory('all')}>
                الكل
              </TabChip>
              {categories.map((category) => (
                <TabChip
                  key={category.id}
                  active={categoryId === category.id}
                  onClick={() => pickCategory(category.id)}
                >
                  {category.name}
                </TabChip>
              ))}
            </div>
          )}
          {!isHome && subcategoriesOfCategory.length > 0 && (
            <div className="flex gap-2 overflow-x-auto mb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabChip active={subcategoryId === 'all'} onClick={() => setSubcategoryId('all')} small>
                كل الشركات
              </TabChip>
              {subcategoriesOfCategory.map((subcategory) => (
                <TabChip
                  key={subcategory.id}
                  active={subcategoryId === subcategory.id}
                  onClick={() => setSubcategoryId(subcategoryId === subcategory.id ? 'all' : subcategory.id)}
                  small
                >
                  {subcategory.name}
                </TabChip>
              ))}
            </div>
          )}

          {loading ? (
            <div
              className={`grid gap-4 ${
                isHome ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
              }`}
            >
              {Array.from({ length: isHome ? 5 : 10 }).map((_, index) => (
                <div key={index} className="bg-white border" style={{ borderColor: LINE }}>
                  <div className="aspect-square bg-slate-100 animate-pulse" />
                  <div className="p-3.5 space-y-2">
                    <div className="h-3 rounded bg-slate-100 animate-pulse w-1/3" />
                    <div className="h-4 rounded bg-slate-100 animate-pulse w-4/5" />
                    <div className="h-4 rounded bg-slate-100 animate-pulse w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <StateBox
              title="تعذر تحميل الكتالوج"
              hint="تحقق من اتصالك بالإنترنت ثم أعد المحاولة."
              action={
                <button
                  type="button"
                  onClick={() => setRetryCount((count) => count + 1)}
                  className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-full"
                  style={{ background: PURPLE }}
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  إعادة المحاولة
                </button>
              }
            />
          ) : isHome ? (
            featuredProducts.length === 0 ? (
              <StateBox
                title={
                  homeTab === 'best'
                    ? 'لا توجد مبيعات بعد'
                    : homeTab === 'available'
                      ? 'لا توجد منتجات متوفرة حالياً'
                      : 'لا توجد منتجات بعد'
                }
                hint={
                  homeTab === 'best'
                    ? 'عند أول عمليات البيع ستظهر هنا منتجاتك الأكثر طلباً.'
                    : 'تفضل بزيارتنا لاحقاً — الكتالوج يُحدَّث باستمرار.'
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {featuredProducts.map(renderProductCard)}
                </div>
                {/* زر الانتقال إلى الكتالوج الكامل */}
                <div className="text-center mt-10">
                  <Link
                    href="/shop"
                    className="inline-flex items-center gap-2 border-2 font-semibold text-sm px-8 py-3.5 rounded-full transition-colors hover:bg-[#7666e8] hover:text-white"
                    style={{ borderColor: PURPLE, color: PURPLE }}
                  >
                    عرض جميع المنتجات
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </>
            )
          ) : filteredProducts.length === 0 ? (
            <StateBox
              title="لا توجد نتائج مطابقة"
              hint="جرّب توسيع البحث أو إلغاء الفلاتر."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategoryId('all');
                    setSubcategoryId('all');
                    setAvailableOnly(false);
                  }}
                  className="text-sm font-semibold text-white px-5 py-2.5 rounded-full"
                  style={{ background: PURPLE }}
                >
                  إلغاء كل الفلاتر
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map(renderProductCard)}
            </div>
          )}
        </section>

        {/* صف منتجات لكل قسم رئيسي — تمرير أفقي على غرار Molla */}
        {isHome &&
          categoryRows.map((row) => (
            <section key={row.id} className="pb-12">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-slate-900">{row.name}</h2>
                <Link
                  href={`/shop?cat=${encodeURIComponent(row.id)}`}
                  className="flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ color: PURPLE }}
                >
                  عرض الكل
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {row.products.map((product) => (
                  <div key={product.id} className="w-44 sm:w-52 shrink-0">
                    {renderProductCard(product)}
                  </div>
                ))}
              </div>
            </section>
          ))}

        {/* شوهد مؤخراً — من جهاز العميل نفسه */}
        {isHome && recentProducts.length > 0 && (
          <section className="pb-12">
            <h2 className="text-xl font-bold text-slate-900 mb-5">شوهد مؤخراً</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {recentProducts.map((product) => (
                <div key={product.id} className="w-44 sm:w-52 shrink-0">
                  {renderProductCard(product)}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* صناديق المزايا */}
        <section className="border-t py-10" style={{ borderColor: LINE }}>
          <div className="grid sm:grid-cols-3 gap-6">
            <FeatureBox
              icon={<Tag className="w-6 h-6" style={{ color: PURPLE }} aria-hidden="true" />}
              title="أسعار محدّثة من المحل"
              text="كل الأسعار والموديلات مأخوذة مباشرة من نظام المحل لحظة تصفحك."
            />
            <FeatureBox
              icon={<ShieldCheck className="w-6 h-6" style={{ color: PURPLE }} aria-hidden="true" />}
              title="توفر لحظي للكميات"
              text="ما تراه من كميات هو رصيد المخزون الفعلي وقت فتح الصفحة."
            />
            <FeatureBox
              icon={<MessageCircle className="w-6 h-6" style={{ color: PURPLE }} aria-hidden="true" />}
              title="طلب مباشر بالمحادثة"
              text="اختر ما يعجبك واطلبه فوراً عبر محادثة المتجر وسنؤكده معك."
            />
          </div>
        </section>
      </main>

      {/* شريط التواصل */}
      <section className="py-14" style={{ background: `linear-gradient(120deg, ${PURPLE_DARK}, ${PURPLE})` }}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-right">
          <div className="text-white">
            <h2 className="text-2xl font-bold mb-1.5">عندك سؤال عن موديل أو مقاس؟</h2>
            <p className="text-white/80 text-sm">فريق المحل جاهز بالمحادثة — رد سريع خلال أوقات الدوام.</p>
          </div>
          <Link
            href="/chat"
            className="shrink-0 flex items-center gap-2 bg-white font-semibold text-sm px-8 py-3.5 rounded-full transition-transform hover:scale-[1.03]"
            style={{ color: PURPLE_DARK }}
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            ابدأ المحادثة
          </Link>
        </div>
      </section>

      {/* الفوتر */}
      <footer className="bg-white border-t" style={{ borderColor: LINE }}>
        <div className="max-w-7xl mx-auto px-4 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 grid place-items-center text-white text-lg font-bold" style={{ background: PURPLE }}>
                س
              </span>
              <span className="font-bold text-slate-900">{payload?.storeName ?? 'قطن سلطان'}</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              كتالوج المتجر الإلكتروني — تسوق بشكل مباشر واطلب عبر المحادثة.
            </p>
            {payload?.socialLink && (
              <a
                href={payload.socialLink}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-4 text-sm font-semibold"
                style={{ color: PURPLE }}
              >
                تابعنا على وسائل التواصل
              </a>
            )}
          </div>
          <FooterColumn
            title="الأقسام"
            links={categories.slice(0, 6).map((category) => ({
              label: category.name,
              onClick: () => pickCategory(category.id),
            }))}
          />
          <FooterColumn
            title="روابط سريعة"
            links={[
              { label: 'جميع المنتجات', onClick: () => pickCategory('all') },
              { label: 'محادثة المتجر', href: '/chat' },
            ]}
          />
          <div>
            <h3 className="font-bold text-slate-900 mb-4">تواصل معنا</h3>
            <ul className="space-y-2.5 text-sm text-slate-500">
              {payload?.contactEmail && (
                <li>
                  <a href={`mailto:${payload.contactEmail}`} className="hover:opacity-80 transition-opacity" style={{ color: PURPLE }}>
                    {payload.contactEmail}
                  </a>
                </li>
              )}
              <li>
                <Link href="/chat" className="hover:opacity-80 transition-opacity" style={{ color: PURPLE }}>
                  محادثة مباشرة مع المحل
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: LINE }}>
          <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <p>
              © {new Date().getFullYear()} {payload?.storeName ?? 'قطن سلطان'} — جميع الحقوق محفوظة
            </p>
            <p>الأسعار والتوفر محدّثان لحظياً وقابلة للتغيير قبل تأكيد الطلب.</p>
          </div>
        </div>
      </footer>

      {/* زر المحادثة العائم — أهم زر في المتجر لأن الطلب كله عبره */}
      <Link
        href="/chat"
        aria-label="محادثة المتجر"
        className="fixed bottom-5 left-5 z-40 w-14 h-14 rounded-full grid place-items-center text-white shadow-lg transition-transform hover:scale-105"
        style={{ background: PURPLE }}
      >
        <MessageCircle className="w-6 h-6" aria-hidden="true" />
      </Link>

      {/* زر العودة للأعلى — يظهر بعد تمرير بعيد */}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="العودة للأعلى"
          className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full grid place-items-center bg-white border shadow-lg text-slate-500 transition-colors hover:text-slate-900"
          style={{ borderColor: LINE }}
        >
          <ArrowUp className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      {/* نافذة تفاصيل العرض: محتويات الربطة مع السعر الأصلي والسعر بعد الخصم */}
      {viewedOffer && viewedPricing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => setViewedOfferId(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setViewedOfferId(null)}
              aria-label="إغلاق"
              className="absolute top-3 left-3 z-10 p-2 rounded-full bg-white border shadow-sm transition-colors hover:text-slate-900"
              style={{ borderColor: LINE, color: '#9aa0b0' }}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="p-6 md:p-8">
              <span
                className="inline-block text-xs font-bold text-white px-3 py-1.5 rounded-full"
                style={{ background: PURPLE }}
              >
                {viewedOffer.discountType === 'percent'
                  ? `خصم ${viewedOffer.discountValue}٪`
                  : `خصم ${formatPrice(viewedOffer.discountValue)} ل.س`}
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-3 mb-1">{viewedOffer.title}</h2>
              {viewedOffer.description && (
                <p className="text-sm text-slate-500 leading-relaxed">{viewedOffer.description}</p>
              )}

              {viewedOffer.items.length > 0 ? (
                <>
                  <h3 className="text-sm font-bold text-slate-900 mt-6 mb-2">
                    محتويات العرض
                    <span className="font-normal text-slate-400"> ({viewedOffer.items.length})</span>
                  </h3>
                  <ul className="divide-y border rounded-xl overflow-hidden bg-white mb-5" style={{ borderColor: LINE }}>
                    {viewedOffer.items.map((item, index) => {
                      const unitSyp = Math.round(
                        item.currency === 'USD' ? item.price * (sypRate > 0 ? sypRate : 0) : item.price
                      );
                      return (
                        <li key={index} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                            {[item.model, item.variant].filter(Boolean).length > 0 && (
                              <p className="text-xs text-slate-400 mt-0.5" dir="ltr">
                                {[item.model, item.variant].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                          <p className="text-slate-600 whitespace-nowrap text-xs">
                            {item.quantity} × {formatPrice(unitSyp)} ل.س
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                  {/* السعر الأصلي والنهائي بعد الخصم — محسوب مباشرة من بنود الربطة */}
                  <div
                    className="rounded-xl px-4 py-4 mb-6 space-y-2"
                    style={{ background: `${PURPLE}0d`, border: `1px solid ${LINE}` }}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">السعر الأصلي</span>
                      <span className="text-slate-400 line-through">{formatPrice(viewedPricing.original)} ل.س</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">قيمة الخصم</span>
                      <span className="font-semibold text-emerald-600">
                        - {formatPrice(viewedPricing.discount)} ل.س
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: LINE }}>
                      <span className="font-bold text-slate-900">السعر بعد الخصم</span>
                      <span className="text-lg font-bold" style={{ color: PURPLE_DARK }}>
                        {formatPrice(viewedPricing.final)} ل.س
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500 border rounded-xl px-4 py-5 my-5" style={{ borderColor: LINE, borderStyle: 'dashed' }}>
                  {viewedOffer.discountType === 'percent'
                    ? `خصم ${viewedOffer.discountValue}٪ على قيمة الفاتورة — اسألنا عن تفاصيله بالمحادثة.`
                    : `خصم ${formatPrice(viewedOffer.discountValue)} ل.س على قيمة الفاتورة — اسألنا عن تفاصيله بالمحادثة.`}
                </p>
              )}

              {/* زر الطلب: ينقل للمحادثة وقد ملأنا رسالة الاستفسار تلقائياً باسم العرض */}
              <Link
                href={`/chat?m=${encodeURIComponent(offerInquiryMessage(viewedOffer))}`}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: PURPLE }}
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                اطلب العرض بالمحادثة
              </Link>
              <p className="text-[11px] text-slate-400 mt-2.5 text-center">
                سنفتح محادثة المتجر وقد كتبنا لك رسالة الاستفسار عن هذا العرض تلقائياً — أرسلها كما هي أو عدّلها.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* نافذة العرض السريع */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => setSelectedId(null)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto bg-white shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="إغلاق"
              className="absolute top-3 left-3 z-10 p-2 rounded-full bg-white border shadow-sm transition-colors hover:text-slate-900"
              style={{ borderColor: LINE, color: '#9aa0b0' }}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <div className="grid md:grid-cols-2">
              <div className="relative bg-slate-50">
                <ProductImage product={selected} className="aspect-square md:aspect-auto md:h-full md:min-h-[420px] w-full" />
                {!isProductAvailable(selected) && (
                  <span className="absolute top-4 right-4 bg-slate-900/80 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm">
                    غير متوفر حالياً
                  </span>
                )}
              </div>
              <div className="p-6 md:p-8 flex flex-col">
                <p className="text-xs font-bold tracking-widest mb-2" style={{ color: PURPLE }}>
                  {selectedCategory?.name ?? 'منتجات'}
                </p>
                <h2 className="text-xl font-bold text-slate-900 leading-snug">{selected.name}</h2>
                <p className="text-sm text-slate-400 mt-1" dir="ltr">
                  موديل: {selected.modelNumber}
                </p>

                {/* الأقسام الفرعية (الشركات): تُختار وتتغير الأسعار معها */}
                {modalSubs.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-bold text-slate-900 mb-2.5">
                      القسم
                      <span className="font-normal text-slate-500"> — {subcategoryNameOf(pickedSub) || '—'}</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {modalSubs.map((subId) => {
                        const active = subId === pickedSub;
                        const inStock = subHasStock(subId);
                        return (
                          <button
                            key={subId}
                            type="button"
                            onClick={() => setPickedSub(subId)}
                            aria-label={`قسم ${subcategoryNameOf(subId)}${inStock ? '' : ' — غير متوفر'}`}
                            className={`px-4 h-10 rounded-full border text-sm font-semibold transition-all ${
                              inStock ? '' : 'opacity-40 line-through'
                            }`}
                            style={
                              active
                                ? { background: PURPLE, borderColor: PURPLE, color: '#fff' }
                                : { background: '#fff', borderColor: '#d6d8e2', color: '#3c3e55' }
                            }
                          >
                            {subcategoryNameOf(subId) || 'قسم'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* الألوان: دوائر ملوّنة باللون الفعلي، مع تظليل المختار وحجب غير المتوفر */}
                {modalColors.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-bold text-slate-900 mb-2.5">
                      اللون
                      <span className="font-normal text-slate-500"> — {pickedColor}</span>
                    </h3>
                    <div className="flex flex-wrap gap-2.5">
                      {modalColors.map((color) => {
                        const hex = colorHex(color);
                        const active = color === pickedColor;
                        const inStock = colorHasStock(color);
                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setPickedColor(color)}
                            title={color}
                            aria-label={`لون ${color}${inStock ? '' : ' — غير متوفر'}`}
                            className={`w-9 h-9 rounded-full grid place-items-center border transition-all ${
                              inStock ? '' : 'opacity-40'
                            }`}
                            style={{
                              background: hex ?? '#e8e9f0',
                              borderColor: 'rgba(0,0,0,0.12)',
                              boxShadow: active ? `0 0 0 2px #fff, 0 0 0 4px ${PURPLE}` : undefined,
                            }}
                          >
                            {!hex && (
                              <span className="text-[10px] font-bold text-slate-500 leading-none">
                                {color.charAt(0)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* المقاسات: دوائر/badges، المتوفر منها كامل والمنتهي باهت مشطوب */}
                {modalSizes.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-bold text-slate-900 mb-2.5">
                      المقاس
                      <span className="font-normal text-slate-500"> — {pickedSize}</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {modalSizes.map((size) => {
                        const active = size === pickedSize;
                        const inStock = sizeHasStock(size);
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setPickedSize(size)}
                            aria-label={`مقاس ${size}${inStock ? '' : ' — غير متوفر'}`}
                            className={`min-w-[44px] h-10 px-3 rounded-full border text-sm font-semibold transition-all ${
                              inStock ? '' : 'opacity-40 line-through'
                            }`}
                            style={
                              active
                                ? { background: PURPLE, borderColor: PURPLE, color: '#fff' }
                                : { background: '#fff', borderColor: '#d6d8e2', color: '#3c3e55' }
                            }
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* نتيجة الاختيار: سعر التفصيلة المختارة بالليرة السورية وتوفرها */}
                <div className="mt-5 flex-1">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">السعر والتوفر</h3>
                  {variantRows.length > 0 ? (
                    <ul className="divide-y border rounded-xl overflow-hidden bg-white" style={{ borderColor: LINE }}>
                      {variantRows.map((row, index) => (
                        <li key={index} className="flex items-center justify-between gap-3 px-4 py-3">
                          <p className="font-bold text-slate-900 text-base whitespace-nowrap">
                            {formatPrice(row.price)}{' '}
                            <span className="text-xs font-normal text-slate-400">ل.س</span>
                          </p>
                          <p
                            className={`text-xs font-semibold ${
                              row.quantity > 0 ? 'text-emerald-600' : 'text-rose-400'
                            }`}
                          >
                            {row.quantity > 0 ? `متوفر — ${row.quantity} قطعة` : 'نفدت الكمية'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      className="text-sm text-slate-400 px-4 py-6 text-center"
                      style={{ border: `1px dashed ${LINE}` }}
                    >
                      اختر قسماً ولوناً ومقاساً لعرض السعر والتوفر
                    </p>
                  )}
                </div>

                <Link
                  href="/chat"
                  className="mt-6 flex items-center justify-center gap-2 w-full py-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: PURPLE }}
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  للطلب أو الاستفسار تحدث معنا
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabChip({
  active,
  onClick,
  small,
  children,
}: {
  active: boolean;
  onClick: () => void;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full font-medium transition-colors ${
        small ? 'px-3.5 py-1.5 text-xs' : 'px-5 py-2 text-sm'
      }`}
      style={
        active
          ? { background: PURPLE, color: '#fff' }
          : { background: '#fff', border: `1px solid ${LINE}`, color: '#5b5d75' }
      }
    >
      {children}
    </button>
  );
}

function FeatureBox({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-4 bg-white border p-5" style={{ borderColor: LINE }}>
      <span className="shrink-0 w-12 h-12 grid place-items-center rounded-full" style={{ background: `${PURPLE}14` }}>
        {icon}
      </span>
      <div>
        <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function StateBox({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border py-20 px-6 flex flex-col items-center justify-center text-center" style={{ borderColor: LINE }}>
      <PackageSearch className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
      <p className="font-bold text-slate-900 mb-1">{title}</p>
      <p className="text-sm text-slate-400 mb-5">{hint}</p>
      {action}
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href?: string; onClick?: () => void }[];
}) {
  return (
    <div>
      <h3 className="font-bold text-slate-900 mb-4">{title}</h3>
      <ul className="space-y-2.5 text-sm text-slate-500">
        {links.map((link) => (
          <li key={link.label}>
            {link.href ? (
              <Link href={link.href} className="transition-colors hover:text-slate-900">
                {link.label}
              </Link>
            ) : (
              <button type="button" onClick={link.onClick} className="transition-colors hover:text-slate-900">
                {link.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
