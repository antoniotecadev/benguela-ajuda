import Image from "next/image";
import HomeClient from "./home-client";

const AUTHOR_NAME = "António Teca";
const AUTHOR_EMAIL = "antonioteca@hotmail.com";
const AUTHOR_LOCATION = "Luanda";
const AUTHOR_WHATSAPP = "932359808";
const AUTHOR_WHATSAPP_LINK = `https://wa.me/244${AUTHOR_WHATSAPP}`;
const AUTHOR_42_LUANDA_LINK = "https://web.facebook.com/42luanda";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3 pb-24 pt-4 sm:gap-8 sm:px-6 sm:py-10">
      <header className="hero-panel rounded-2xl p-4 sm:p-8">
        <p className="text-xs tracking-[0.2em] text-slate-200/90">BENGUELA, ANGOLA</p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-white sm:mt-3 sm:text-4xl">
          Benguela Ajuda: mural solidário para pedidos e ofertas em Benguela, Angola
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 sm:mt-4 sm:text-base">
          Encontra pedidos e ofertas de apoio em Benguela, Angola. O mural é leve, funciona bem
          no telemóvel e liga água, comida, abrigo, transporte e contacto direto entre pessoas.
        </p>
      </header>

      <section className="card-surface overflow-hidden rounded-2xl">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative min-h-55 sm:min-h-70 lg:min-h-85">
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
              Benguela, Angola
            </p>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Resposta rápida para quem precisa de apoio em Benguela, Angola
            </h2>
            <p className="text-sm leading-6 text-slate-600 sm:text-base">
              Esta imagem mostra a urgência de ligar pedidos, ofertas e apoio real no mesmo
              momento. O mural foi desenhado para funcionar bem no telemóvel, mesmo com pouca
              infraestrutura, e para ajudar quem procura resposta rápida em Benguela, Angola.
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

      <HomeClient />

      <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Autor
            </p>
            <h2 className="mt-1 text-base font-semibold text-slate-900 sm:text-lg">{AUTHOR_NAME}</h2>
            <p className="mt-1.5 text-[8px] text-slate-600 sm:text-sm">
              Cadete{' '}
              <a
                href={AUTHOR_42_LUANDA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-3 transition hover:decoration-slate-900"
              >
                42 Luanda
              </a>
              {' '}| E-mail{' '}
              <a
                href={`mailto:${AUTHOR_EMAIL}`}
                className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-3 transition hover:decoration-slate-900"
              >
                {AUTHOR_EMAIL}
              </a>
              {' '}| WhatsApp{' '}
              <a
                href={AUTHOR_WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-3 transition hover:decoration-slate-900"
              >
                +244 {AUTHOR_WHATSAPP}
              </a>
            </p>
            <p className="mt-1 text-[8px] text-slate-500 sm:text-xs">{AUTHOR_LOCATION}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
