"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  addDoc,
  collection,
  onSnapshot,
  doc,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  QueryDocumentSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { auth, db, hasFirebaseConfig } from "@/lib/firebase";

type RequestType = "PEDIDO" | "OFERTA";
type Category = "AGUA" | "COMIDA" | "ABRIGO" | "TRANSPORTE" | "SAUDE" | "OUTRO";
type Urgency = "CRITICO" | "NECESSARIO" | "APOIO";

type PostForm = {
  nome: string;
  localizacao: string;
  tipo: RequestType;
  categoria: Category;
  urgencia: Urgency;
  descricao: string;
  contacto: string;
};

type Interaction = PostForm & {
  id: string;
  authorUid?: string;
  confirmationUids?: string[];
  resolvido: boolean;
  createdAt?: {
    seconds: number;
  };
};

const BAIRROS = [
  "Bairro das Bimbas",
  "Calomanga",
  "Caloburaco",
  "Tchipiandalo",
  "Massangarala",
  "Cotel",
  "Santa Teresa",
  "Centro de Benguela",
  "Outra zona",
];

const INITIAL_FORM: PostForm = {
  nome: "",
  localizacao: "Bairro das Bimbas",
  tipo: "PEDIDO",
  categoria: "AGUA",
  urgencia: "NECESSARIO",
  descricao: "",
  contacto: "",
};

const URGENCY_STYLES: Record<Urgency, string> = {
  CRITICO: "border-red-300 bg-red-100 text-red-900",
  NECESSARIO: "border-amber-300 bg-amber-100 text-amber-900",
  APOIO: "border-sky-300 bg-sky-100 text-sky-900",
};

const LABEL_TIPO: Record<RequestType, string> = {
  PEDIDO: "Pedido",
  OFERTA: "Oferta",
};

const LABEL_CATEGORIA: Record<Category, string> = {
  AGUA: "Água",
  COMIDA: "Comida",
  ABRIGO: "Abrigo",
  TRANSPORTE: "Transporte",
  SAUDE: "Saúde",
  OUTRO: "Outro",
};

const LABEL_URGENCIA: Record<Urgency, string> = {
  CRITICO: "Crítico",
  NECESSARIO: "Necessário",
  APOIO: "Apoio",
};

const STATUS_STYLES = {
  ativo: "border-emerald-200 bg-emerald-50 text-emerald-800",
  resolvido: "border-slate-200 bg-slate-100 text-slate-700",
} as const;

const PAGE_SIZE = 5;

function buildWhatsAppLink(raw: string) {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 9) {
    return `https://wa.me/244${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("244")) {
    return `https://wa.me/${digits}`;
  }

  return null;
}

function normalizeAngolaPhoneNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 9) {
    return digits;
  }

  if (digits.length === 12 && digits.startsWith("244")) {
    return digits;
  }

  return null;
}

function buildNativeContactLink(raw: string, scheme: "tel" | "sms") {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 9) {
    return `${scheme}:+244${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("244")) {
    return `${scheme}:+${digits}`;
  }

  return null;
}

export default function Home() {
  const [form, setForm] = useState<PostForm>(INITIAL_FORM);
  const [items, setItems] = useState<Interaction[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [topPageIds, setTopPageIds] = useState<string[]>([]);
  const [localFilter, setLocalFilter] = useState("TODOS");
  const [typeFilter, setTypeFilter] = useState<"TODOS" | RequestType>("TODOS");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "ACTIVOS" | "RESOLVIDOS">(
    "TODOS",
  );

  const scrollToBoard = () => {
    document.getElementById("mural-board")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const scrollToPublishForm = () => {
    document.getElementById("publish-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const scrollToTop = () => {
    window.scrollTo({ behavior: "smooth", top: 0 });
  };

  const mergePageItems = (existing: Interaction[], incoming: Interaction[]) => {
    const itemMap = new Map(existing.map((item) => [item.id, item]));

    for (const item of incoming) {
      itemMap.set(item.id, item);
    }

    return Array.from(itemMap.values()).sort((left, right) => {
      const leftTime = left.createdAt?.seconds ?? Infinity;
      const rightTime = right.createdAt?.seconds ?? Infinity;

      return rightTime - leftTime;
    });
  };

  const loadMoreItems = async () => {
    if (!db || !lastVisible || !hasMoreItems || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const nextPageQuery = query(
        collection(db, "interacoes"),
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(PAGE_SIZE),
      );
      const snapshot = await getDocs(nextPageQuery);
      const docs = snapshot.docs.map((item) => {
        const data = item.data() as Omit<Interaction, "id">;
        return {
          ...data,
          id: item.id,
        };
      });

      setItems((current) => mergePageItems(current, docs));
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] ?? null);
      setHasMoreItems(snapshot.docs.length === PAGE_SIZE);
    } catch {
      setError("Não foi possível carregar mais registos.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silent fail: app must still work without service worker.
    });
  }, []);

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      return;
    }

    signInAnonymously(auth)
      .then((credential) => {
        setCurrentUserId(credential.user.uid);
      })
      .catch((e) => {
        console.warn("Aviso Auth Anónima:", e.message);
      });
  }, []);

  useEffect(() => {
    if (!hasFirebaseConfig || !db) {
      return;
    }

    setIsLoaded(false);
    setError(null);

    const firstPageQuery = query(
      collection(db, "interacoes"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE),
    );

    const unsubscribe = onSnapshot(
      firstPageQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((item) => {
          const data = item.data() as Omit<Interaction, "id">;
          return {
            ...data,
            id: item.id,
          };
        });

        setItems((current) => mergePageItems(current, docs));
        setLastVisible(snapshot.docs[snapshot.docs.length - 1] ?? null);
        setHasMoreItems(snapshot.docs.length === PAGE_SIZE);
        setTopPageIds(snapshot.docs.map((item) => item.id));
        setIsLoaded(true);
      },
      (err) => {
        console.error("Erro no mural:", err);
        setError("Não foi possível carregar os dados agora.");
        setIsLoaded(true);
      },
    );

    return () => unsubscribe();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === "ACTIVOS" && item.resolvido) {
        return false;
      }

      if (statusFilter === "RESOLVIDOS" && !item.resolvido) {
        return false;
      }

      if (localFilter !== "TODOS" && item.localizacao !== localFilter) {
        return false;
      }

      if (typeFilter !== "TODOS" && item.tipo !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [items, localFilter, statusFilter, typeFilter]);

  const visibleCount = filteredItems.length;
  const activeCount = filteredItems.filter((item) => !item.resolvido).length;
  const resolvedCount = filteredItems.filter((item) => item.resolvido).length;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasFirebaseConfig || !db) {
      setError("Configura o Firebase para publicar pedidos e ofertas.");
      return;
    }

    const trimmedNome = form.nome.trim().slice(0, 40);
    const trimmedDesc = form.descricao.trim().slice(0, 300);
    const trimmedContacto = form.contacto.trim().slice(0, 12);
    const normalizedContacto = normalizeAngolaPhoneNumber(trimmedContacto);

    if (!currentUserId) {
      setError("A autenticação ainda não terminou. Tenta novamente em instantes.");
      return;
    }

    if (form.nome.length > 40 || form.descricao.length > 300 || form.contacto.length > 12) {
      setError("Revê os limites dos campos antes de publicar.");
      return;
    }

    if (!trimmedDesc || !normalizedContacto) {
      setError("Descrição e contacto são obrigatórios.");
      return;
    }

    if (!normalizedContacto) {
      setError("Por favor, insira um número válido: 9 dígitos ou 244 + 9 dígitos.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      await addDoc(collection(db, "interacoes"), {
        ...form,
        nome: trimmedNome,
        descricao: trimmedDesc,
        contacto: normalizedContacto,
        authorUid: currentUserId,
        confirmationUids: [],
        resolvido: false,
        createdAt: serverTimestamp(),
      });

      setForm((current) => ({ ...INITIAL_FORM, localizacao: current.localizacao }));
    } catch {
      setError("Não foi possível publicar agora. Tenta novamente em instantes.");
    } finally {
      setIsSaving(false);
    }
  };

  const markAsResolved = async (id: string) => {
    if (!db || !currentUserId) {
      return;
    }

    try {
      await updateDoc(doc(db, "interacoes", id), { resolvido: true });
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, resolvido: true } : item)),
      );
    } catch {
      setError("Não foi possível marcar como resolvido.");
    }
  };

  const confirmResolution = async (id: string) => {
    if (!db || !currentUserId) {
      return;
    }

    const firestore = db;
    let confirmationApplied = false;

    try {
      await runTransaction(firestore, async (transaction) => {
        const ref = doc(firestore, "interacoes", id);
        const snapshot = await transaction.get(ref);

        if (!snapshot.exists()) {
          return;
        }

        const data = snapshot.data() as Interaction;
        const confirmations = data.confirmationUids ?? [];

        if (data.resolvido || data.authorUid === currentUserId || confirmations.includes(currentUserId)) {
          return;
        }

        const nextConfirmations = [...confirmations, currentUserId];
        const shouldResolve = nextConfirmations.length >= 2;

        confirmationApplied = true;

        transaction.update(ref, {
          confirmationUids: nextConfirmations,
          resolvido: shouldResolve,
        });
      });

      if (confirmationApplied) {
        setItems((current) =>
          current.map((item) => {
            if (item.id !== id) {
              return item;
            }

            const confirmations = item.confirmationUids ?? [];
            const nextConfirmations = confirmations.includes(currentUserId)
              ? confirmations
              : [...confirmations, currentUserId];

            return {
              ...item,
              confirmationUids: nextConfirmations,
              resolvido: nextConfirmations.length >= 2 || item.resolvido,
            };
          }),
        );
      }
    } catch {
      setError("Não foi possível confirmar a resolução.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3 pb-24 pt-4 sm:gap-8 sm:px-6 sm:py-10">
      <header className="hero-panel rounded-2xl p-4 sm:p-8">
        <p className="text-xs tracking-[0.2em] text-slate-200/90">BENGUELA AJUDA</p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-white sm:mt-3 sm:text-4xl">
          Mural de Solidariedade: Tenho / Preciso
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 sm:mt-4 sm:text-base">
          Publica rapidamente pedidos e ofertas de apoio em Benguela. Prioriza mensagens curtas,
          localização correta e contacto activo no WhatsApp.
        </p>
      </header>

      <section className="card-surface overflow-hidden rounded-2xl">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative min-h-[220px] sm:min-h-[280px] lg:min-h-[340px]">
            <Image
              src="/benguela-ajuda-1.jpg"
              alt="Bombeiros e policias a ajudar senhoras a atravessar aguas da inundacao em Benguela, com outras pessoas com agua ate ao peito ao lado"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center gap-3 p-4 sm:p-6 lg:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Situação no terreno
            </p>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Resposta rápida para quem está em risco
            </h2>
            <p className="text-sm leading-6 text-slate-600 sm:text-base">
              Esta imagem mostra a urgência de ligar pedidos, ofertas e apoio real no mesmo
              momento. O mural foi desenhado para funcionar bem no telemóvel, mesmo com pouca
              infraestrutura.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                Chamada normal
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                SMS
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                WhatsApp
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-10px_30px_rgba(16,36,61,0.12)] backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3">
          <button type="button" onClick={scrollToBoard} className="secondary-btn w-full py-3 text-sm">
            Ver mural
          </button>
          <button type="button" onClick={scrollToPublishForm} className="primary-btn w-full py-3 text-sm">
            Publicar
          </button>
        </div>
      </div>

      {hasFirebaseConfig && !isLoaded && (
        <section className="rounded-xl border border-slate-300 bg-white/80 p-4 text-sm text-slate-700">
          A carregar o mural...
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[390px_1fr]">
        <section id="publish-form" className="card-surface rounded-2xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Publicar pedido ou oferta</h2>
          <p className="mt-1 text-sm text-slate-600">Campos com * são obrigatórios.</p>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <label className="block">
              <div className="mb-1 flex items-center justify-between">
                <span className="label mb-0!">Nome (opcional)</span>
                <span className="text-xs text-slate-400">{40 - form.nome.length} restantes</span>
              </div>
              <input
                value={form.nome}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, nome: event.target.value.slice(0, 40) }))
                }
                className="input"
                placeholder="Ex: Ana"
                maxLength={40}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Tipo *</span>
                <select
                  value={form.tipo}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, tipo: event.target.value as RequestType }))
                  }
                  className="input"
                >
                  <option value="PEDIDO">Preciso de ajuda</option>
                  <option value="OFERTA">Tenho como ajudar</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Urgência *</span>
                <select
                  value={form.urgencia}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, urgencia: event.target.value as Urgency }))
                  }
                  className="input"
                >
                  <option value="CRITICO">Crítico</option>
                  <option value="NECESSARIO">Necessário</option>
                  <option value="APOIO">Apoio</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Categoria *</span>
                <select
                  value={form.categoria}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, categoria: event.target.value as Category }))
                  }
                  className="input"
                >
                  <option value="AGUA">Água</option>
                  <option value="COMIDA">Comida</option>
                  <option value="ABRIGO">Abrigo</option>
                  <option value="TRANSPORTE">Transporte</option>
                  <option value="SAUDE">Saúde</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Localização *</span>
                <select
                  value={form.localizacao}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, localizacao: event.target.value }))
                  }
                  className="input"
                >
                  {BAIRROS.map((bairro) => (
                    <option key={bairro} value={bairro}>
                      {bairro}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <div className="mb-1 flex items-center justify-between">
                <span className="label mb-0!">Descrição *</span>
                <span className="text-xs text-slate-400">
                  {300 - form.descricao.length} caracteres
                </span>
              </div>
              <textarea
                value={form.descricao}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, descricao: event.target.value.slice(0, 300) }))
                }
                className="input min-h-24"
                placeholder="Ex: Preciso de transporte para 2 idosos para zona alta."
                required
                maxLength={300}
              />
            </label>

            <label className="block">
              <span className="label">Contacto (telefone ou WhatsApp) *</span>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="tel-national"
                value={form.contacto}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    contacto: event.target.value.replace(/\D/g, "").slice(0, 12),
                  }))
                }
                className="input"
                placeholder="Ex: 923000000 ou 244923000000"
                required
                maxLength={12}
              />
              <p className="mt-1 text-xs text-slate-500">
                Aceitamos apenas números válidos de Angola: 923000000 ou 244923000000.
              </p>
            </label>

            <button type="submit" className="primary-btn w-full py-3 sm:py-2" disabled={isSaving}>
              {isSaving ? "A publicar..." : "Publicar agora"}
            </button>
          </form>
        </section>

        <section id="mural-board" className="space-y-4">
          <div className="card-surface rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-slate-900">Filtrar mural</h2>
              <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <strong className="font-semibold">Importante:</strong> cada publicação é fixa.
                Só o autor ou 2 confirmações independentes podem marcar como resolvida.
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="label">Tipo</span>
                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as "TODOS" | RequestType)
                  }
                  className="input"
                >
                  <option value="TODOS">Todos</option>
                  <option value="PEDIDO">Pedidos</option>
                  <option value="OFERTA">Ofertas</option>
                </select>
              </label>

              <label className="block">
                <span className="label">Bairro</span>
                <select
                  value={localFilter}
                  onChange={(event) => setLocalFilter(event.target.value)}
                  className="input"
                >
                  <option value="TODOS">Todos</option>
                  {BAIRROS.map((bairro) => (
                    <option key={bairro} value={bairro}>
                      {bairro}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label">Estado</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "TODOS" | "ACTIVOS" | "RESOLVIDOS")
                  }
                  className="input"
                >
                  <option value="TODOS">Todos</option>
                  <option value="ACTIVOS">Ver apenas activos</option>
                  <option value="RESOLVIDOS">Ver apenas resolvidos</option>
                </select>
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-900">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Mostrando os registos mais recentes carregados em páginas de {PAGE_SIZE} itens.
          </p>

          <ul className="space-y-3">
            {filteredItems.map((item) => {
              const whatsappLink = buildWhatsAppLink(item.contacto);
              const callLink = buildNativeContactLink(item.contacto, "tel");
              const smsLink = buildNativeContactLink(item.contacto, "sms");
              const dateText = item.createdAt?.seconds
                ? new Date(item.createdAt.seconds * 1000).toLocaleString("pt-PT")
                : "agora";
              const canResolveItem = Boolean(currentUserId && item.authorUid && item.authorUid === currentUserId);
              const canConfirmItem = Boolean(
                currentUserId &&
                  item.authorUid &&
                  item.authorUid !== currentUserId &&
                  !item.resolvido &&
                  !(item.confirmationUids ?? []).includes(currentUserId),
              );
              const confirmationCount = item.confirmationUids?.length ?? 0;
              const isTopPageItem = topPageIds.includes(item.id);
              const isHistoricalItem = !isTopPageItem;

              return (
                <li key={item.id} className="card-surface rounded-2xl p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${isTopPageItem ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                    >
                      {isTopPageItem ? "Novo" : "Histórico"}
                    </span>
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                      {LABEL_TIPO[item.tipo]}
                    </span>
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                      {LABEL_CATEGORIA[item.categoria]}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${URGENCY_STYLES[item.urgencia]}`}
                    >
                      {LABEL_URGENCIA[item.urgencia]}
                    </span>
                    <span className="text-xs text-slate-500">{item.localizacao}</span>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${item.resolvido ? STATUS_STYLES.resolvido : STATUS_STYLES.ativo}`}
                    >
                      {item.resolvido ? "Resolvido" : "Activo"}
                    </span>
                    {isTopPageItem && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                        Destaque em tempo real
                      </span>
                    )}
                    {isHistoricalItem && (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                        Carregado por página
                      </span>
                    )}
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                      {confirmationCount} confirmações
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-800">{item.descricao}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span>{item.nome || "Anónimo"}</span>
                    <span>•</span>
                    <span>{dateText}</span>
                    <span>•</span>
                    <span>{item.contacto}</span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                    {callLink && (
                      <a
                        href={callLink}
                        className="call-btn w-full text-center sm:w-auto"
                      >
                        Ligar
                      </a>
                    )}

                    {smsLink && (
                      <a href={smsLink} className="sms-btn w-full text-center sm:w-auto">
                        Mensagem
                      </a>
                    )}

                    {whatsappLink && (
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="whatsapp-btn w-full text-center sm:w-auto"
                      >
                        WhatsApp
                      </a>
                    )}

                    {!item.resolvido && canResolveItem && (
                      <button
                        type="button"
                        className="resolve-btn w-full sm:w-auto"
                        onClick={() => markAsResolved(item.id)}
                      >
                        Já resolvido
                      </button>
                    )}

                    {!item.resolvido && canConfirmItem && (
                      <button
                        type="button"
                        className="sms-btn w-full sm:w-auto"
                        onClick={() => confirmResolution(item.id)}
                      >
                        Confirmar
                      </button>
                    )}

                    {!item.resolvido && !canResolveItem && !canConfirmItem && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-500 sm:w-auto">
                        Só o autor pode resolver
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {hasMoreItems && (
            <div className="pt-2">
              <button
                type="button"
                onClick={loadMoreItems}
                disabled={isLoadingMore}
                className="secondary-btn w-full py-3 text-sm sm:w-auto"
              >
                {isLoadingMore ? "A carregar mais..." : "Carregar mais"}
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-10px_30px_rgba(16,36,61,0.12)] backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_auto_auto] items-center gap-2">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Visíveis</p>
            <p className="truncate text-sm font-semibold text-slate-900">{visibleCount} registos</p>
            <p className="text-[11px] text-slate-500">
              {activeCount} activos · {resolvedCount} resolvidos
            </p>
          </div>
          <button type="button" onClick={scrollToBoard} className="secondary-btn px-4 py-3 text-sm">
            Filtrar
          </button>
          <button type="button" onClick={scrollToTop} className="secondary-btn px-4 py-3 text-sm">
            Topo
          </button>
          <button type="button" onClick={scrollToPublishForm} className="primary-btn px-4 py-3 text-sm">
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}
