import PosManager from '../../components/pos/PosManager';

export const metadata = {
  title: 'نقطة البيع السريعة | نظام إدارة العملاء',
};

export default function PosPage() {
  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">بيع سريع</p>
          <h1>نقطة البيع (POS)</h1>
          <p className="page-description">
            امسح باركود المنتج لإضافته إلى الفاتورة مباشرة — تُحفظ كمقبوضات مدفوعة ويُخصم مخزونها تلقائياً.
          </p>
        </div>
      </div>

      <PosManager />
    </main>
  );
}
