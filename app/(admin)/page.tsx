import {
  DollarSign,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import MetricCard from "../components/dashboard/MetricCard";
import RecentInvoices from "../components/dashboard/RecentInvoices";
import RevenueChart from "../components/dashboard/RevenueChart";

const metrics = [
  {
    title: "إجمالي المبيعات",
    value: "٢٤٬٥٨٠ ر.س",
    change: "+١٢٫٨٪",
    isPositive: true,
    Icon: DollarSign,
    tone: "purple" as const,
  },
  {
    title: "إجمالي الطلبات",
    value: "١٬٢٤٨",
    change: "+٨٫٢٪",
    isPositive: true,
    Icon: ShoppingBag,
    tone: "blue" as const,
  },
  {
    title: "العملاء",
    value: "٨٦٤",
    change: "+٤٫٦٪",
    isPositive: true,
    Icon: Users,
    tone: "orange" as const,
  },
  {
    title: "الفواتير المعلّقة",
    value: "١٨",
    change: "تحتاج متابعة",
    isPositive: false,
    Icon: Receipt,
    tone: "green" as const,
  },
];

export default function DashboardPage() {
  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">نظرة عامة</p>
          <h1>لوحة التحكم والتحليلات</h1>
          <p className="page-description">
            مرحباً بك مجدداً، إليك ملخص أداء النظام اليوم.
          </p>
        </div>
        <button className="primary-button" type="button">
          <span aria-hidden="true">＋</span>
          إنشاء تقرير
        </button>
      </div>

      <section className="metrics-grid" aria-label="المؤشرات الرئيسية">
        {metrics.map((metric) => (
          <MetricCard  key={metric.title} {...metric} />
        ))}
      </section>

      <section className="content-grid" aria-label="تحليلات المتجر">
        <RevenueChart />
        <aside className="goal-card">
          <div className="section-heading">
            <div>
              <h2>الهدف الشهري</h2>
              <p>تقدمك نحو هدف المبيعات</p>
            </div>
            <TrendingUp className="target-icon" aria-hidden="true" />
          </div>
          <div className="goal-value">٧٢٪</div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="تحقيق الهدف الشهري"
            aria-valuenow={72}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span />
          </div>
          <div className="goal-caption">
            <span>١٨٬٠٠٠ ر.س محققة</span>
            <span>٢٥٬٠٠٠ ر.س</span>
          </div>
          <div className="goal-note">
            <span aria-hidden="true">✦</span>
            <p>
              باقي <strong>٧٬٠٠٠ ر.س</strong> للوصول إلى هدفك الشهري.
            </p>
          </div>
        </aside>
      </section>

      <section aria-label="الفواتير الأخيرة">
        <RecentInvoices />
      </section>
    </main>
  );
}