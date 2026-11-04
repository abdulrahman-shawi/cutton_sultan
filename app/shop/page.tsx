import ShopCatalog from './ShopCatalog';

export const metadata = {
  title: 'جميع المنتجات | قطن سلطان',
  description: 'الكتالوج الكامل لمنتجات قطنيات وبشاكير سلطان مع بحث وفلاتر الأقسام.',
};

export default function ShopPage() {
  return <ShopCatalog mode="full" />;
}
