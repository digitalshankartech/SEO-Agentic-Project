import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { streamChat } from '../lib/api';
import { clearAnalysisState, loadAnalysisState, loadProductContext, formatContextForPrompt, saveAnalysisState } from '../lib/storage';
import { getSystemPrompt } from '../skills/prompts';
import { useSelectedModel } from '../components/ModelSelector';
import ToolHeader from '../components/ToolHeader';
import OutputCard from '../components/OutputCard';

const STORAGE_KEY = 'competitor-analysis';
const SEVERITY_COLORS = {
  Critical: '#ef4444',
  High: '#f59e0b',
  Medium: '#06b6d4',
  Low: '#22c55e',
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function avg(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length) : 0;
}

function countMatches(text, pattern) {
  return (String(text || '').match(pattern) || []).length;
}

function formatGeneratedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function escapeRegex(label) {
  return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractScore(text, labels, fallback) {
  const joined = labels.map(escapeRegex).join('|');
  const patterns = [
    new RegExp(`(?:${joined})[^0-9]{0,48}(\\d{1,3})(?:\\s*\\/\\s*100|\\s*%)?`, 'i'),
    new RegExp(`(\\d{1,3})(?:\\s*\\/\\s*100|\\s*%)?[^\\n]{0,42}(?:${joined})`, 'i'),
  ];
  for (const regex of patterns) {
    const match = regex.exec(text || '');
    if (match) return clamp(match[1]);
  }
  return fallback;
}

function extractBullets(text, fallback) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*#\d.\s]+/, '').trim())
    .filter((line) => line.length > 24 && !line.startsWith('|'))
    .slice(0, 24);
  return lines.length ? lines : fallback;
}

function firstSentence(text, words, fallback) {
  const sentences = String(text || '').split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const found = sentences.find((sentence) => words.some((word) => sentence.toLowerCase().includes(word)));
  return (found || fallback).slice(0, 160);
}

function parseCompetitorName(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Competitor';
  try {
    const host = new URL(raw).hostname.replace(/^www\./, '');
    return host.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return raw.split(/[,\n]/)[0].slice(0, 44);
  }
}

function parseCompetitorUrl(value) {
  try {
    return new URL(value).href;
  } catch {
    return value?.startsWith('http') ? value : 'Not provided';
  }
}

function severityFromScore(score, inverse = false) {
  const value = inverse ? 100 - score : score;
  if (value < 45) return 'Critical';
  if (value < 65) return 'High';
  if (value < 82) return 'Medium';
  return 'Low';
}

function severityClass(severity) {
  return {
    Critical: 'border-red-200 bg-red-50 text-red-700',
    High: 'border-amber-200 bg-amber-50 text-amber-700',
    Medium: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    Low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }[severity] || 'border-slate-200 bg-slate-50 text-slate-700';
}

function statusClass(status) {
  return {
    'Critical Risk': 'border-red-200 bg-red-50 text-red-700',
    'High Risk': 'border-amber-200 bg-amber-50 text-amber-700',
    'Medium Risk': 'border-cyan-200 bg-cyan-50 text-cyan-700',
    'Low Risk': 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'Quick Win': 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'High ROI': 'border-violet-200 bg-violet-50 text-violet-700',
    'Long-term Play': 'border-slate-200 bg-slate-50 text-slate-700',
    'Needs Proof': 'border-rose-200 bg-rose-50 text-rose-700',
    'Messaging Gap': 'border-orange-200 bg-orange-50 text-orange-700',
    'SEO Opportunity': 'border-teal-200 bg-teal-50 text-teal-700',
    'Strategic Priority': 'border-indigo-200 bg-indigo-50 text-indigo-700',
    'Client Ready': 'border-slate-200 bg-white text-slate-700',
    '11 Minds Wins': 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'Competitor Wins': 'border-red-200 bg-red-50 text-red-700',
    Tie: 'border-slate-200 bg-slate-50 text-slate-700',
    'Opportunity Gap': 'border-amber-200 bg-amber-50 text-amber-700',
  }[status] || 'border-slate-200 bg-slate-50 text-slate-700';
}

function makeCompetitiveViewModel({ output, competitor, yourPositioning, targetAudience, context }) {
  const source = `${output}\n${competitor}\n${yourPositioning}\n${targetAudience}\n${context}`.toLowerCase();
  const hasOutput = Boolean(output);
  const competitorName = parseCompetitorName(competitor);
  const threatSignals = countMatches(source, /strong|leader|established|enterprise|brand|pricing|feature|proof|case study|review/g);
  const opportunitySignals = countMatches(source, /gap|weak|missing|opportunity|differentiate|win|undercut|position/g);
  const seoSignals = countMatches(source, /seo|content|keyword|blog|landing|search|schema|backlink/g);
  const salesSignals = countMatches(source, /sales|objection|battlecard|demo|cta|conversion|pricing/g);

  const competitiveStrength = extractScore(output, ['Competitive Strength Score', 'Strength Score'], hasOutput ? clamp(58 + threatSignals * 3) : 0);
  const positioning = extractScore(output, ['Market Positioning Score', 'Positioning Score'], hasOutput ? clamp(62 + countMatches(source, /position|niche|category|segment/g) * 4) : 0);
  const messaging = extractScore(output, ['Messaging Clarity Score', 'Messaging Score'], hasOutput ? clamp(60 + countMatches(source, /headline|message|copy|clarity|value proposition/g) * 4) : 0);
  const offer = extractScore(output, ['Offer Differentiation Score', 'Differentiation Score'], hasOutput ? clamp(58 + opportunitySignals * 3) : 0);
  const pricing = extractScore(output, ['Pricing Advantage Score', 'Pricing Score'], hasOutput ? clamp(52 + countMatches(source, /pricing|affordable|premium|undercut|transparent/g) * 5) : 0);
  const seo = extractScore(output, ['SEO Opportunity Score', 'SEO Score'], hasOutput ? clamp(55 + seoSignals * 4) : 0);
  const content = extractScore(output, ['Content Gap Score', 'Content Score'], hasOutput ? clamp(54 + countMatches(source, /content|blog|topic|resource|landing/g) * 4) : 0);
  const conversion = extractScore(output, ['Conversion Advantage Score', 'Conversion Score'], hasOutput ? clamp(57 + salesSignals * 4) : 0);
  const marketOpportunity = hasOutput ? clamp(offer * 0.3 + seo * 0.25 + content * 0.2 + conversion * 0.25) : 0;
  const threatLevel = hasOutput ? clamp(competitiveStrength * 0.55 + positioning * 0.2 + messaging * 0.15 + pricing * 0.1) : 0;
  const quickWins = hasOutput ? Math.max(3, Math.min(12, Math.round((100 - messaging) / 12 + opportunitySignals))) : 0;
  const risks = hasOutput ? Math.max(2, Math.round(threatLevel / 22)) : 0;
  const growthOps = hasOutput ? Math.max(3, Math.round(marketOpportunity / 12 + seoSignals)) : 0;
  const channelsToFix = hasOutput ? Math.max(2, Math.round((100 - avg([messaging, seo, conversion])) / 16)) : 0;

  const fallbackActions = [
    'Sharpen the positioning around a specific buyer pain and make the category promise clearer.',
    'Create a comparison landing page that directly answers why prospects should choose us.',
    'Add proof points, testimonials, and outcome metrics to reduce competitor trust advantage.',
    'Package the offer with a clearer service scope, timeline, and decision-ready CTA.',
    'Publish content around competitor alternatives, pricing objections, and high-intent service queries.',
    'Build a sales battlecard for the top objections prospects raise during competitor comparisons.',
    'Improve homepage messaging so the first viewport communicates differentiated value immediately.',
    'Add industry-specific case studies and proof assets to support premium positioning.',
    'Create a pricing and value narrative that makes scope, speed, and outcomes easier to compare.',
  ];
  const bullets = extractBullets(output, fallbackActions);
  const actions = bullets.slice(0, 9).map((item, index) => {
    const priority = index < 2 ? 'Critical' : index < 4 ? 'High' : index < 7 ? 'Medium' : 'Low';
    const categories = ['Positioning', 'SEO', 'Content', 'Offer', 'Pricing', 'Sales', 'Branding', 'Website UX', 'Trust Building'];
    const effort = index % 3 === 0 ? 'Low' : index % 3 === 1 ? 'Medium' : 'High';
    const impact = priority === 'Critical' ? 'Very High' : priority === 'High' ? 'High' : priority === 'Medium' ? 'Medium' : 'Low';
    return {
      name: item.split(/[.:]/)[0].slice(0, 76) || `Competitive action ${index + 1}`,
      category: categories[index % categories.length],
      priority,
      insight: item.slice(0, 140),
      impact,
      effort,
      outcome: `Improve win rate and reduce ${competitorName} comparison risk.`,
      owner: ['Growth', 'SEO', 'Content', 'Sales', 'Brand'][index % 5],
      x: effort === 'Low' ? 28 : effort === 'Medium' ? 56 : 78,
      y: impact === 'Very High' || impact === 'High' ? 24 : impact === 'Medium' ? 55 : 78,
    };
  });

  const ourScores = {
    positioning: clamp(positioning + 6),
    serviceDepth: clamp(68 + countMatches(source, /service|deliverable|support/g) * 4),
    pricing,
    seo,
    content,
    proof: clamp(54 + countMatches(source, /proof|testimonial|case|logo|review/g) * 4),
    sales: conversion,
    trust: clamp(58 + countMatches(source, /trust|credential|founder|team/g) * 4),
    creative: offer,
    ai: clamp(60 + countMatches(source, /ai|automation|agent|workflow/g) * 5),
  };
  const competitorScores = {
    positioning: competitiveStrength,
    serviceDepth: clamp(competitiveStrength + countMatches(source, /feature|platform|suite/g) * 2),
    pricing: clamp(100 - pricing + 42),
    seo: clamp(seo - 8 + threatSignals),
    content: clamp(content - 5 + threatSignals),
    proof: clamp(competitiveStrength + countMatches(source, /case|review|client/g) * 3),
    sales: clamp(messaging + threatSignals),
    trust: clamp(competitiveStrength + countMatches(source, /authority|enterprise|brand/g) * 2),
    creative: clamp(offer - 4 + threatSignals),
    ai: clamp(62 + countMatches(source, /ai|automation/g) * 3),
  };

  const radar = [
    ['Brand Positioning', 'positioning'],
    ['Service Depth', 'serviceDepth'],
    ['Pricing Advantage', 'pricing'],
    ['SEO Strength', 'seo'],
    ['Content Quality', 'content'],
    ['Social Proof', 'proof'],
    ['Sales Messaging', 'sales'],
    ['Technical Trust', 'trust'],
    ['Creative Differentiation', 'creative'],
    ['AI Capability', 'ai'],
  ].map(([dimension, key]) => ({
    dimension,
    our: ourScores[key],
    competitor: competitorScores[key],
    benchmark: 76,
  }));

  const serviceComparison = [
    'Service Scope',
    'Deliverables',
    'Pricing Transparency',
    'Client Support',
    'Turnaround Time',
    'Industry Focus',
    'Creative Quality',
    'Automation / AI',
    'Reporting Quality',
    'Scalability',
  ].map((name, index) => ({
    name,
    our: clamp(Object.values(ourScores)[index % 10] + (index % 2 ? 4 : 0)),
    competitor: clamp(Object.values(competitorScores)[index % 10]),
  }));

  const messagingScores = [
    { name: 'Headline Strength', value: messaging },
    { name: 'Value Prop Clarity', value: positioning },
    { name: 'CTA Strength', value: conversion },
    { name: 'Trust Elements', value: ourScores.proof },
    { name: 'Emotional Appeal', value: ourScores.creative },
    { name: 'Readability', value: content },
    { name: 'Differentiation', value: offer },
  ];

  const seoGaps = [
    { name: 'Keyword Gap', value: seo },
    { name: 'Content Topics', value: content },
    { name: 'Landing Pages', value: clamp(seo - 8) },
    { name: 'Blog Resources', value: clamp(content + 6) },
    { name: 'Local SEO', value: clamp(seo - 14) },
    { name: 'Backlinks', value: clamp(ourScores.proof) },
    { name: 'Schema', value: clamp(ourScores.ai) },
    { name: 'Intent Coverage', value: clamp(content + 4) },
  ];

  const trustItems = ['Case Studies', 'Testimonials', 'Client Logos', 'Reviews', 'Portfolio', 'Media Mentions', 'Certifications', 'Founder Credibility', 'Results Metrics'].map((name, index) => ({
    name,
    our: index < Math.round(ourScores.proof / 12),
    competitor: index < Math.round(competitorScores.proof / 12),
  }));

  const compareWinner = (label, our, competitorScore, gapType = 'Opportunity Gap') => {
    const delta = Math.round(our - competitorScore);
    let winner = 'Tie';
    if (delta >= 8) winner = '11 Minds Wins';
    if (delta <= -8) winner = gapType;
    return { label, our, competitor: competitorScore, delta, winner };
  };
  const winnerRows = [
    compareWinner('Brand Positioning', ourScores.positioning, competitorScores.positioning),
    compareWinner('Pricing', ourScores.pricing, competitorScores.pricing, 'Competitor Wins'),
    compareWinner('SEO', ourScores.seo, competitorScores.seo),
    compareWinner('Content', ourScores.content, competitorScores.content),
    compareWinner('Trust', ourScores.proof, competitorScores.proof, 'Needs Proof'),
    compareWinner('Offer Strength', ourScores.creative, competitorScores.creative),
    compareWinner('Conversion Readiness', ourScores.sales, competitorScores.sales),
  ];
  const topRisks = actions.filter((item) => item.priority === 'Critical' || item.priority === 'High').slice(0, 3);
  const topOpportunities = actions.filter((item) => item.impact === 'Very High' || item.impact === 'High' || item.category === 'SEO' || item.category === 'Content').slice(0, 3);
  const hasManualContext = Boolean(yourPositioning || targetAudience || context);
  const confidence = !hasOutput ? 'Low' : hasManualContext && output.length > 1800 ? 'High' : output.length > 900 ? 'Medium' : 'Low';
  const limitedData = hasOutput && (!hasManualContext || confidence !== 'High');
  const advantageScore = avg([ourScores.positioning, ourScores.pricing, ourScores.seo, ourScores.content, ourScores.proof, ourScores.sales, ourScores.creative]);

  return {
    competitorName,
    competitorUrl: parseCompetitorUrl(competitor),
    confidence,
    limitedData,
    scores: { competitiveStrength, positioning, messaging, offer, pricing, seo, content, conversion, threatLevel, marketOpportunity, advantageScore },
    quickWins,
    risks,
    growthOps,
    channelsToFix,
    radar,
    serviceComparison,
    messagingScores,
    seoGaps,
    trustItems,
    winnerRows,
    topRisks: topRisks.length ? topRisks : actions.slice(0, 3),
    topOpportunities: topOpportunities.length ? topOpportunities : actions.slice(1, 4),
    threatBreakdown: [
      { name: 'Critical Threat', value: Math.max(1, Math.round(threatLevel / 38)), color: SEVERITY_COLORS.Critical },
      { name: 'High Threat', value: Math.max(1, Math.round(threatLevel / 26)), color: SEVERITY_COLORS.High },
      { name: 'Medium Threat', value: Math.max(2, Math.round((100 - threatLevel) / 24)), color: SEVERITY_COLORS.Medium },
      { name: 'Low Threat', value: Math.max(2, Math.round((100 - threatLevel) / 28)), color: SEVERITY_COLORS.Low },
    ],
    heatmap: seoGaps.map((item) => ({ name: item.name, status: item.value >= 75 ? 'Strong' : item.value >= 55 ? 'Partial' : 'Gap' })),
    actions,
    roadmap: [
      { period: 'First 30 Days', title: 'Quick Wins', items: actions.slice(0, 3) },
      { period: 'Next 60 Days', title: 'Strategic Improvements', items: actions.slice(3, 6) },
      { period: 'Next 90 Days', title: 'Market Positioning Upgrades', items: actions.slice(6, 9) },
    ],
    snapshot: [
      ['Competitor Name', competitorName],
      ['Website URL', parseCompetitorUrl(competitor)],
      ['Business Category', firstSentence(output, ['category', 'market', 'industry'], 'Competitive service provider in the same buying category.')],
      ['Primary Offering', firstSentence(output, ['offering', 'product', 'service'], 'Comparable offer competing for similar client budget and attention.')],
      ['Target Audience', targetAudience || firstSentence(output, ['audience', 'buyer', 'customer'], 'Overlapping prospects comparing service quality, proof, price, and outcomes.')],
      ['Positioning Style', firstSentence(output, ['positioning', 'position'], 'Benefit-led positioning with room to sharpen differentiation.')],
      ['Core Value Proposition', firstSentence(output, ['value proposition', 'promise', 'value'], 'A clearer outcome promise can improve competitive conversion.')],
      ['Brand Tone', firstSentence(output, ['tone', 'voice', 'brand'], 'Professional, credible, and conversion-oriented.')],
    ],
    finalRec: {
      angle: firstSentence(output, ['angle', 'positioning'], 'Position around specialized outcomes, speed to value, and proof-backed execution.'),
      weakness: firstSentence(output, ['weakness', 'gap'], `${competitorName} can be attacked where their offer feels generic, unclear, or insufficiently proven.`),
      opportunity: firstSentence(output, ['opportunity', 'market'], 'Build comparison, alternative, and high-intent content to capture active buyers.'),
      urgent: actions[0]?.name || 'Clarify above-the-fold positioning',
      roi: actions[1]?.name || 'Build competitor comparison page',
      message: firstSentence(output, ['message', 'say'], 'A specialist partner for growth teams that need clearer strategy, faster execution, and measurable results.'),
      cta: firstSentence(output, ['cta', 'call to action'], 'Book a competitive growth audit'),
      offer: firstSentence(output, ['offer', 'package'], 'A focused competitive growth sprint with SEO, messaging, and sales enablement outputs.'),
    },
  };
}

function SeverityBadge({ level }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${severityClass(level)}`}>{level}</span>;
}

function StatusBadge({ label }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass(label)}`}>{label}</span>;
}

function ReportChapter({ number, title, description, children }) {
  return (
    <div className="space-y-6 print:break-before-page">
      <div className="rounded-[26px] bg-slate-950 px-7 py-6 text-white shadow-sm print:break-inside-avoid">
        <div className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-200">Chapter {number}</div>
        <h2 className="mt-2 text-3xl font-black">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ReportSection({ number, title, description, badge = 'Client Ready', children }) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm print:break-inside-avoid">
      <div className="mb-6 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-500">{number}</div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <StatusBadge label={badge} />
      </div>
      {children}
    </section>
  );
}

function MajorMetric({ label, value, helper, badge }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <StatusBadge label={badge} />
      </div>
      <div className="mt-5 text-5xl font-black tracking-tight text-slate-950">{value}</div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{helper}</p>
    </div>
  );
}

function KpiCard({ label, value, severity, explanation, nextStep }) {
  return (
    <div className="flex min-h-[190px] flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.17em] text-slate-500">{label}</div>
        <SeverityBadge level={severity} />
      </div>
      <div className="mt-3 text-3xl font-black text-slate-950">{value}</div>
      <p className="mt-3 flex-1 text-xs leading-5 text-slate-500">{explanation}</p>
      <div className="mt-4 rounded-xl bg-white p-3 text-[11px] font-bold text-slate-700">Next: {nextStep}</div>
    </div>
  );
}

function ReportCover({ vm, generatedAt }) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm print:break-after-page">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="p-8 sm:p-10">
          <div className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700">Competitive Intelligence Report</div>
          <h1 className="mt-8 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">11 Minds vs {vm.competitorName}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Prepared for strategy, positioning, SEO, trust-building, and growth planning.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              ['Competitor URL', vm.competitorUrl],
              ['Analysis Type', 'Strategic competitor report'],
              ['Report Confidence', vm.confidence],
              ['Prepared By', 'Marketing Suite'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
                <div className="mt-2 break-words text-sm font-black text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-950 p-8 text-white sm:p-10">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-200">Executive Lens</div>
          {[
            ['Advantage Score', `${vm.scores.advantageScore}/100`],
            ['Threat Level', `${vm.scores.threatLevel}/100`],
            ['Market Opportunity', `${vm.scores.marketOpportunity}/100`],
          ].map(([label, value]) => (
            <div key={label} className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">{label}</div>
              <div className="mt-2 text-4xl font-black text-white">{value}</div>
            </div>
          ))}
          <div className="mt-8 border-t border-white/10 pt-5 text-sm text-slate-300">Generated on {generatedAt || 'Current session'}</div>
        </div>
      </div>
    </section>
  );
}

function InsightList({ title, items, badge }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        <StatusBadge label={badge} />
      </div>
      <div className="mt-4 space-y-3">
        {items.slice(0, 3).map((item, index) => (
          <div key={`${title}-${item.name}-${index}`} className="rounded-xl bg-slate-50 p-4">
            <div className="text-sm font-black text-slate-950">{item.name}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{item.insight}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LimitedDataNotice({ vm }) {
  if (!vm.limitedData) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 print:break-inside-avoid">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-black text-amber-800">Limited public data detected</div>
          <p className="mt-2 text-sm leading-6 text-amber-700">AI confidence: {vm.confidence}. Add more manual inputs before sharing final claims with a client.</p>
        </div>
        <StatusBadge label="Needs Proof" />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {['Pricing', 'Main services', 'Case studies', 'Customer reviews', 'Ad examples', 'Social media links'].map((item) => (
          <div key={item} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-amber-800">{item}</div>
        ))}
      </div>
    </div>
  );
}

function Heatmap({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const cls = {
          Strong: 'border-emerald-200 bg-emerald-50 text-emerald-700',
          Partial: 'border-amber-200 bg-amber-50 text-amber-700',
          Gap: 'border-red-200 bg-red-50 text-red-700',
        }[item.status];
        return (
          <div key={item.name} className={`rounded-2xl border p-5 ${cls}`}>
            <div className="text-sm font-black">{item.name}</div>
            <div className="mt-2 text-xs font-bold uppercase tracking-wide">{item.status}</div>
          </div>
        );
      })}
    </div>
  );
}

function Matrix2x2({ vm }) {
  return (
    <div className="relative h-[430px] rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="absolute left-5 right-5 top-1/2 h-px bg-slate-300" />
      <div className="absolute bottom-5 top-5 left-1/2 w-px bg-slate-300" />
      <div className="absolute left-6 top-6 text-sm font-black text-slate-600">Premium Specialist</div>
      <div className="absolute right-6 top-6 text-right text-sm font-black text-slate-600">Premium Generalist</div>
      <div className="absolute left-6 bottom-6 text-sm font-black text-slate-600">Budget Specialist</div>
      <div className="absolute right-6 bottom-6 text-right text-sm font-black text-slate-600">Budget Generalist</div>
      <div className="absolute left-[28%] top-[28%] rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-white shadow-lg">Our Brand</div>
      <div className="absolute left-[64%] top-[42%] rounded-full bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-lg">{vm.competitorName}</div>
      <div className="absolute left-[22%] top-[18%] rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">Ideal Zone</div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Generic Service to Specialized Expertise</div>
      <div className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold uppercase tracking-wide text-slate-400">Low Cost to Premium</div>
    </div>
  );
}

function OpportunityMatrix({ actions }) {
  return (
    <div className="relative h-[420px] rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="absolute left-5 right-5 top-1/2 h-px bg-slate-300" />
      <div className="absolute bottom-5 top-5 left-1/2 w-px bg-slate-300" />
      <div className="absolute left-6 top-6 text-sm font-black text-slate-600">High Impact / Low Effort</div>
      <div className="absolute right-6 top-6 text-right text-sm font-black text-slate-600">High Impact / High Effort</div>
      <div className="absolute left-6 bottom-6 text-sm font-black text-slate-600">Low Impact / Low Effort</div>
      <div className="absolute right-6 bottom-6 text-right text-sm font-black text-slate-600">Low Impact / High Effort</div>
      {actions.slice(0, 8).map((item, index) => (
        <div
          key={`${item.name}-${index}`}
          className="absolute max-w-[160px] rounded-lg border border-white bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-lg"
          style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%, -50%)' }}
        >
          {item.name}
        </div>
      ))}
    </div>
  );
}

function WhoIsWinning({ vm }) {
  return (
    <ReportSection number="01.2" title="Who Is Winning?" description="A fast winner view for the areas clients care about most." badge="Strategic Priority">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {vm.winnerRows.map((row) => (
          <div key={row.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">{row.label}</div>
                <div className="mt-1 text-xs text-slate-500">Delta: {row.delta > 0 ? '+' : ''}{row.delta}</div>
              </div>
              <StatusBadge label={row.winner} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-white p-3"><div className="font-bold text-emerald-700">11 Minds</div><div className="mt-1 text-lg font-black text-slate-950">{row.our}</div></div>
              <div className="rounded-xl bg-white p-3"><div className="font-bold text-indigo-700">{vm.competitorName}</div><div className="mt-1 text-lg font-black text-slate-950">{row.competitor}</div></div>
            </div>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

function BattlecardRow({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-bold leading-6 text-slate-800">{value}</div>
    </div>
  );
}

function CompetitorDashboard({ vm, generatedAt }) {
  const kpis = [
    ['Competitive Strength Score', `${vm.scores.competitiveStrength}/100`, severityFromScore(100 - vm.scores.threatLevel, true), 'How strong the competitor appears across positioning, proof, offer, and category presence.', 'Attack their weakest proof gap'],
    ['Market Positioning Score', `${vm.scores.positioning}/100`, severityFromScore(vm.scores.positioning), 'Measures how clearly the market position can be understood and defended.', 'Sharpen category claim'],
    ['Messaging Clarity Score', `${vm.scores.messaging}/100`, severityFromScore(vm.scores.messaging), 'Shows whether the offer is easy to understand, compare, and act on.', 'Rewrite first-viewport message'],
    ['Offer Differentiation Score', `${vm.scores.offer}/100`, severityFromScore(vm.scores.offer), 'Measures how clearly the offer can stand apart in a comparison.', 'Package a sharper offer'],
    ['Pricing Advantage Score', `${vm.scores.pricing}/100`, severityFromScore(vm.scores.pricing), 'Shows whether pricing can be used as a competitive lever or risk.', 'Clarify value-to-price story'],
    ['SEO Opportunity Score', `${vm.scores.seo}/100`, severityFromScore(vm.scores.seo), 'Estimates capture potential through comparison, alternative, and intent-led search pages.', 'Build comparison SEO pages'],
    ['Content Gap Score', `${vm.scores.content}/100`, severityFromScore(vm.scores.content), 'Measures content angles available to win demand before sales conversations happen.', 'Publish gap-led content'],
    ['Conversion Advantage Score', `${vm.scores.conversion}/100`, severityFromScore(vm.scores.conversion), 'Shows the potential to improve landing-page, CTA, and sales conversion.', 'Improve CTA and proof stack'],
  ];

  return (
    <div className="mx-auto mt-10 max-w-[1180px] space-y-8">
      <ReportCover vm={vm} generatedAt={generatedAt} />

      <ReportChapter number="1" title="Executive Summary" description="The short answer: who is stronger, what the risk is, and what should happen first.">
        <LimitedDataNotice vm={vm} />
        <ReportSection number="01.1" title="Executive Competitive Summary" description="A quick view of where 11 Minds stands against the competitor." badge="Strategic Priority">
          <div className="grid gap-6 xl:grid-cols-[1fr_1.05fr]">
            <div className="grid gap-4">
              <MajorMetric label="Overall Competitive Advantage Score" value={`${vm.scores.advantageScore}/100`} helper="Composite score across positioning, SEO, proof, offer, pricing, content, and conversion readiness." badge="High ROI" />
              <MajorMetric label="Threat Level" value={`${vm.scores.threatLevel}/100`} helper="How likely the competitor is to pull attention, trust, and sales conversations away." badge={vm.scores.threatLevel > 74 ? 'Critical Risk' : 'High Risk'} />
              <MajorMetric label="Market Opportunity Score" value={`${vm.scores.marketOpportunity}/100`} helper="The practical growth gap available through sharper positioning, SEO, proof, and sales enablement." badge="SEO Opportunity" />
            </div>
            <div className="grid gap-4">
              <InsightList title="Top 3 Risks" items={vm.topRisks} badge="High Risk" />
              <InsightList title="Top 3 Opportunities" items={vm.topOpportunities} badge="Quick Win" />
              <div className="rounded-[24px] border border-indigo-200 bg-indigo-50 p-6">
                <StatusBadge label="Strategic Priority" />
                <h3 className="mt-4 text-xl font-black text-slate-950">Recommended Immediate Action</h3>
                <p className="mt-3 text-sm leading-6 text-indigo-900">{vm.actions[0]?.insight}</p>
              </div>
            </div>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {kpis.map(([label, value, severity, explanation, nextStep]) => (
              <KpiCard key={label} label={label} value={value} severity={severity} explanation={explanation} nextStep={nextStep} />
            ))}
          </div>
        </ReportSection>
        <WhoIsWinning vm={vm} />
      </ReportChapter>

      <ReportChapter number="2" title="Competitive Positioning" description="How both brands sit in the market and where the positioning gap is easiest to explain.">
        <ReportSection number="02.1" title="Competitor Snapshot" description="A clean profile of the competitor and the buying context." badge="Client Ready">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {vm.snapshot.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
                <div className="mt-3 text-sm font-bold leading-6 text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </ReportSection>
        <ReportSection number="02.2" title="Brand Positioning Comparison" description="Side-by-side comparison cards preserve the original comparison logic without table-heavy reading." badge="Strategic Priority">
          <div className="grid gap-4 lg:grid-cols-2">
            {['Core Offering', 'Tagline / Positioning', 'Target Market', 'Pricing Model', 'Proof Points', 'Weaknesses'].map((label, index) => (
              <div key={label} className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="bg-slate-950 px-4 py-3 text-sm font-black text-white">{label}</div>
                <div className="grid grid-cols-2">
                  <div className="bg-emerald-50 p-4"><div className="text-xs font-black text-emerald-700">11 Minds</div><div className="mt-2 text-sm font-semibold leading-6 text-slate-950">{vm.actions[index]?.outcome || 'Sharper specialist positioning'}</div></div>
                  <div className="bg-indigo-50 p-4"><div className="text-xs font-black text-indigo-700">{vm.competitorName}</div><div className="mt-2 text-sm font-semibold leading-6 text-slate-950">Needs direct comparison, proof, and clearer differentiation.</div></div>
                </div>
              </div>
            ))}
          </div>
        </ReportSection>
        <ReportSection number="02.3" title="Competitive Strength Radar, Threat Donut & Market Map" description="Recovered charts for strategic comparison, threat mix, and market positioning." badge="Client Ready">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="h-[560px] rounded-2xl border border-slate-200 p-5">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={vm.radar}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: '#475569' }} />
                  <Radar name="Our Brand" dataKey="our" stroke="#10b981" fill="#10b981" fillOpacity={0.28} />
                  <Radar name={vm.competitorName} dataKey="competitor" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.22} />
                  <Radar name="Industry Benchmark" dataKey="benchmark" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.08} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={vm.threatBreakdown} dataKey="value" nameKey="name" innerRadius={64} outerRadius={104} paddingAngle={3}>
                        {vm.threatBreakdown.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-2 text-xs font-bold text-slate-600">
                  {vm.threatBreakdown.map((item) => <div key={item.name} className="flex items-center justify-between"><span>{item.name}</span><span>{item.value}</span></div>)}
                </div>
              </div>
              <Matrix2x2 vm={vm} />
            </div>
          </div>
        </ReportSection>
      </ReportChapter>

      <ReportChapter number="3" title="Brand, Messaging & Offer Gap" description="Where offer, copy, pricing story, and differentiation need to become sharper.">
        <ReportSection number="03.1" title="Offer & Service Comparison Dashboard" description="Recovered service comparison chart with larger labels for export readability." badge="Messaging Gap">
          <div className="h-[440px] rounded-2xl border border-slate-200 p-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vm.serviceComparison} layout="vertical" margin={{ left: 18, right: 24, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="our" name="Our Brand" fill="#10b981" radius={[0, 8, 8, 0]} />
                <Bar dataKey="competitor" name={vm.competitorName} fill="#4f46e5" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ReportSection>
        <ReportSection number="03.2" title="Messaging, Pricing & Differentiation Gap" description="Recovered message scoring, pricing intelligence, and gap recommendations." badge="High ROI">
          <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <div className="h-[380px] rounded-2xl border border-slate-200 p-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vm.messagingScores} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-18} textAnchor="end" height={72} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-3">
              {['Transparency Level', 'Perceived Value', 'Affordability Position', 'Premium Position', 'Risk of Being Undercut', 'Opportunity to Differentiate'].map((item, index) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between"><div className="text-sm font-black text-slate-950">{item}</div><StatusBadge label={index < 2 ? 'Quick Win' : index < 4 ? 'High ROI' : 'Messaging Gap'} /></div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Observation: use pricing and offer structure to make the choice easier. Recommended action: clarify value, scope, and outcome.</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {vm.actions.slice(0, 6).map((item, index) => (
              <div key={`${item.name}-gap`} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs font-black uppercase tracking-wide text-indigo-500">Gap {index + 1}</div>
                <h3 className="mt-2 font-black text-slate-950">{item.name}</h3>
                <p className="mt-3 text-xs leading-5 text-slate-500">Observation: broad competitor claims need a sharper response. Why it matters: prospects need a quick reason to believe. Business impact: improved win-rate clarity. Recommended action: prove a specific outcome.</p>
                <div className="mt-3 rounded-xl bg-white p-3 text-xs font-bold text-slate-700">Proof needed: case study, result metric, or client quote.</div>
              </div>
            ))}
          </div>
        </ReportSection>
      </ReportChapter>

      <ReportChapter number="4" title="SEO, Content & Trust Opportunity" description="Where search demand, topic coverage, and proof assets can create a measurable advantage.">
        <ReportSection number="04.1" title="SEO & Content Gap Dashboard" description="Recovered SEO opportunity chart and coverage heatmap." badge="SEO Opportunity">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="h-[420px] rounded-2xl border border-slate-200 p-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vm.seoGaps} margin={{ left: 8, right: 20, top: 8, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-18} textAnchor="end" height={72} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Heatmap items={vm.heatmap} />
          </div>
        </ReportSection>
        <ReportSection number="04.2" title="Social Proof & Trust Comparison" description="Recovered proof-point checklist for buyer confidence and sales conversion." badge="Needs Proof">
          <div className="grid gap-4 md:grid-cols-3">
            {vm.trustItems.map((item) => (
              <div key={item.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-black text-slate-950">{item.name}</div>
                <div className="mt-4 grid gap-2 text-xs font-bold">
                  <div className={item.our ? 'rounded-xl bg-emerald-50 p-2 text-emerald-700' : 'rounded-xl bg-rose-50 p-2 text-rose-700'}>11 Minds: {item.our ? 'Present' : 'Missing'}</div>
                  <div className={item.competitor ? 'rounded-xl bg-indigo-50 p-2 text-indigo-700' : 'rounded-xl bg-slate-100 p-2 text-slate-500'}>{vm.competitorName}: {item.competitor ? 'Present' : 'Gap'}</div>
                </div>
              </div>
            ))}
          </div>
        </ReportSection>
      </ReportChapter>

      <ReportChapter number="5" title="Action Plan & Roadmap" description="Sales-ready guidance, prioritized actions, and a 30/60/90 day execution path.">
        <ReportSection number="05.1" title="Sales Battlecard" description="Recovered sales-ready objection handling blocks." badge="High ROI">
          <div className="grid gap-5 lg:grid-cols-2">
            {vm.actions.slice(0, 6).map((item) => (
              <div key={`${item.name}-battlecard`} className="rounded-[22px] border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-black text-slate-950">Prospect objection: why not {vm.competitorName}?</h3><SeverityBadge level={item.priority} /></div>
                <div className="mt-5 grid gap-3">
                  <BattlecardRow label="Competitor claim" value="They may appear broader, more familiar, or easier to compare quickly." />
                  <BattlecardRow label="Our counter-response" value={item.insight} />
                  <BattlecardRow label="Proof needed" value="Case study, measurable result, client quote, or side-by-side comparison asset." />
                  <BattlecardRow label="Best CTA" value="Book a focused competitive growth audit." />
                </div>
              </div>
            ))}
          </div>
        </ReportSection>
        <ReportSection number="05.2" title="Action Priority Center" description="Recovered recommendation cards and opportunity matrix." badge="Quick Win">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <OpportunityMatrix actions={vm.actions} />
            <div className="grid gap-4">
              {vm.actions.map((item) => (
                <div key={item.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-wide text-indigo-500">{item.category}</div><h3 className="mt-1 text-base font-black text-slate-950">{item.name}</h3></div><SeverityBadge level={item.priority} /></div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.insight}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-white p-3"><span className="text-slate-500">Impact</span><div className="font-black">{item.impact}</div></div>
                    <div className="rounded-xl bg-white p-3"><span className="text-slate-500">Effort</span><div className="font-black">{item.effort}</div></div>
                    <div className="rounded-xl bg-white p-3"><span className="text-slate-500">Owner</span><div className="font-black">{item.owner}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ReportSection>
        <ReportSection number="05.3" title="30 / 60 / 90 Day Competitive Growth Roadmap" description="Recovered roadmap grouped into page-safe phases." badge="Long-term Play">
          <div className="grid gap-5 lg:grid-cols-3">
            {vm.roadmap.map((phase) => (
              <div key={phase.period} className="rounded-[22px] border border-slate-200 bg-slate-50 p-6">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">{phase.period}</div>
                <h3 className="mt-2 text-xl font-black text-slate-950">{phase.title}</h3>
                <div className="mt-5 space-y-3">
                  {phase.items.map((item) => (
                    <div key={`${phase.period}-${item.name}`} className="rounded-xl bg-white p-4">
                      <div className="flex items-start justify-between gap-2"><div className="text-sm font-black text-slate-950">{item.name}</div><SeverityBadge level={item.priority} /></div>
                      <div className="mt-2 text-xs leading-5 text-slate-500">Impact: {item.impact} | Effort: {item.effort} | Department: {item.owner}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ReportSection>
        <ReportSection number="05.4" title="Final Strategic Recommendation" description="Recovered full recommendation set with client-facing framing." badge="Strategic Priority">
          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-7 text-white">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['Recommended Market Position', vm.finalRec.angle],
                ['Competitor Weakness to Attack', vm.finalRec.weakness],
                ['Best Differentiation Angle', vm.finalRec.opportunity],
                ['Highest ROI Action', vm.finalRec.roi],
                ['Suggested Sales Message', vm.finalRec.message],
                ['Suggested CTA', vm.finalRec.cta],
                ['Suggested Offer Angle', vm.finalRec.offer],
                ['Next 7-Day Action', vm.finalRec.urgent],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200">{label}</div>
                  <div className="mt-3 text-sm font-bold leading-6 text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </ReportSection>
      </ReportChapter>

      <div className="hidden justify-between border-t border-slate-200 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 print:flex">
        <span>Marketing Suite Competitive Intelligence</span>
        <span>11 Minds vs {vm.competitorName}</span>
      </div>
    </div>
  );
}

export default function CompetitorAnalysis() {
  const [restoredState] = useState(() => loadAnalysisState(STORAGE_KEY));
  const [competitor, setCompetitor] = useState(restoredState?.competitor || '');
  const [yourPositioning, setYourPositioning] = useState(restoredState?.yourPositioning || '');
  const [targetAudience, setTargetAudience] = useState(restoredState?.targetAudience || '');
  const [context, setContext] = useState(restoredState?.context || '');
  const [output, setOutput] = useState(restoredState?.output || '');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [lastGeneratedAt, setLastGeneratedAt] = useState(restoredState?.lastGeneratedAt || '');
  const [restoreNotice, setRestoreNotice] = useState(Boolean(restoredState?.output));
  const [presentationMode, setPresentationMode] = useState(false);

  const provider = useSelectedModel();
  const canRun = competitor.trim();
  const hasAnalysis = Boolean(output);
  const formattedLastGenerated = formatGeneratedAt(lastGeneratedAt);
  const vm = useMemo(() => makeCompetitiveViewModel({ output, competitor, yourPositioning, targetAudience, context }), [output, competitor, yourPositioning, targetAudience, context]);

  useEffect(() => {
    if (!restoreNotice) return undefined;
    const timer = window.setTimeout(() => setRestoreNotice(false), 6000);
    return () => window.clearTimeout(timer);
  }, [restoreNotice]);

  useEffect(() => {
    if (!competitor && !yourPositioning && !targetAudience && !context && !output && !lastGeneratedAt) return;
    saveAnalysisState(STORAGE_KEY, { competitor, yourPositioning, targetAudience, context, output, lastGeneratedAt });
  }, [competitor, yourPositioning, targetAudience, context, output, lastGeneratedAt]);

  function handleClearAnalysis() {
    clearAnalysisState(STORAGE_KEY);
    setCompetitor('');
    setYourPositioning('');
    setTargetAudience('');
    setContext('');
    setOutput('');
    setError('');
    setLastGeneratedAt('');
    setRestoreNotice(false);
    setPresentationMode(false);
    setIsStreaming(false);
  }

  async function handleAnalyze() {
    if (!canRun || isStreaming) return;
    clearAnalysisState(STORAGE_KEY);
    setOutput('');
    setError('');
    setLastGeneratedAt('');
    setRestoreNotice(false);
    setIsStreaming(true);

    const ctxStr = formatContextForPrompt(loadProductContext());
    const systemPrompt = getSystemPrompt('competitor-analysis', ctxStr);
    const userMessage = [
      `Please conduct a comprehensive competitive analysis against: **${competitor}**`,
      yourPositioning && `**Our current positioning:** ${yourPositioning}`,
      targetAudience && `**Target audience overlap:** ${targetAudience}`,
      context && `**Additional context:** ${context}`,
      `
Deliver a full analysis covering:
1. Competitive landscape and how ${competitor} positions themselves
2. Head-to-head comparison table (features, pricing, audience, strengths, weaknesses)
3. Our differentiation and the customer segments where we win
4. Recommended positioning statement vs. this competitor
5. Key messages to emphasize in marketing and sales
6. Comparison page strategy ("Us vs ${competitor}" SEO content)
7. Objection handling scripts for "Why not just use ${competitor}?"

Be specific and actionable - this should be ready to use in real marketing and sales situations.`,
    ].filter(Boolean).join('\n\n');

    await streamChat({
      systemPrompt,
      userMessage,
      provider,
      onChunk: (t) => setOutput((p) => p + t),
      onDone: () => {
        setLastGeneratedAt(new Date().toISOString());
        setIsStreaming(false);
      },
      onError: (e) => {
        setError(e);
        setIsStreaming(false);
      },
    });
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {hasAnalysis && (
          <div className="mb-4 flex justify-end print:hidden">
            <button type="button" onClick={() => setPresentationMode((value) => !value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              {presentationMode ? 'Exit Client Presentation Mode' : 'Client Presentation Mode'}
            </button>
          </div>
        )}

        {!presentationMode && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
            <ToolHeader icon="CI" title="Competitor Analysis" description="A client-ready competitive intelligence, positioning, SEO, sales, and growth strategy report." badge="Strategy Report" />
            {(formattedLastGenerated || restoreNotice) && (
              <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                {formattedLastGenerated && <div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Last Generated <span className="normal-case tracking-normal text-indigo-900">{formattedLastGenerated}</span></div>}
                {restoreNotice && <div className="mt-1 text-sm font-medium text-emerald-700">Restored Previous Analysis</div>}
              </div>
            )}
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <Field label="Competitor Name or URL" value={competitor} onChange={setCompetitor} placeholder="e.g. HubSpot, Notion, Salesforce, or https://competitor.com" />
              <Field label="Audience Overlap" value={targetAudience} onChange={setTargetAudience} placeholder="e.g. Both target mid-market SaaS companies" />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <TextArea label="Your Current Positioning" value={yourPositioning} onChange={setYourPositioning} placeholder="How do you currently describe yourself? What's your main value prop?" />
              <TextArea label="What You Know About Them" value={context} onChange={setContext} placeholder="Pricing, features, customer complaints, review feedback, recent moves, sales notes, etc." />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={handleAnalyze} disabled={!canRun || isStreaming} className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                {isStreaming ? 'Analyzing...' : hasAnalysis ? 'Regenerate Analysis' : 'Run Competitor Analysis'}
              </button>
              {hasAnalysis && !isStreaming && <button type="button" onClick={handleClearAnalysis} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">Clear/New Analysis</button>}
            </div>
          </div>
        )}

        {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong>Error:</strong> {error}</div>}

        {(output || isStreaming) && (
          <>
            <CompetitorDashboard vm={vm} generatedAt={formattedLastGenerated} />
            {!presentationMode && (
              <details className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden" open={isStreaming || Boolean(output)}>
                <summary className="cursor-pointer select-none text-sm font-bold text-slate-800">Advanced AI Report & Export Options <span className="ml-2 text-xs font-normal text-slate-500">Raw report, HTML/PDF/PPTX export, and WordPress code</span></summary>
                <OutputCard title={`Analysis: You vs. ${vm.competitorName}`} content={output} isStreaming={isStreaming} placeholder="Competitive analysis will appear here..." />
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
  );
}
