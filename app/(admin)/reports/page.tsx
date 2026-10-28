import ReportsManager from '../../components/reports/ReportsManager';

export const metadata = {
  title: 'التقارير المالية | نظام إدارة العملاء',
};

export default function ReportsPage() {
  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">الحسابات</p>
          <h1>التقارير المالية</h1>
          <p className="page-description">
            ملخص المقبوضات والمدفوعات والمصاريف وصافي الربح حسب الفترة، مع أرصدة العملاء والموردين وتصدير CSV.
          </p>
        </div>
      </div>

      <ReportsManager />
    </main>
  );
}
