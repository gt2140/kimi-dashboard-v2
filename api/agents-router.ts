import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { AGENTS } from "@/lib/data";

export const agentsRouter = createRouter({
  list: publicQuery.query(() => {
    return AGENTS.map(({ systemPrompt, ...rest }) => rest);
  }),

  getById: publicQuery
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const agent = AGENTS.find((a) => a.id === input.id);
      if (!agent) throw new Error("Agent not found");
      const { systemPrompt, ...rest } = agent;
      return rest;
    }),
});
