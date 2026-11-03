// components/workflows/WorkflowsManager.tsx — إدارة أتمتة سير العمل للأدمن: قائمة، تفعيل، تشغيل يدوي، سجل
'use client';

import { useEffect, useState } from 'react';
import { Check, Pencil, Play, Plus, Trash2, Workflow as WorkflowIcon } from 'lucide-react';
import WorkflowModal from './WorkflowModal';
import ConfirmDialog from '../categories/ConfirmDialog';
import { runWorkflowGraph } from './engine';
import {
  WORKFLOWS_STORAGE_KEY,
  migrateWorkflow,
  nodeKindLabel,
  triggerLabel,
  type Workflow,
  type WorkflowNode,
  type WorkflowTrigger,
} from './types';
import { CONVERSATIONS_STORAGE_KEY, createConversation, type Conversation, type ConversationMessage } from '../inbox/types';

function loadWorkflows(): Workflow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WORKFLOWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Partial<Workflow>[]).map((workflow) => migrateWorkflow(workflow)) : [];
  } catch {
    return [];
  }
}

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Conversation[]) : [];
  } catch {
    return [];
  }
}

function formatRunTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function WorkflowsManager() {
  const [workflows, setWorkflows] = useState<Workflow[]>(loadWorkflows);
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [modal, setModal] = useState<{ open: boolean; workflow: Workflow | null }>({ open: false, workflow: null });
  const [deleting, setDeleting] = useState<Workflow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(workflows));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [workflows]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // التخزين غير متاح في هذا المتصفح
    }
  }, [conversations]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const logRun = (workflowId: string, detail: string) => {
    setWorkflows((prev) =>
      prev.map((workflow) =>
        workflow.id === workflowId
          ? { ...workflow, runs: [{ at: Date.now(), detail }, ...workflow.runs].slice(0, 20) }
          : workflow
      )
    );
  };

  const handleSave = (
    data: { name: string; enabled: boolean; trigger: WorkflowTrigger; triggerNextId: string | null; nodes: WorkflowNode[] },
    id: string | null
  ) => {
    if (id) {
      setWorkflows((prev) => prev.map((workflow) => (workflow.id === id ? { ...workflow, ...data } : workflow)));
      setToast('تم تحديث سير العمل');
    } else {
      setWorkflows((prev) => [{ ...data, id: crypto.randomUUID(), runs: [], createdAt: Date.now() }, ...prev]);
      setToast('تم إنشاء سير العمل');
    }
    setModal({ open: false, workflow: null });
  };

  const toggleEnabled = (workflow: Workflow) => {
    setWorkflows((prev) => prev.map((item) => (item.id === workflow.id ? { ...item, enabled: !item.enabled } : item)));
  };

  const handleDelete = () => {
    if (!deleting) return;
    setWorkflows((prev) => prev.filter((workflow) => workflow.id !== deleting.id));
    setDeleting(null);
    setToast('تم حذف سير العمل');
  };

  // التشغيل اليدوي: يمر على المخطط من أول عقدة عبر محرك العقد نفسه المستخدم على الخادم
  const handleRun = async (workflow: Workflow) => {
    let target = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
    if (!target) {
      target = createConversation(null, 'عميل تجريبي');
      setConversations((prev) => [target as Conversation, ...prev]);
    }
    const conversation = target as Conversation;
    const appendMessage = (message: Omit<ConversationMessage, 'id' | 'at'>) => {
      setConversations((prev) =>
        prev.map((item) =>
          item.id === conversation.id
            ? { ...item, updatedAt: Date.now(), messages: [...item.messages, { ...message, id: crypto.randomUUID(), at: Date.now() }] }
            : item
        )
      );
    };
    // في الواجهة لا يُنشأ الطلب فعلياً — يُكتفي بملاحظة، والتنفيذ الحقيقي على خادم المتجر
    const result = await runWorkflowGraph(workflow, conversation, workflow.triggerNextId, {
      createOrder: async (_node, customerName) => `🧾 طلب للعميل «${customerName}» — يُنشأ فعلياً على خادم المتجر عند وصوله من صفحة العميل`,
    });
    // محاكاة ظاهرية للرسائل على أحدث محادثة محلياً
    for (const message of conversation.messages.slice(-result.steps * 2)) {
      appendMessage(message);
    }
    logRun(workflow.id, `تشغيل يدوي — ${result.steps} عقدة (${result.status === 'waiting' ? 'توقف عند انتظار' : 'اكتمل'})`);
    setToast(`شُغّل «${workflow.name}» — ${result.steps} عقدة`);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">الأتمتة — للمدير</p>
          <h1 className="text-2xl font-bold text-slate-900">سير العمل</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            مخططات عقد مرسومة: محفّز (كلمة مفتاحية / عميل جديد / عدم رد / خمول / يدوي) يشغّل سلسلة عقد —
            رسائل، صور، مواقع، تعيين وكيل، إسناد لموظف، طلبات وفواتير، انتظار، شروط، وانتقالات.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ open: true, workflow: null })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          سير عمل جديد
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 flex flex-col items-center justify-center text-center">
          <WorkflowIcon className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
          <p className="font-semibold text-slate-700 mb-1">لا سيرات عمل بعد</p>
          <p className="text-sm text-slate-400 mb-5">ارسم أول سير: محفّز وسلسلة عقد تنفذ أنواعاً من القائمة.</p>
          <button
            type="button"
            onClick={() => setModal({ open: true, workflow: null })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            سير عمل جديد
          </button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {workflows.map((workflow) => (
            <li key={workflow.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${workflow.enabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    <WorkflowIcon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-800">{workflow.name}</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${workflow.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {workflow.enabled ? 'مفعّل' : 'متوقف'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">المحفّز: {triggerLabel(workflow)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={workflow.enabled}
                    aria-label={`تفعيل ${workflow.name}`}
                    onClick={() => toggleEnabled(workflow)}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${workflow.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${workflow.enabled ? 'right-0.5' : 'right-[22px]'}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRun(workflow)}
                    title="تشغيل يدوي الآن"
                    className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    <Play className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ open: true, workflow })}
                    title="فتح المحرر"
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(workflow)}
                    title="حذف"
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {workflow.nodes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {workflow.nodes.slice(0, 8).map((node) => (
                    <span key={node.id} className="inline-flex items-center rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                      {nodeKindLabel(node.kind)}
                    </span>
                  ))}
                  {workflow.nodes.length > 8 && (
                    <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-400">
                      +{workflow.nodes.length - 8}
                    </span>
                  )}
                </div>
              )}

              {workflow.runs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400 mb-1.5">آخر التشغيلات</p>
                  <ul className="space-y-1">
                    {workflow.runs.slice(0, 3).map((run, index) => (
                      <li key={index} className="text-[11px] text-slate-400">
                        <span className="text-slate-300">{formatRunTime(run.at)}</span> — {run.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {modal.open && (
        <WorkflowModal
          initial={modal.workflow}
          onClose={() => setModal({ open: false, workflow: null })}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ConfirmDialog
          categoryName={deleting.name}
          itemLabel="سير العمل"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {toast && (
        <div aria-live="polite" className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
            <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
