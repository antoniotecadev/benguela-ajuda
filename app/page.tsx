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

function buildWhatsAppLink(raw: string) {
  const digits = raw.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  const normalized = digits.startsWith("244") ? digits : `244${digits}`;
  return `https://wa.me/${normalized}`;
}

export default function Home() {
  const [form, setForm] = useState<PostForm>(INITIAL_FORM);
  const [items, setItems] = useState<Interaction[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [localFilter, setLocalFilter] = useState("TODOS");
  const [typeFilter, setTypeFilter] = useState<"TODOS" | RequestType>("TODOS");
  const [hideResolved, setHideResolved] = useState(true);

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
      if (hideResolved && item.resolvido) {
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
  }, [hideResolved, items, localFilter, typeFilter]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasFirebaseConfig || !db) {
      setError("Configura o Firebase para publicar pedidos e ofertas.");
      return;
    }

    const trimmedNome = form.nome.trim().slice(0, 40);
    const trimmedDesc = form.descricao.trim().slice(0, 300);
    const trimmedContacto = form.contacto.trim().slice(0, 20);

    if (!trimmedDesc || !trimmedContacto) {
      setError("Descrição e contacto são obrigatórios.");
      return;
    }

    if (!/^[0-9+\-\s()]+$/.test(trimmedContacto)) {
      setError("Por favor, insira apenas um número de telefone (ex: 923000000).");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      await addDoc(collection(db, "interacoes"), {
        ...form,
        nome: trimmedNome,
        descricao: trimmedDesc,
        contacto: trimmedContacto,
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <header className="hero-panel rounded-2xl p-5 sm:p-8">
        <p className="text-xs tracking-[0.2em] text-slate-200/90">BENGUELA AJUDA</p>
        <h1 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-4xl">
          Mural de Solidariedade: Tenho / Preciso
        </h1>
        <p className="mt-4 max-w-3xl text-sm text-slate-200 sm:text-base">
          Publica rapidamente pedidos e ofertas de apoio em Benguela. Prioriza mensagens curtas,
          localização correta e contacto activo no WhatsApp.
        </p>
      </header>

      {!hasFirebaseConfig && (
        <section className="rounded-xl border border-amber-300 bg-amber-100 p-4 text-sm text-amber-900">
          Firebase ainda não configurado. Define variaveis NEXT_PUBLIC_FIREBASE_* para ativar o
          mural em tempo real.
        </section>
      )}

      {hasFirebaseConfig && !isLoaded && (
        <section className="rounded-xl border border-slate-300 bg-white/80 p-4 text-sm text-slate-700">
          A carregar o mural...
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
        <section className="card-surface rounded-2xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Publicar pedido ou oferta</h2>
          <p className="mt-1 text-sm text-slate-600">Campos com * são obrigatórios.</p>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <label className="block">
              <span className="label">Nome (opcional)</span>
              <input
                value={form.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
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
                <span className="label !mb-0">Descrição *</span>
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
                value={form.contacto}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    contacto: event.target.value.replace(/[^0-9+\-\s()]/g, "").slice(0, 20),
                  }))
                }
                className="input"
                placeholder="Ex: 923000000"
                required
                maxLength={20}
              />
            </label>

            <button type="submit" className="primary-btn w-full" disabled={isSaving}>
              {isSaving ? "A publicar..." : "Publicar agora"}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="card-surface rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Filtrar mural</h2>
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

              <label className="flex items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 pb-3 pt-6">
                <input
                  type="checkbox"
                  checked={hideResolved}
                  onChange={(event) => setHideResolved(event.target.checked)}
                />
                <span className="text-sm text-slate-700">Esconder resolvidos</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-900">
              {error}
            </div>
          )}

          <ul className="space-y-3">
            {filteredItems.length === 0 && (
              <li className="card-surface rounded-2xl p-6 text-sm text-slate-600">
                Sem registos para este filtro neste momento.
              </li>
            )}

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
                    {item.resolvido && (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900">
                        Resolvido
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-sm text-slate-800">{item.descricao}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span>{item.nome || "Anónimo"}</span>
                    <span>•</span>
                    <span>{dateText}</span>
                    <span>•</span>
                    <span>{item.contacto}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {whatsappLink && (
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="secondary-btn"
                      >
                        Contactar no WhatsApp
                      </a>
                    )}

                    {!item.resolvido && (
                      <button
                        type="button"
                        className="resolve-btn"
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
    </div>
  );
}
