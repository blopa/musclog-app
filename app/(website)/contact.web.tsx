'use client';

import { ExternalLink, Mail, MessageSquare, Send, Shield } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FloatingShapes, GridPattern } from '@/components/website/WebsiteBackgrounds';

const BRAND_GREEN_BRIGHT = '#00FFA3';
const BODY_TEXT_SOFT = '#9CA3AF';
const MUTED = '#6B7280';

interface FormState {
    email: string;
    message: string;
    name: string;
    subject: string;
}

export default function Contact() {
    const { t } = useTranslation(undefined, { keyPrefix: 'website.contact' });
    const [form, setForm] = useState<FormState>({ email: '', message: '', name: '', subject: '' });
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
    };

    const mailtoUrl = `mailto:support@musclog.app?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(
        `Name: ${form.name}\nEmail: ${form.email}\n\nMessage:\n${form.message}`
    )}`;

    const connectLinks = [
        {
            description: t('connect.github.description'),
            href: 'https://github.com/blopa/musclog-app',
            icon: ExternalLink,
            title: t('connect.github.title'),
        },
        {
            description: t('connect.discord.description'),
            href: '#',
            icon: MessageSquare,
            title: t('connect.discord.title'),
        },
        {
            description: t('connect.email.description'),
            href: 'mailto:support@musclog.app',
            icon: Mail,
            title: t('connect.email.title'),
        },
    ];

    return (
        <main className="relative overflow-hidden pb-20 pt-28">
            <GridPattern className="text-primary/50" />
            <FloatingShapes />

            <div
                className="absolute left-1/4 top-40 h-72 w-72 rounded-full blur-[100px]"
                style={{ backgroundColor: 'rgba(0,255,163,0.10)' }}
            />
            <div
                className="absolute bottom-20 right-1/4 h-64 w-64 rounded-full blur-[80px]"
                style={{ backgroundColor: 'rgba(6,182,212,0.10)' }}
            />
            <div className="from-background/30 to-background/30 absolute inset-0 bg-gradient-to-b via-transparent" />

            <div className="container relative z-10 mx-auto max-w-5xl px-4">
                {/* Title */}
                <div className="mb-12 text-center">
                    <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">
                        {t('titleStart')}{' '}
                        <span style={{ color: BRAND_GREEN_BRIGHT }}>{t('titleHighlight')}</span>
                    </h1>
                    <p className="mx-auto max-w-lg leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                        {t('description')}
                    </p>
                </div>

                {/* Two-column layout */}
                <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
                    {/* Contact Form */}
                    <div
                        className="rounded-2xl border p-6 md:p-8"
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            borderColor: 'rgba(255,255,255,0.1)',
                        }}
                    >
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-white" htmlFor="name">
                                        {t('form.fullName')}
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        placeholder={t('form.placeholders.fullName')}
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })}
                                        required
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm text-white transition-colors placeholder:text-gray-500 focus:outline-none focus:ring-2"
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            borderColor: 'rgba(255,255,255,0.12)',
                                        }}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-white" htmlFor="email">
                                        {t('form.email')}
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        placeholder={t('form.placeholders.email')}
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: (e.target as HTMLInputElement).value })}
                                        required
                                        className="w-full rounded-lg border px-3 py-2.5 text-sm text-white transition-colors placeholder:text-gray-500 focus:outline-none focus:ring-2"
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            borderColor: 'rgba(255,255,255,0.12)',
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-white" htmlFor="subject">
                                    {t('form.subject')}
                                </label>
                                <input
                                    id="subject"
                                    type="text"
                                    placeholder={t('form.placeholders.subject')}
                                    value={form.subject}
                                    onChange={(e) => setForm({ ...form, subject: (e.target as HTMLInputElement).value })}
                                    required
                                    className="w-full rounded-lg border px-3 py-2.5 text-sm text-white transition-colors placeholder:text-gray-500 focus:outline-none focus:ring-2"
                                    style={{
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        borderColor: 'rgba(255,255,255,0.12)',
                                    }}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-white" htmlFor="message">
                                    {t('form.message')}
                                </label>
                                <textarea
                                    id="message"
                                    rows={6}
                                    placeholder={t('form.placeholders.message')}
                                    value={form.message}
                                    onChange={(e) => setForm({ ...form, message: (e.target as HTMLTextAreaElement).value })}
                                    required
                                    className="w-full resize-none rounded-lg border px-3 py-2.5 text-sm text-white transition-colors placeholder:text-gray-500 focus:outline-none focus:ring-2"
                                    style={{
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        borderColor: 'rgba(255,255,255,0.12)',
                                    }}
                                />
                            </div>

                            {!submitted ? (
                                <button
                                    type="submit"
                                    className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
                                    style={{ background: 'linear-gradient(to right, #4f46e5, #10b981)' }}
                                >
                                    <Send className="h-4 w-4" color="white" />
                                    {t('form.submit')}
                                </button>
                            ) : (
                                <div className="space-y-4">
                                    <a
                                        href={mailtoUrl}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
                                        style={{ background: 'linear-gradient(to right, #4f46e5, #10b981)' }}
                                    >
                                        <Mail className="h-4 w-4" color="white" />
                                        {t('form.mailto')}
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSubmitted(false);
                                            setForm({ email: '', message: '', name: '', subject: '' });
                                        }}
                                        className="w-full text-center text-sm underline underline-offset-4 transition-colors hover:text-white"
                                        style={{ color: MUTED }}
                                    >
                                        {t('form.startOver')}
                                    </button>
                                    <p className="text-center text-xs" style={{ color: MUTED }}>
                                        {t('form.helpText')}
                                    </p>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Right column */}
                    <div className="flex flex-col gap-4">
                        {/* Connect with Us */}
                        <div
                            className="rounded-2xl border p-6"
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            }}
                        >
                            <h2 className="mb-5 text-lg font-semibold text-white">{t('connect.title')}</h2>
                            <div className="space-y-5">
                                {connectLinks.map(({ description, href, icon: Icon, title }) => (
                                    <a key={title} href={href} className="group flex items-start gap-4">
                                        <div
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors"
                                            style={{
                                                backgroundColor: 'rgba(255,255,255,0.04)',
                                                borderColor: 'rgba(255,255,255,0.1)',
                                            }}
                                        >
                                            <Icon className="h-4 w-4" color={MUTED} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">{title}</p>
                                            <p className="mt-0.5 text-xs leading-relaxed" style={{ color: MUTED }}>
                                                {description}
                                            </p>
                                        </div>
                                    </a>
                                ))}
                            </div>

                            <div
                                className="mt-6 border-t pt-5"
                                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                            >
                                <p
                                    className="mb-3 text-xs font-semibold uppercase tracking-widest"
                                    style={{ color: MUTED }}
                                >
                                    {t('connect.follow')}
                                </p>
                                <div className="flex gap-3">
                                    <a
                                        href="#"
                                        aria-label="YouTube"
                                        className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:border-primary/40 hover:text-white"
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.04)',
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            color: MUTED,
                                        }}
                                    >
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                        </svg>
                                    </a>
                                    <a
                                        href="#"
                                        aria-label="X (Twitter)"
                                        className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:border-primary/40 hover:text-white"
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.04)',
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            color: MUTED,
                                        }}
                                    >
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Privacy First notice */}
                        <div
                            className="flex items-start gap-4 rounded-2xl border p-5"
                            style={{
                                backgroundColor: 'rgba(0,255,163,0.04)',
                                borderColor: 'rgba(0,255,163,0.2)',
                            }}
                        >
                            <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                                style={{
                                    backgroundColor: 'rgba(0,255,163,0.10)',
                                    borderColor: 'rgba(0,255,163,0.2)',
                                }}
                            >
                                <Shield className="h-4 w-4" color={BRAND_GREEN_BRIGHT} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: BRAND_GREEN_BRIGHT }}>
                                    {t('privacy.title')}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
                                    {t('privacy.description')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
