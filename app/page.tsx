// app/page.tsx — الرابط الأساسي: واجهة المتجر — خمسة منتجات مميزة وزر للكتالوج الكامل في /shop
import ShopCatalog from './shop/ShopCatalog';

export const metadata = {
  title: 'قطنيات وبشاكير سلطان | المتجر الإلكتروني',
  description: 'تصفح منتجات قطنيات وبشاكير سلطان مع الأسعار والتوفر المباشر، واطلب عبر المحادثة.',
};

export default function HomePage() {
  return <ShopCatalog mode="home" />;
}
