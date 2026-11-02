// components/inbox/ConversationList.tsx — قائمة محادثات العملاء (كواجهة الوارد)
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { formatChatTime, lastMessagePreview, type Conversation } from './types';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  canDelete?: boolean;
  onSelect: (conversation: Conversation) => void;
  onNew: () => void;
  onDelete: (conversation: Conversation) => void;
}

function formatDay(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  return isToday ? formatChatTime(timestamp) : `${date.getDate()}/${date.getMonth() + 1}`;
}

export default function ConversationList({
  conversations,
  activeId,
  canDelete = true,
  onSelect,
  onNew,
  onDelete,
}: ConversationListProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-full">
      <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-slate-100">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <MessageSquare className="w-4 h-4 text-blue-600" aria-hidden="true" />
          المحادثات
          <span className="text-xs font-medium text-slate-400">({conversations.length})</span>
        </h2>
        <button
          type="button"
          onClick={onNew}
          aria-label="محادثة جديدة"
          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="flex-1 grid place-items-center px-6 py-10 text-center">
          <div>
            <MessageSquare className="w-9 h-9 text-slate-300 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-600 mb-1">لا محادثات بعد</p>
            <p className="text-xs text-slate-400">ابدأ محادثة مع عميل ليستقبل رد الوكيل الذكي.</p>
          </div>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {conversations.map((conversation) => {
            const active = conversation.id === activeId;
            return (
              <li key={conversation.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onSelect(conversation)}
                  className={`w-full text-right px-4 py-3.5 transition-colors ${
                    active ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 grid place-items-center text-sm font-bold shrink-0">
                      {conversation.customerName.trim().charAt(0) || '؟'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${active ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                          {conversation.customerName}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">{formatDay(conversation.updatedAt)}</span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{lastMessagePreview(conversation)}</p>
                    </div>
                  </div>
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(conversation)}
                    aria-label={`حذف محادثة ${conversation.customerName}`}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
