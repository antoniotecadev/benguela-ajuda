"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
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

export default function Home() {
  const [form, setForm] = useState<PostForm>(INITIAL_FORM);
  const [items, setItems] = useState<Interaction[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [localFilter, setLocalFilter] = useState("TODOS");
  const [typeFilter, setTypeFilter] = useState<"TODOS" | RequestType>("TODOS");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "ATIVOS" | "RESOLVIDOS">(
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

    signInAnonymously(auth).catch((e) => {
      console.warn("Aviso Auth Anónima:", e.message);
    });
  }, []);

  useEffect(() => {
    if (!hasFirebaseConfig || !db) {
      return;
    }

    const unsub = onSnapshot(
      query(collection(db, "interacoes"), limit(150)),
      (snapshot) => {
        const docs = snapshot.docs.map((item) => {
          const data = item.data() as Omit<Interaction, "id">;
          return {
            ...data,
            id: item.id,
          };
        });

        setItems(
          docs.sort((left, right) => {
            const leftTime = left.createdAt?.seconds ?? Infinity;
            const rightTime = right.createdAt?.seconds ?? Infinity;

            return rightTime - leftTime;
          }),
        );
        setIsLoaded(true);
      },
      (err) => {
        console.error("Erro no mural:", err);
        setError("Não foi possível carregar os dados agora.");
        setIsLoaded(true);
      },
    );

    return () => unsub();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === "ATIVOS" && item.resolvido) {
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
    if (!db) {
      return;
    }

    try {
      await updateDoc(doc(db, "interacoes", id), { resolvido: true });
    } catch {
      setError("Não foi possível marcar como resolvido.");
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
              <p className="text-xs text-slate-500">
                Cada publicação é fixa: depois de criada, só pode ser marcada como resolvida.
              </p>
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
                    setStatusFilter(event.target.value as "TODOS" | "ATIVOS" | "RESOLVIDOS")
                  }
                  className="input"
                >
                  <option value="TODOS">Todos</option>
                  <option value="ATIVOS">Ver apenas activos</option>
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

          <ul className="space-y-3">
            {filteredItems.map((item) => {
              const whatsappLink = buildWhatsAppLink(item.contacto);
              const dateText = item.createdAt?.seconds
                ? new Date(item.createdAt.seconds * 1000).toLocaleString("pt-PT")
                : "agora";

              return (
                <li key={item.id} className="card-surface rounded-2xl p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
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
                      {item.resolvido ? "Resolvido" : "Ativo"}
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
                    {whatsappLink && (
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="secondary-btn w-full text-center sm:w-auto"
                      >
                        Contactar no WhatsApp
                      </a>
                    )}

                    {!item.resolvido && (
                      <button
                        type="button"
                        className="resolve-btn w-full sm:w-auto"
                        onClick={() => markAsResolved(item.id)}
                      >
                        Já resolvido
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-10px_30px_rgba(16,36,61,0.12)] backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_auto_auto] items-center gap-2">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Visíveis</p>
            <p className="truncate text-sm font-semibold text-slate-900">{visibleCount} registos</p>
            <p className="text-[11px] text-slate-500">
              {activeCount} ativos · {resolvedCount} resolvidos
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
