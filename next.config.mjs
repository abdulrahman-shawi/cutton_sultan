/** @type {import('next').NextConfig} */
const nextConfig = {
  // الصفحة الجذر تنقل إلى لوحة الإدارة — التحويل هنا يضمن ترويسة Location الصحيحة
  async redirects() {
    return [{ source: '/', destination: '/dashboard', permanent: false }];
  },
};

export default nextConfig;
