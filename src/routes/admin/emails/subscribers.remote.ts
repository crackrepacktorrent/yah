import * as v from "valibot";
import { getListmonk } from "$lib/server/listmonk";
import { protectedQuery, protectedCommand } from "$lib/server/auth-helpers";

export const listSubscribers = protectedQuery(
  { subscriber: ["view"] },
  async () => {
    const res = await getListmonk().listSubscribers({
      per_page: "all",
    });
    return {
      subscribers: res.data.results,
      total: res.data.total,
    };
  },
);

export const createSubscriber = protectedCommand(
  { subscriber: ["create"] },
  v.object({
    email: v.pipe(
      v.string(),
      v.nonEmpty("Email is required"),
      v.email("Invalid email"),
    ),
    name: v.optional(v.string()),
    status: v.optional(v.string()),
    listIds: v.optional(v.array(v.number())),
    preconfirm: v.optional(v.boolean()),
  }),
  async ({ email, name, status, listIds, preconfirm }) => {
    return getListmonk().createSubscriber({
      email,
      name,
      status,
      lists: listIds,
      preconfirm,
    });
  },
);

export const updateSubscriber = protectedCommand(
  { subscriber: ["edit"] },
  v.object({
    id: v.number(),
    email: v.optional(
      v.pipe(
        v.string(),
        v.nonEmpty("Email is required"),
        v.email("Invalid email"),
      ),
    ),
    name: v.optional(v.string()),
    status: v.optional(v.string()),
    listIds: v.optional(v.array(v.number())),
    preconfirm: v.optional(v.boolean()),
  }),
  async ({ id, email, name, status, listIds, preconfirm }) => {
    return getListmonk().updateSubscriber(id, {
      email,
      name,
      status,
      lists: listIds,
      preconfirm,
    });
  },
);

export const deleteSubscribers = protectedCommand(
  { subscriber: ["delete"] },
  v.array(v.number()),
  async (ids) => {
    await getListmonk().deleteSubscribers(ids);
  },
);

export const blocklistSubscribers = protectedCommand(
  { subscriber: ["blocklist"] },
  v.array(v.number()),
  async (ids) => {
    await getListmonk().blocklistSubscribers(ids);
  },
);

export const getSubscriberExport = protectedQuery(
  { subscriber: ["view"] },
  v.number(),
  async (id) => {
    return getListmonk().getSubscriberExport(id);
  },
);

export const getSubscriberBounces = protectedQuery(
  { subscriber: ["view"] },
  v.number(),
  async (id) => {
    return getListmonk().getSubscriberBounces(id);
  },
);

export const deleteSubscriberBounces = protectedCommand(
  { bounce: ["delete"] },
  v.number(),
  async (id) => {
    await getListmonk().deleteSubscriberBounces(id);
  },
);

export const sendOptinConfirmation = protectedCommand(
  { subscriber: ["edit"] },
  v.number(),
  async (subscriberId) => {
    await getListmonk().sendOptinConfirmation(subscriberId);
  },
);
