import { useMemo } from "react";

export interface SentimentEntry {
  id: string;
  clientId: string;
  sourceType: "meeting" | "email" | "task_comment" | "manual";
  sourceLabel: string;
  sentimentScore: number;
  positiveSignals: string[];
  testimonialPotential: "low" | "medium" | "high";
  analyzedAt: string;
}

const sentimentSeed: SentimentEntry[] = [
  {
    id: "sent-001",
    clientId: "client-demo",
    sourceType: "meeting",
    sourceLabel: "Q1 Strategy Sync",
    sentimentScore: 84,
    positiveSignals: ["Great momentum", "Excited about the roadmap"],
    testimonialPotential: "high",
    analyzedAt: "2026-01-08",
  },
  {
    id: "sent-002",
    clientId: "client-demo",
    sourceType: "email",
    sourceLabel: "Weekly recap email",
    sentimentScore: 71,
    positiveSignals: ["Appreciate the clarity", "Thanks for the fast turnaround"],
    testimonialPotential: "medium",
    analyzedAt: "2026-01-11",
  },
  {
    id: "sent-003",
    clientId: "client-demo",
    sourceType: "task_comment",
    sourceLabel: "Sprint 6 review",
    sentimentScore: 78,
    positiveSignals: ["Best sprint yet"],
    testimonialPotential: "medium",
    analyzedAt: "2026-01-14",
  },
];

export const useClientSentiment = (clientId?: string) => {
  const entries = useMemo(() => {
    if (!clientId) return sentimentSeed;
    return sentimentSeed.filter((entry) => entry.clientId === clientId);
  }, [clientId]);

  return {
    entries,
  };
};
